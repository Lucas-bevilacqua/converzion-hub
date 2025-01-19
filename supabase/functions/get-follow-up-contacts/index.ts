import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🔍 Iniciando função get-follow-up-contacts')
  
  if (req.method === 'OPTIONS') {
    console.log('👋 Handling CORS preflight request')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const currentTimestamp = new Date().toISOString()
    console.log(`⏰ Timestamp atual: ${currentTimestamp}`)
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Erro: Configurações do Supabase não encontradas')
      throw new Error('Configurações do Supabase não encontradas')
    }

    console.log('🔑 Inicializando cliente Supabase')
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('📝 Registrando início da execução')
    const { error: logError } = await supabase
      .from('cron_logs')
      .insert([{
        job_name: 'get-follow-up-contacts-job',
        status: 'started',
        execution_time: currentTimestamp
      }])

    if (logError) {
      console.error('❌ Erro ao registrar execução:', logError)
    }

    console.log('🔍 Buscando follow-ups ativos')
    const { data: followUps, error: followUpsError } = await supabase
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id,
          name,
          user_id,
          phone_number,
          connection_status
        )
      `)
      .eq('is_active', true)

    if (followUpsError) {
      console.error('❌ Erro ao buscar follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log(`✅ Encontrados ${followUps?.length || 0} follow-ups ativos`)
    console.log('📊 Follow-ups ativos:', followUps)

    if (!followUps?.length) {
      console.log('ℹ️ Nenhum follow-up ativo encontrado')
      return new Response(
        JSON.stringify({ 
          success: true,
          timestamp: currentTimestamp,
          message: 'Nenhum follow-up ativo encontrado',
          processed: [],
          errors: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const processedFollowUps = []
    const errors = []

    for (const followUp of followUps) {
      try {
        console.log(`🔄 Processando follow-up ID: ${followUp.id}`)
        console.log('Detalhes do follow-up:', JSON.stringify(followUp, null, 2))
        
        if (!followUp.instance?.id) {
          console.log(`⚠️ Follow-up ${followUp.id} não tem instância associada`)
          continue
        }

        console.log(`📱 Status da conexão da instância: ${followUp.instance.connection_status}`)
        if (followUp.instance.connection_status !== 'connected') {
          console.log(`⚠️ Instância ${followUp.instance.name} não está conectada. Status: ${followUp.instance.connection_status}`)
          continue
        }

        console.log('📝 Verificando configuração das mensagens')
        console.log('Tipo de follow-up:', followUp.follow_up_type)
        console.log('Mensagens manuais:', followUp.manual_messages)
        
        if (followUp.follow_up_type === 'manual' && (!followUp.manual_messages?.length)) {
          console.log(`⚠️ Nenhuma mensagem manual configurada para o follow-up: ${followUp.id}`)
          continue
        }

        console.log(`🔍 Buscando contatos para a instância: ${followUp.instance.name}`)
        const { data: contacts, error: contactsError } = await supabase
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .not('TelefoneClientes', 'is', null)

        if (contactsError) {
          console.error('❌ Erro ao buscar contatos:', contactsError)
          throw contactsError
        }

        console.log(`📊 Encontrados ${contacts?.length || 0} contatos para a instância ${followUp.instance.name}`)
        console.log('Primeiros 3 contatos para debug:', contacts?.slice(0, 3))

        if (!contacts?.length) {
          console.log('⚠️ Nenhum contato encontrado para follow-up')
          continue
        }

        for (const contact of contacts) {
          try {
            console.log(`🔄 Processando contato: ${contact.TelefoneClientes}`)
            
            const processingResponse = await fetch(
              'https://vodexhppkasbulogmcqb.supabase.co/functions/v1/process-follow-up',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({
                  contact: {
                    ...contact,
                    followUp: {
                      ...followUp,
                      instance_id: followUp.instance_id,
                      instanceName: followUp.instance.name,
                      userId: followUp.instance.user_id
                    }
                  }
                })
              }
            )

            if (!processingResponse.ok) {
              const errorText = await processingResponse.text()
              console.error('❌ Erro da função process-follow-up:', errorText)
              throw new Error(`Falha ao processar follow-up: ${errorText}`)
            }

            const responseData = await processingResponse.json()
            console.log('✅ Resposta do process-follow-up:', responseData)

            processedFollowUps.push({
              followUpId: followUp.id,
              instanceId: followUp.instance_id,
              contactId: contact.id,
              timestamp: new Date().toISOString()
            })
          } catch (contactError) {
            console.error(`❌ Erro ao processar contato ${contact.id}:`, contactError)
            errors.push({
              followUpId: followUp.id,
              contactId: contact.id,
              error: contactError.message,
              timestamp: new Date().toISOString()
            })
          }
        }

      } catch (error) {
        console.error('❌ Erro ao processar follow-up:', error)
        console.error('Stack do erro:', error.stack)
        errors.push({
          followUpId: followUp.id,
          error: error.message,
          timestamp: new Date().toISOString()
        })
      }
    }

    console.log('📝 Registrando conclusão')
    await supabase
      .from('cron_logs')
      .insert([{
        job_name: 'get-follow-up-contacts-job',
        status: 'completed',
        execution_time: new Date().toISOString()
      }])

    console.log(`✅ Processamento finalizado. Sucesso: ${processedFollowUps.length}, Erros: ${errors.length}`)
    console.log('Follow-ups processados:', processedFollowUps)
    console.log('Erros:', errors)

    return new Response(
      JSON.stringify({ 
        success: true,
        timestamp: currentTimestamp,
        processed: processedFollowUps,
        errors 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro crítico:', error)
    console.error('Stack do erro:', error.stack)
    return new Response(
      JSON.stringify({ 
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
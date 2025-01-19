import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 [DEBUG] Iniciando função get-follow-up-contacts')
  
  if (req.method === 'OPTIONS') {
    console.log('👋 [DEBUG] Tratando requisição CORS preflight')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Credenciais do Supabase não encontradas')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Log inicial
    console.log('📝 [DEBUG] Registrando início da execução')
    const { error: logError } = await supabase
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'iniciado',
        execution_time: new Date().toISOString()
      })

    if (logError) {
      console.error('❌ [ERRO] Falha ao registrar log inicial:', logError)
    }

    // Buscar follow-ups ativos
    console.log('🔍 [DEBUG] Buscando follow-ups ativos')
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
      console.error('❌ [ERRO] Falha ao buscar follow-ups:', followUpsError)
      throw followUpsError
    }

    if (!followUps?.length) {
      console.log('ℹ️ [INFO] Nenhum follow-up ativo encontrado')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum follow-up ativo encontrado',
          processed: [],
          errors: [],
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 [DEBUG] Encontrados ${followUps.length} follow-ups ativos`)

    const processedFollowUps = []
    const errors = []

    for (const followUp of followUps) {
      try {
        console.log(`\n🔄 [DEBUG] Processando follow-up ID: ${followUp.id}`)
        
        if (!followUp.instance?.id) {
          console.log(`⚠️ [AVISO] Follow-up ${followUp.id} não tem instância associada`)
          continue
        }

        if (followUp.instance.connection_status !== 'connected') {
          console.log(`⚠️ [AVISO] Instância ${followUp.instance.name} não está conectada`)
          continue
        }

        // Verificar contatos
        console.log(`🔍 [DEBUG] Buscando contatos para instância: ${followUp.instance.name}`)
        const { data: contacts, error: contactsError } = await supabase
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .not('TelefoneClientes', 'is', null)
          .order('last_message_time', { ascending: true, nullsFirst: true })

        if (contactsError) {
          console.error('❌ [ERRO] Falha ao buscar contatos:', contactsError)
          throw contactsError
        }

        console.log(`📊 [DEBUG] Encontrados ${contacts?.length || 0} contatos para a instância ${followUp.instance.name}`)

        if (!contacts?.length) {
          console.log(`⚠️ [AVISO] Nenhum contato encontrado para follow-up da instância ${followUp.instance.name}`)
          continue
        }

        for (const contact of contacts) {
          try {
            console.log(`\n👤 [DEBUG] Processando contato: ${contact.TelefoneClientes}`)
            
            const processingResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-follow-up`,
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
              console.error('❌ [ERRO] Falha ao processar follow-up:', errorText)
              throw new Error(`Falha ao processar follow-up: ${errorText}`)
            }

            const responseData = await processingResponse.json()
            console.log('✅ [DEBUG] Resposta do processamento:', JSON.stringify(responseData, null, 2))

            // Atualizar último contato
            const { error: updateError } = await supabase
              .from('Users_clientes')
              .update({ last_message_time: new Date().toISOString() })
              .eq('id', contact.id)

            if (updateError) {
              console.error('❌ [ERRO] Falha ao atualizar último contato:', updateError)
            }

            processedFollowUps.push({
              followUpId: followUp.id,
              instanceId: followUp.instance_id,
              contactId: contact.id,
              timestamp: new Date().toISOString()
            })
          } catch (contactError) {
            console.error(`❌ [ERRO] Falha ao processar contato ${contact.id}:`, contactError)
            errors.push({
              followUpId: followUp.id,
              contactId: contact.id,
              error: contactError.message,
              timestamp: new Date().toISOString()
            })
          }
        }
      } catch (error) {
        console.error(`❌ [ERRO] Falha ao processar follow-up ${followUp.id}:`, error)
        errors.push({
          followUpId: followUp.id,
          error: error.message,
          timestamp: new Date().toISOString()
        })
      }
    }

    // Log final de sucesso
    console.log('✅ [DEBUG] Processamento finalizado com sucesso')
    const { error: finalLogError } = await supabase
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'completado',
        execution_time: new Date().toISOString()
      })

    if (finalLogError) {
      console.error('❌ [ERRO] Falha ao registrar log final:', finalLogError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedFollowUps,
        errors,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('❌ [ERRO CRÍTICO]:', error)
    
    try {
      // Log do erro
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      )
      
      await supabase
        .from('cron_logs')
        .insert({
          job_name: 'get-follow-up-contacts',
          status: `erro: ${error.message}`,
          execution_time: new Date().toISOString()
        })
    } catch (logError) {
      console.error('❌ [ERRO] Falha ao registrar erro:', logError)
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Log início da execução
  console.log('🚀 Iniciando processamento de follow-ups')
  
  try {
    // Log execução
    const { data: logData, error: logError } = await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'started'
      })
      .select()
      .single()

    if (logError) {
      console.error('❌ Erro ao registrar início do job:', logError)
      throw logError
    }

    // Buscar follow-ups ativos
    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id, 
          name,
          user_id,
          connection_status,
          phone_number
        )
      `)
      .eq('is_active', true)

    if (followUpsError) {
      console.error('❌ Erro ao buscar follow-ups:', followUpsError)
      throw followUpsError
    }

    if (!followUps?.length) {
      console.log('ℹ️ Nenhum follow-up ativo encontrado')
      await supabaseClient
        .from('cron_logs')
        .update({ 
          status: 'completed - no active follow-ups',
          execution_time: new Date().toISOString()
        })
        .eq('id', logData?.id)

      return new Response(
        JSON.stringify({ success: true, message: 'No active follow-ups' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Configuração da Evolution API ausente')
    }

    const processedContacts = []
    const errors = []

    // Processar cada follow-up
    for (const followUp of followUps) {
      try {
        console.log('📝 Processando follow-up:', {
          id: followUp.id,
          instanceId: followUp.instance_id,
          instanceName: followUp.instance?.name
        })

        if (!followUp.instance?.name) {
          console.error('❌ Nome da instância não encontrado:', followUp.instance_id)
          continue
        }

        // Verificar estado da conexão
        try {
          console.log('🔄 Verificando estado da instância:', followUp.instance.name)
          
          const stateResponse = await fetch(
            `${evolutionApiUrl}/instance/connectionState/${followUp.instance.name}`,
            {
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey,
              }
            }
          )

          if (!stateResponse.ok) {
            const errorText = await stateResponse.text()
            console.error('❌ Erro ao verificar estado da instância:', {
              status: stateResponse.status,
              error: errorText
            })
            continue
          }

          const stateData = await stateResponse.json()
          console.log('Estado da instância:', {
            instance: followUp.instance.name,
            status: stateData?.state
          })

          if (stateData?.state !== 'open') {
            console.warn('⚠️ Instância não conectada, atualizando status:', followUp.instance.id)
            
            await supabaseClient
              .from('evolution_instances')
              .update({
                connection_status: 'disconnected',
                updated_at: new Date().toISOString()
              })
              .eq('id', followUp.instance.id)

            continue
          }

          // Atualizar status como conectado se necessário
          if (followUp.instance.connection_status !== 'connected') {
            await supabaseClient
              .from('evolution_instances')
              .update({
                connection_status: 'connected',
                updated_at: new Date().toISOString()
              })
              .eq('id', followUp.instance.id)
          }

        } catch (error) {
          console.error('❌ Erro ao verificar estado da instância:', error)
          continue
        }

        // Buscar contatos pendentes
        const { data: contacts, error: contactsError } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .is('ConversationId', null)
          .order('created_at', { ascending: true })
          .limit(10)

        if (contactsError) {
          console.error('❌ Erro ao buscar contatos:', contactsError)
          errors.push({
            type: 'contacts_query',
            instanceId: followUp.instance_id,
            error: contactsError
          })
          continue
        }

        if (!contacts?.length) {
          console.log('ℹ️ Nenhum contato pendente encontrado para instância:', followUp.instance_id)
          continue
        }

        console.log('👥 Contatos encontrados:', contacts.length)

        // Processar cada contato
        for (const contact of contacts) {
          try {
            console.log('📱 Processando contato:', {
              id: contact.id,
              phone: contact.TelefoneClientes
            })

            const manualMessages = Array.isArray(followUp.manual_messages) 
              ? followUp.manual_messages 
              : []

            if (!manualMessages.length) {
              console.log('⚠️ Nenhuma mensagem configurada para follow-up:', followUp.id)
              continue
            }

            const firstMessage = manualMessages[0]

            // Validar número de telefone
            const phoneNumber = contact.TelefoneClientes?.replace(/\D/g, '')
            if (!phoneNumber || phoneNumber.length < 10) {
              console.error('❌ Número de telefone inválido:', contact.TelefoneClientes)
              continue
            }

            console.log('📤 Enviando mensagem:', {
              instance: followUp.instance.name,
              phone: phoneNumber,
              message: firstMessage.message
            })

            const evolutionResponse = await fetch(
              `${evolutionApiUrl}/message/sendText/${followUp.instance.name}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': evolutionApiKey,
                },
                body: JSON.stringify({
                  number: phoneNumber,
                  text: firstMessage.message
                })
              }
            )

            if (!evolutionResponse.ok) {
              const errorText = await evolutionResponse.text()
              console.error('❌ Erro ao enviar mensagem:', {
                status: evolutionResponse.status,
                error: errorText
              })
              continue
            }

            const evolutionData = await evolutionResponse.json()
            console.log('✅ Resposta da Evolution API:', evolutionData)

            if (!evolutionData?.key?.id) {
              console.error('❌ Resposta inválida da Evolution API:', evolutionData)
              continue
            }

            // Atualizar status do contato
            await supabaseClient
              .from('Users_clientes')
              .update({
                ConversationId: 'follow-up-sent-0',
                last_message_time: new Date().toISOString()
              })
              .eq('id', contact.id)

            // Registrar mensagem enviada
            await supabaseClient
              .from('chat_messages')
              .insert({
                instance_id: followUp.instance_id,
                user_id: followUp.instance.user_id,
                sender_type: 'follow_up',
                content: firstMessage.message,
                whatsapp_message_id: evolutionData.key?.id
              })

            processedContacts.push({
              id: contact.id,
              phone: phoneNumber,
              status: 'message_sent',
              messageId: evolutionData.key?.id
            })

            console.log('✅ Contato processado com sucesso:', {
              id: contact.id,
              phone: phoneNumber
            })

          } catch (error) {
            console.error('❌ Erro ao processar contato:', error)
            errors.push({
              type: 'contact_processing',
              instanceId: followUp.instance_id,
              contactId: contact.id,
              error
            })
          }
        }
      } catch (error) {
        console.error('❌ Erro ao processar follow-up:', error)
        errors.push({
          type: 'follow_up_processing',
          instanceId: followUp.instance_id,
          error
        })
      }
    }

    // Atualizar log com status final
    const finalStatus = errors.length > 0 
      ? `completed with ${errors.length} errors` 
      : 'completed successfully'

    await supabaseClient
      .from('cron_logs')
      .update({ 
        status: finalStatus,
        execution_time: new Date().toISOString()
      })
      .eq('id', logData?.id)

    console.log('🏁 Processamento concluído:', {
      processed: processedContacts.length,
      errors: errors.length
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Process completed',
        processed: processedContacts,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro crítico:', error)

    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: `error: ${error.message}`,
        execution_time: new Date().toISOString()
      })

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
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

  try {
    console.log('🚀 Iniciando verificação de follow-ups:', new Date().toISOString())
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar instâncias com follow-up ativo
    console.log('📋 Buscando follow-ups ativos...')
    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id,
          name,
          user_id,
          connection_status
        )
      `)
      .eq('is_active', true)

    if (followUpsError) {
      console.error('❌ Erro ao buscar follow-ups:', followUpsError)
      throw followUpsError
    }

    if (!followUps?.length) {
      console.log('ℹ️ Nenhum follow-up ativo encontrado')
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Nenhum follow-up ativo',
          processed: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📋 Follow-ups ativos encontrados:', followUps.length)

    // Para cada follow-up ativo, buscar contatos elegíveis
    const processedContacts = []
    
    for (const followUp of followUps) {
      // Verificar se a instância está conectada
      if (followUp.instance?.connection_status !== 'connected') {
        console.log('⚠️ Instância desconectada, pulando:', followUp.instance?.name)
        continue
      }

      console.log('🔄 Processando follow-up da instância:', followUp.instance?.name, {
        followUpId: followUp.id,
        isActive: followUp.is_active,
        followUpType: followUp.follow_up_type,
        instanceId: followUp.instance_id
      })

      // Buscar contatos que ainda não receberam follow-up ou que estão no meio da sequência
      const { data: contacts, error: contactsError } = await supabaseClient
        .from('Users_clientes')
        .select('*')
        .eq('NomeDaEmpresa', followUp.instance_id)
        .or('ConversationId.is.null,ConversationId.like.follow-up-sent-%')
        .order('last_message_time', { ascending: true })

      if (contactsError) {
        console.error('❌ Erro ao buscar contatos:', contactsError)
        continue
      }

      if (!contacts?.length) {
        console.log('ℹ️ Nenhum contato encontrado para processamento na instância:', followUp.instance?.name)
        continue
      }

      console.log('👥 Contatos encontrados para a instância:', contacts.length)

      // Processar cada contato
      for (const contact of contacts) {
        console.log('👤 Processando contato:', {
          id: contact.id,
          telefone: contact.TelefoneClientes,
          conversationId: contact.ConversationId,
          ultimaMensagem: contact.last_message_time,
          nomeDaEmpresa: contact.NomeDaEmpresa
        })

        try {
          // Determinar o índice da próxima mensagem
          let currentMessageIndex = -1
          if (contact.ConversationId?.startsWith('follow-up-sent-')) {
            currentMessageIndex = parseInt(contact.ConversationId.split('-').pop() || '-1')
          }

          // Verificar se há mais mensagens para enviar
          const manualMessages = Array.isArray(followUp.manual_messages) ? followUp.manual_messages : []
          
          console.log('📝 Status das mensagens:', {
            indiceAtual: currentMessageIndex,
            totalMensagens: manualMessages.length,
            proximaMensagem: currentMessageIndex + 1 < manualMessages.length ? manualMessages[currentMessageIndex + 1] : null
          })

          if (currentMessageIndex + 1 >= manualMessages.length) {
            console.log('✅ Sequência completa para o contato:', contact.id)
            continue
          }

          // Calcular o tempo desde a última mensagem
          const lastMessageTime = new Date(contact.last_message_time || contact.created_at)
          const now = new Date()
          const minutesSinceLastMessage = Math.floor((now.getTime() - lastMessageTime.getTime()) / (1000 * 60))

          // Obter o delay necessário para a próxima mensagem
          const nextMessage = manualMessages[currentMessageIndex + 1]
          if (!nextMessage) {
            console.error('❌ Próxima mensagem não encontrada para o contato:', contact.id)
            continue
          }

          console.log('⏰ Análise de tempo:', {
            ultimaMensagem: lastMessageTime.toISOString(),
            agora: now.toISOString(),
            minutos: minutesSinceLastMessage,
            delayNecessario: nextMessage.delay_minutes,
            podeEnviar: minutesSinceLastMessage >= nextMessage.delay_minutes
          })

          // Verificar se já passou tempo suficiente
          if (minutesSinceLastMessage < nextMessage.delay_minutes) {
            console.log('⏳ Aguardando tempo necessário para próxima mensagem. Faltam:', nextMessage.delay_minutes - minutesSinceLastMessage, 'minutos')
            continue
          }

          console.log('🚀 Iniciando processamento do follow-up para o contato:', contact.id)

          const processResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-follow-up`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                contact: {
                  ...contact,
                  followUp: {
                    ...followUp,
                    instanceName: followUp.instance?.name,
                    userId: followUp.instance?.user_id
                  }
                }
              })
            }
          )

          if (!processResponse.ok) {
            const errorText = await processResponse.text()
            console.error('❌ Erro ao processar follow-up:', {
              status: processResponse.status,
              erro: errorText,
              contactId: contact.id,
              instanceId: followUp.instance_id
            })
            throw new Error(`Error processing follow-up: ${errorText}`)
          }

          const processResult = await processResponse.json()
          console.log('✅ Resultado do processamento:', {
            contactId: contact.id,
            resultado: processResult
          })
          
          processedContacts.push({
            contactId: contact.id,
            success: processResult.success,
            message: processResult.message
          })
        } catch (error) {
          console.error('❌ Erro ao processar contato:', {
            contato: contact.id,
            erro: error.message,
            stack: error.stack
          })
        }
      }
    }

    console.log('✅ Processamento de follow-ups concluído:', {
      totalProcessado: processedContacts.length,
      resultados: processedContacts,
      timestamp: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: processedContacts
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Erro geral no processamento:', {
      mensagem: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
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
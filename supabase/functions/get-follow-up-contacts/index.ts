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
    console.log('🔍 Iniciando busca de contatos para follow-up')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar instâncias com follow-up ativo
    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id,
          name,
          user_id
        )
      `)
      .eq('is_active', true)

    if (followUpsError) {
      console.error('❌ Erro ao buscar follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log('📋 Follow-ups ativos encontrados:', followUps?.length || 0)

    // Para cada follow-up ativo, buscar contatos elegíveis
    const processedContacts = []
    
    for (const followUp of followUps || []) {
      console.log('🔄 Processando follow-up da instância:', followUp.instance?.name)

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

      console.log('👥 Contatos encontrados para a instância:', contacts?.length || 0)

      // Processar cada contato
      for (const contact of contacts || []) {
        console.log('👤 Processando contato:', {
          id: contact.id,
          telefone: contact.TelefoneClientes,
          conversationId: contact.ConversationId,
          ultimaMensagem: contact.last_message_time
        })

        try {
          // Determinar o índice da próxima mensagem
          let currentMessageIndex = -1
          if (contact.ConversationId?.startsWith('follow-up-sent-')) {
            currentMessageIndex = parseInt(contact.ConversationId.split('-').pop() || '-1')
          }

          // Verificar se há mais mensagens para enviar
          const manualMessages = Array.isArray(followUp.manual_messages) ? followUp.manual_messages : []
          if (currentMessageIndex + 1 >= manualMessages.length) {
            console.log('✅ Sequência completa para o contato:', contact.id)
            continue
          }

          // Calcular o tempo desde a última mensagem
          const lastMessageTime = new Date(contact.last_message_time || contact.created_at)
          const now = new Date()
          const minutesSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60)

          // Obter o delay necessário para a próxima mensagem
          const nextMessage = manualMessages[currentMessageIndex + 1]
          if (!nextMessage) {
            console.log('❌ Próxima mensagem não encontrada')
            continue
          }

          console.log('⏰ Análise de tempo:', {
            ultimaMensagem: lastMessageTime,
            agora: now,
            minutos: minutesSinceLastMessage,
            delayNecessario: nextMessage.delay_minutes
          })

          // Verificar se já passou tempo suficiente
          if (minutesSinceLastMessage < nextMessage.delay_minutes) {
            console.log('⏳ Aguardando tempo necessário para próxima mensagem')
            continue
          }

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
            throw new Error(`Error processing follow-up: ${await processResponse.text()}`)
          }

          const processResult = await processResponse.json()
          console.log('✅ Resultado do processamento:', processResult)
          
          processedContacts.push({
            contactId: contact.id,
            success: processResult.success,
            message: processResult.message
          })
        } catch (error) {
          console.error('❌ Erro ao processar contato:', {
            contato: contact.id,
            erro: error.message
          })
        }
      }
    }

    console.log('✅ Processamento de follow-ups concluído:', {
      totalProcessado: processedContacts.length
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: processedContacts
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Erro geral no processamento:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
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
    console.log('Iniciando processamento de follow-ups')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
      console.error('Erro ao buscar follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log(`Encontrados ${followUps?.length || 0} follow-ups ativos`)

    if (!followUps?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum follow-up ativo', processed: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const processedContacts = []
    
    for (const followUp of followUps) {
      console.log(`Processando follow-up para instância ${followUp.instance?.name}`)
      
      if (followUp.instance?.connection_status !== 'connected') {
        console.log(`Instância ${followUp.instance?.name} não está conectada, pulando...`)
        continue
      }

      const { data: contacts, error: contactsError } = await supabaseClient
        .from('Users_clientes')
        .select('*')
        .eq('NomeDaEmpresa', followUp.instance_id)
        .or('ConversationId.is.null,ConversationId.like.follow-up-sent-%')
        .order('last_message_time', { ascending: true })

      if (contactsError) {
        console.error('Erro ao buscar contatos:', contactsError)
        continue
      }

      console.log(`Encontrados ${contacts?.length || 0} contatos para processamento`)

      if (!contacts?.length) {
        console.log('Nenhum contato encontrado para processamento')
        continue
      }

      for (const contact of contacts) {
        try {
          console.log(`Processando contato ${contact.id}`)
          
          let currentMessageIndex = -1
          if (contact.ConversationId?.startsWith('follow-up-sent-')) {
            currentMessageIndex = parseInt(contact.ConversationId.split('-').pop() || '-1')
          }

          const manualMessages = Array.isArray(followUp.manual_messages) ? followUp.manual_messages : []
          
          if (currentMessageIndex + 1 >= manualMessages.length) {
            console.log('Todas as mensagens já foram enviadas para este contato')
            continue
          }

          const lastMessageTime = new Date(contact.last_message_time || contact.created_at)
          const now = new Date()
          const minutesSinceLastMessage = Math.floor((now.getTime() - lastMessageTime.getTime()) / (1000 * 60))
          const nextMessage = manualMessages[currentMessageIndex + 1]
          const minDelay = Math.max(3, nextMessage.delay_minutes || 3)

          console.log('Análise de tempo:', {
            ultimaMensagem: lastMessageTime,
            agora: now,
            minutosDesdeDaUltima: minutesSinceLastMessage,
            atrasoMinimo: minDelay
          })

          if (minutesSinceLastMessage < minDelay) {
            console.log(`Aguardando tempo mínimo (${minDelay} minutos) desde a última mensagem`)
            continue
          }

          const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')
          
          console.log('Enviando mensagem para processamento')
          
          const processResponse = await fetch(
            `${supabaseUrl}/functions/v1/process-follow-up`,
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
            console.error('Erro na resposta do processamento:', errorText)
            throw new Error(`Error processing follow-up: ${errorText}`)
          }

          const processResult = await processResponse.json()
          console.log('Resultado do processamento:', processResult)
          
          processedContacts.push({
            contactId: contact.id,
            success: processResult.success,
            message: processResult.message
          })

        } catch (error) {
          console.error('Erro ao processar contato:', {
            contato: contact.id,
            erro: error.message
          })
        }
      }
    }

    console.log('Processamento concluído:', {
      totalProcessados: processedContacts.length,
      resultados: processedContacts
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: processedContacts
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro ao processar follow-ups:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
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
    console.log('=== INÍCIO DO PROCESSAMENTO DE FOLLOW-UPS ===')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Buscar follow-ups ativos
    console.log('1. Buscando follow-ups ativos...')
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

    console.log(`✅ Encontrados ${followUps?.length || 0} follow-ups ativos`)

    if (!followUps?.length) {
      console.log('ℹ️ Nenhum follow-up ativo encontrado')
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum follow-up ativo', processed: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const processedContacts = []
    
    // 2. Processar cada follow-up
    for (const followUp of followUps) {
      console.log(`\n=== Processando follow-up para instância: ${followUp.instance?.name} ===`)
      
      if (!followUp.instance) {
        console.log('❌ Instância não encontrada, pulando...')
        continue
      }

      if (followUp.instance.connection_status !== 'connected') {
        console.log(`❌ Instância ${followUp.instance.name} não está conectada (status: ${followUp.instance.connection_status}), pulando...`)
        continue
      }

      // 3. Buscar contatos para este follow-up
      console.log('3. Buscando contatos para processamento...')
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

      console.log(`✅ Encontrados ${contacts?.length || 0} contatos para processamento`)

      if (!contacts?.length) {
        console.log('ℹ️ Nenhum contato encontrado para processamento')
        continue
      }

      // 4. Processar cada contato
      for (const contact of contacts) {
        try {
          console.log(`\n--- Processando contato ${contact.id} ---`)
          
          // Verificar índice da mensagem atual
          let currentMessageIndex = -1
          if (contact.ConversationId?.startsWith('follow-up-sent-')) {
            currentMessageIndex = parseInt(contact.ConversationId.split('-').pop() || '-1')
            console.log(`ℹ️ Índice atual da mensagem: ${currentMessageIndex}`)
          }

          // Verificar mensagens disponíveis
          const manualMessages = Array.isArray(followUp.manual_messages) ? followUp.manual_messages : []
          console.log(`ℹ️ Total de mensagens disponíveis: ${manualMessages.length}`)
          
          if (currentMessageIndex + 1 >= manualMessages.length) {
            console.log('ℹ️ Todas as mensagens já foram enviadas para este contato')
            continue
          }

          // Verificar tempo desde última mensagem
          const lastMessageTime = new Date(contact.last_message_time || contact.created_at)
          const now = new Date()
          const minutesSinceLastMessage = Math.floor((now.getTime() - lastMessageTime.getTime()) / (1000 * 60))
          const nextMessage = manualMessages[currentMessageIndex + 1]
          const minDelay = Math.max(3, nextMessage.delay_minutes || 3)

          console.log('⏱️ Análise de tempo:', {
            ultimaMensagem: lastMessageTime.toISOString(),
            agora: now.toISOString(),
            minutosDesdeDaUltima: minutesSinceLastMessage,
            atrasoMinimo: minDelay
          })

          if (minutesSinceLastMessage < minDelay) {
            console.log(`⏳ Aguardando tempo mínimo (${minDelay} minutos) desde a última mensagem`)
            continue
          }

          // 5. Enviar mensagem para processamento
          console.log('5. Enviando mensagem para processamento...')
          const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')
          
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
                    instanceName: followUp.instance.name,
                    userId: followUp.instance.user_id
                  }
                }
              })
            }
          )

          if (!processResponse.ok) {
            const errorText = await processResponse.text()
            console.error('❌ Erro na resposta do processamento:', errorText)
            throw new Error(`Error processing follow-up: ${errorText}`)
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

    console.log('\n=== PROCESSAMENTO CONCLUÍDO ===', {
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
    console.error('❌ Erro ao processar follow-ups:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
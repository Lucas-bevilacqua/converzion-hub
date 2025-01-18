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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Busca follow-ups ativos
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

    if (followUpsError) throw followUpsError

    if (!followUps?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum follow-up ativo', processed: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const processedContacts = []
    
    for (const followUp of followUps) {
      if (followUp.instance?.connection_status !== 'connected') {
        continue
      }

      // Busca contatos que não têm follow-up ou que já receberam alguma mensagem
      const { data: contacts, error: contactsError } = await supabaseClient
        .from('Users_clientes')
        .select('*')
        .eq('NomeDaEmpresa', followUp.instance_id)
        .or('ConversationId.is.null,ConversationId.like.follow-up-sent-%')
        .order('last_message_time', { ascending: true })

      if (contactsError) continue
      if (!contacts?.length) continue

      for (const contact of contacts) {
        try {
          let currentMessageIndex = -1
          if (contact.ConversationId?.startsWith('follow-up-sent-')) {
            currentMessageIndex = parseInt(contact.ConversationId.split('-').pop() || '-1')
          }

          const manualMessages = Array.isArray(followUp.manual_messages) ? followUp.manual_messages : []
          
          if (currentMessageIndex + 1 >= manualMessages.length) {
            continue
          }

          const lastMessageTime = new Date(contact.last_message_time || contact.created_at)
          const now = new Date()
          
          // Converte para UTC para garantir comparação correta
          const utcNow = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            now.getUTCHours(),
            now.getUTCMinutes()
          ))

          const utcLastMessage = new Date(Date.UTC(
            lastMessageTime.getUTCFullYear(),
            lastMessageTime.getUTCMonth(),
            lastMessageTime.getUTCDate(),
            lastMessageTime.getUTCHours(),
            lastMessageTime.getUTCMinutes()
          ))

          const minutesSinceLastMessage = Math.floor((utcNow.getTime() - utcLastMessage.getTime()) / (1000 * 60))
          const nextMessage = manualMessages[currentMessageIndex + 1]
          const minDelay = Math.max(3, nextMessage.delay_minutes || 3)

          if (minutesSinceLastMessage < minDelay) {
            continue
          }

          // Verifica horário de funcionamento
          const currentHour = utcNow.getUTCHours()
          const currentMinute = utcNow.getUTCMinutes()
          const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`
          
          const startTime = followUp.schedule_start_time || '09:00'
          const endTime = followUp.schedule_end_time || '18:00'
          
          if (currentTime < startTime || currentTime > endTime) {
            continue
          }

          // Verifica dias da semana (0 = Domingo, 6 = Sábado)
          const currentDay = utcNow.getUTCDay() + 1 // Converte para 1-7 para match com o banco
          const scheduleDays = followUp.schedule_days || [1,2,3,4,5]
          
          if (!scheduleDays.includes(currentDay)) {
            continue
          }

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
                    instanceName: followUp.instance?.name,
                    userId: followUp.instance?.user_id
                  }
                }
              })
            }
          )

          if (!processResponse.ok) {
            const errorText = await processResponse.text()
            throw new Error(`Error processing follow-up: ${errorText}`)
          }

          const processResult = await processResponse.json()
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

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: processedContacts
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
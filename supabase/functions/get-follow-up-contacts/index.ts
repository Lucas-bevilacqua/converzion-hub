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

  console.log('🚀 Starting follow-up processing')
  
  try {
    // Log execution start
    const { data: logData, error: logError } = await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'started'
      })
      .select()
      .single()

    if (logError) {
      console.error('❌ Error logging job start:', logError)
      throw logError
    }

    // Fetch active follow-ups
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
      console.error('❌ Error fetching follow-ups:', followUpsError)
      throw followUpsError
    }

    if (!followUps?.length) {
      console.log('ℹ️ No active follow-ups found')
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
      throw new Error('Evolution API configuration missing')
    }

    const processedContacts = []
    const errors = []

    // Process each follow-up
    for (const followUp of followUps) {
      try {
        console.log('📝 Processing follow-up:', {
          id: followUp.id,
          instanceId: followUp.instance_id,
          instanceName: followUp.instance?.name
        })

        if (!followUp.instance?.name) {
          console.error('❌ Instance name not found:', followUp.instance_id)
          errors.push({
            type: 'instance_not_found',
            instanceId: followUp.instance_id
          })
          continue
        }

        // Fetch pending contacts
        const { data: contacts, error: contactsError } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .is('ConversationId', null)
          .order('created_at', { ascending: true })
          .limit(10)

        if (contactsError) {
          console.error('❌ Error fetching contacts:', contactsError)
          errors.push({
            type: 'contacts_query_error',
            instanceId: followUp.instance_id,
            error: contactsError
          })
          continue
        }

        if (!contacts?.length) {
          console.log('ℹ️ No pending contacts for instance:', followUp.instance_id)
          continue
        }

        console.log('👥 Found contacts:', contacts.length)

        // Process contacts
        for (const contact of contacts) {
          try {
            console.log('📱 Processing contact:', {
              id: contact.id,
              phone: contact.TelefoneClientes
            })

            const manualMessages = Array.isArray(followUp.manual_messages) 
              ? followUp.manual_messages 
              : []

            if (!manualMessages.length) {
              console.log('⚠️ No messages configured for follow-up:', followUp.id)
              continue
            }

            const firstMessage = manualMessages[0]

            // Validate phone number
            const phoneNumber = contact.TelefoneClientes?.replace(/\D/g, '')
            if (!phoneNumber || phoneNumber.length < 10) {
              console.error('❌ Invalid phone number:', contact.TelefoneClientes)
              errors.push({
                type: 'invalid_phone_number',
                instanceId: followUp.instance_id,
                contactId: contact.id,
                phone: contact.TelefoneClientes
              })
              continue
            }

            console.log('📤 Sending message:', {
              instance: followUp.instance.name,
              phone: phoneNumber,
              messageLength: firstMessage.message.length
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

            const evolutionData = await evolutionResponse.json()
            console.log('✅ Evolution API response:', evolutionData)

            if (!evolutionResponse.ok || !evolutionData?.key?.id) {
              const errorText = JSON.stringify(evolutionData)
              console.error('❌ Message send failed:', {
                status: evolutionResponse.status,
                error: errorText
              })
              errors.push({
                type: 'message_send_failed',
                instanceId: followUp.instance_id,
                contactId: contact.id,
                error: errorText
              })
              continue
            }

            // Update contact status
            const { error: updateError } = await supabaseClient
              .from('Users_clientes')
              .update({
                ConversationId: 'follow-up-sent-0',
                last_message_time: new Date().toISOString()
              })
              .eq('id', contact.id)

            if (updateError) {
              console.error('❌ Error updating contact:', updateError)
              errors.push({
                type: 'contact_update_failed',
                instanceId: followUp.instance_id,
                contactId: contact.id,
                error: updateError
              })
              continue
            }

            // Log message
            const { error: messageLogError } = await supabaseClient
              .from('chat_messages')
              .insert({
                instance_id: followUp.instance_id,
                user_id: followUp.instance.user_id,
                sender_type: 'follow_up',
                content: firstMessage.message,
                whatsapp_message_id: evolutionData.key?.id
              })

            if (messageLogError) {
              console.error('❌ Error logging message:', messageLogError)
              errors.push({
                type: 'message_log_failed',
                instanceId: followUp.instance_id,
                contactId: contact.id,
                error: messageLogError
              })
              continue
            }

            processedContacts.push({
              id: contact.id,
              phone: phoneNumber,
              status: 'message_sent',
              messageId: evolutionData.key?.id
            })

            console.log('✅ Contact processed:', {
              id: contact.id,
              phone: phoneNumber
            })

          } catch (error) {
            console.error('❌ Contact processing error:', error)
            errors.push({
              type: 'contact_processing_error',
              instanceId: followUp.instance_id,
              contactId: contact.id,
              error: error.message
            })
          }
        }
      } catch (error) {
        console.error('❌ Follow-up processing error:', error)
        errors.push({
          type: 'follow_up_processing_error',
          instanceId: followUp.instance_id,
          error: error.message
        })
      }
    }

    // Update final status
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

    console.log('🏁 Processing complete:', {
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
    console.error('❌ Critical error:', error)

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
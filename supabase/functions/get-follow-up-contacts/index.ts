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
    console.log('Edge function started - get-follow-up-contacts')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Supabase client created')

    // Log cron execution
    const { data: logData, error: logError } = await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'started'
      })
      .select()
      .single()

    if (logError) {
      console.error('Error logging cron start:', logError)
      throw logError
    }

    console.log('Fetching active follow-ups...')

    // Buscar follow-ups ativos com informações da instância
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

    console.log('Follow-ups query result:', { 
      followUpsCount: followUps?.length || 0, 
      error: followUpsError 
    })

    if (followUpsError) {
      console.error('Error fetching follow-ups:', followUpsError)
      throw followUpsError
    }

    if (!followUps?.length) {
      console.log('No active follow-ups found')
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

    const processedContacts = []
    const errors = []

    // Process each follow-up
    for (const followUp of followUps) {
      console.log('Processing follow-up:', {
        id: followUp.id,
        instanceId: followUp.instance_id,
        instanceStatus: followUp.instance?.connection_status
      })

      if (!followUp.instance || followUp.instance.connection_status !== 'connected') {
        console.log('Instance not connected, skipping:', followUp.instance_id)
        continue
      }

      try {
        // Buscar contatos pendentes
        const { data: contacts, error: contactsError } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .is('ConversationId', null)
          .order('created_at', { ascending: true })
          .limit(10)

        console.log('Contacts query result:', {
          instanceId: followUp.instance_id,
          contactsFound: contacts?.length,
          error: contactsError
        })

        if (contactsError) {
          console.error('Error fetching contacts:', contactsError)
          errors.push({
            type: 'contacts_query',
            instanceId: followUp.instance_id,
            error: contactsError
          })
          continue
        }

        if (!contacts?.length) {
          console.log('No pending contacts found for instance:', followUp.instance_id)
          continue
        }

        for (const contact of contacts) {
          try {
            const manualMessages = Array.isArray(followUp.manual_messages) 
              ? followUp.manual_messages 
              : []

            if (!manualMessages.length) {
              console.log('No messages configured for follow-up:', followUp.id)
              continue
            }

            const firstMessage = manualMessages[0]
            const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
            const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')

            if (!evolutionApiUrl || !evolutionApiKey) {
              console.error('Missing Evolution API configuration')
              throw new Error('Missing Evolution API configuration')
            }

            console.log('Sending message via Evolution API:', {
              instance: followUp.instance.name,
              contact: contact.TelefoneClientes,
              apiUrl: evolutionApiUrl
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
                  number: contact.TelefoneClientes,
                  text: firstMessage.message
                })
              }
            )

            const evolutionData = await evolutionResponse.json()
            
            if (!evolutionResponse.ok) {
              console.error('Evolution API error:', evolutionData)
              errors.push({
                type: 'evolution_api',
                instanceId: followUp.instance_id,
                contactId: contact.id,
                error: evolutionData
              })
              continue
            }

            console.log('Evolution API response:', evolutionData)

            // Atualizar status do contato
            const { error: updateError } = await supabaseClient
              .from('Users_clientes')
              .update({
                ConversationId: 'follow-up-sent-0',
                last_message_time: new Date().toISOString()
              })
              .eq('id', contact.id)

            if (updateError) {
              console.error('Error updating contact status:', updateError)
              errors.push({
                type: 'contact_update',
                instanceId: followUp.instance_id,
                contactId: contact.id,
                error: updateError
              })
              continue
            }

            // Registrar mensagem enviada
            const { error: messageError } = await supabaseClient
              .from('chat_messages')
              .insert({
                instance_id: followUp.instance_id,
                user_id: followUp.instance.user_id,
                sender_type: 'follow_up',
                content: firstMessage.message,
                whatsapp_message_id: evolutionData.key?.id
              })

            if (messageError) {
              console.error('Error registering message:', messageError)
              errors.push({
                type: 'message_log',
                instanceId: followUp.instance_id,
                contactId: contact.id,
                error: messageError
              })
            }

            processedContacts.push({
              id: contact.id,
              phone: contact.TelefoneClientes,
              status: 'message_sent',
              messageId: evolutionData.key?.id
            })

          } catch (error) {
            console.error('Error processing contact:', error)
            errors.push({
              type: 'contact_processing',
              instanceId: followUp.instance_id,
              contactId: contact.id,
              error
            })
          }
        }
      } catch (error) {
        console.error('Error processing follow-up:', error)
        errors.push({
          type: 'follow_up_processing',
          instanceId: followUp.instance_id,
          error
        })
      }
    }

    // Update cron log with final status
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

    console.log('Follow-up process completed:', {
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
    console.error('Critical error in get-follow-up-contacts:', error)

    // Log error
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
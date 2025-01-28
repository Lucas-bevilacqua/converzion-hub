import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function retryOperation<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      console.log(`🔄 [DEBUG] Retrying operation, ${retries} attempts remaining`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return retryOperation(operation, retries - 1);
    }
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔄 [DEBUG] Starting follow-up processing')
    const { followUpId } = await req.json()
    
    if (!followUpId) {
      console.error('❌ [ERROR] No followUpId provided')
      throw new Error('followUpId is required')
    }

    console.log(`🔄 [DEBUG] Processing follow-up ID: ${followUpId}`)
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch follow-up data with instance details
    const { data: followUp, error: followUpError } = await retryOperation(async () => {
      console.log(`🔍 [DEBUG] Fetching follow-up data for ID: ${followUpId}`)
      return await supabaseClient
        .from('follow_ups')
        .select(`
          *,
          instance:evolution_instances (
            id,
            name,
            connection_status,
            phone_number
          )
        `)
        .eq('id', followUpId)
        .single()
    })

    if (followUpError) {
      console.error('❌ [ERROR] Failed to fetch follow-up:', followUpError)
      throw new Error(`Failed to fetch follow-up: ${followUpError.message}`)
    }

    if (!followUp) {
      console.error('❌ [ERROR] Follow-up not found')
      throw new Error('Follow-up not found')
    }

    console.log(`✅ [DEBUG] Found follow-up:`, followUp)

    // Verify instance connection
    if (!followUp.instance?.connection_status || 
        followUp.instance.connection_status.toLowerCase() !== 'connected') {
      console.error(`❌ [ERROR] Instance ${followUp.instance?.name} not connected`)
      throw new Error(`Instance ${followUp.instance?.name} not connected`)
    }

    // Get contacts for this follow-up
    const { data: contacts, error: contactsError } = await retryOperation(async () => {
      console.log(`🔍 [DEBUG] Fetching contacts for follow-up ${followUpId}`)
      return await supabaseClient
        .from('follow_up_contacts')
        .select('*')
        .eq('follow_up_id', followUpId)
        .eq('status', 'pending')
    })

    if (contactsError) {
      console.error('❌ [ERROR] Failed to fetch contacts:', contactsError)
      throw new Error(`Failed to fetch contacts: ${contactsError.message}`)
    }

    console.log(`✅ [DEBUG] Found ${contacts?.length || 0} contacts to process`)

    // Get follow-up messages ordered by delay
    const { data: messages, error: messagesError } = await retryOperation(async () => {
      console.log(`🔍 [DEBUG] Fetching messages for follow-up ${followUpId}`)
      return await supabaseClient
        .from('follow_up_messages')
        .select('*')
        .eq('follow_up_id', followUpId)
        .order('delay_minutes', { ascending: true })
    })

    if (messagesError) {
      console.error('❌ [ERROR] Failed to fetch messages:', messagesError)
      throw new Error(`Failed to fetch messages: ${messagesError.message}`)
    }

    if (!messages?.length) {
      console.error('❌ [ERROR] No messages configured for follow-up')
      throw new Error('No messages configured for follow-up')
    }

    console.log(`✅ [DEBUG] Found ${messages.length} messages to send`)

    // Process each contact
    const results = []
    for (const contact of (contacts || [])) {
      try {
        console.log(`🔄 [DEBUG] Processing contact:`, contact)

        // Send all messages in sequence through Evolution API
        for (const message of messages) {
          console.log(`📤 [DEBUG] Sending message with delay ${message.delay_minutes} minutes:`, message)
          
          const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '')
          const evolutionApiEndpoint = `${evolutionApiUrl}/message/sendText/${followUp.instance.name}`
          
          console.log(`📤 [DEBUG] Sending to Evolution API:`, {
            endpoint: evolutionApiEndpoint,
            phone: contact.phone,
            message: message.message
          })

          const response = await fetch(evolutionApiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
            },
            body: JSON.stringify({
              number: contact.phone,
              text: message.message
            })
          })

          if (!response.ok) {
            throw new Error(`Evolution API error: ${await response.text()}`)
          }

          // Update contact status after each message
          const { error: updateError } = await supabaseClient
            .from('follow_up_contacts')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', contact.id)

          if (updateError) {
            throw new Error(`Failed to update contact status: ${updateError.message}`)
          }

          // Wait for the configured delay before sending next message
          if (message.delay_minutes > 0) {
            console.log(`⏳ [DEBUG] Waiting ${message.delay_minutes} minutes before next message`)
            await new Promise(resolve => setTimeout(resolve, message.delay_minutes * 60 * 1000))
          }
        }

        results.push({
          contactId: contact.id,
          status: 'success'
        })

      } catch (error) {
        console.error(`❌ [ERROR] Failed to process contact ${contact.id}:`, error)
        results.push({
          contactId: contact.id,
          status: 'error',
          error: error.message
        })
      }
    }

    // Return results
    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('❌ [ERROR] Critical error in follow-up processing:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
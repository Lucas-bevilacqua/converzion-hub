import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Received webhook event from Evolution API')
    const payload = await req.json()
    console.log('Webhook payload:', JSON.stringify(payload, null, 2))

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Handle different event types
    if (payload.event === 'messages.upsert') {
      console.log('Received message event:', payload)
      
      // Extract instance name from the webhook data
      const instanceName = payload.instance?.instanceName
      if (!instanceName) {
        throw new Error('Instance name not found in webhook payload')
      }

      // Get instance details from database
      const { data: instance, error: instanceError } = await supabaseClient
        .from('evolution_instances')
        .select('*')
        .eq('name', instanceName)
        .single()

      if (instanceError) {
        console.error('Error fetching instance:', instanceError)
        throw instanceError
      }

      if (!instance) {
        throw new Error(`Instance not found: ${instanceName}`)
      }

      // Process incoming message if it's from a user (not from the bot)
      if (payload.message?.fromMe === false) {
        console.log('Processing incoming message from user')
        
        // Call chat-with-openai function to process the message
        const { data: response, error } = await supabaseClient.functions.invoke('chat-with-openai', {
          body: {
            message: payload.message.content,
            instanceId: instance.id,
            phoneNumber: payload.message.from
          }
        })

        if (error) {
          console.error('Error processing message:', error)
          throw error
        }

        console.log('Successfully processed message:', response)
      }
    } else if (payload.event === 'connection.update') {
      console.log('Received connection update event:', payload)
      
      // Update instance connection status
      const instanceName = payload.instance?.instanceName
      if (instanceName) {
        const { error: updateError } = await supabaseClient
          .from('evolution_instances')
          .update({ 
            connection_status: payload.state?.status || 'disconnected',
            updated_at: new Date().toISOString()
          })
          .eq('name', instanceName)

        if (updateError) {
          console.error('Error updating instance status:', updateError)
          throw updateError
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
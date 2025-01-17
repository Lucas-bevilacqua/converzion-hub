import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🎯 Webhook received request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  })

  if (req.method === 'OPTIONS') {
    console.log('👉 Handling CORS preflight request')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log('📦 Webhook payload received:', JSON.stringify(payload, null, 2))

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (payload.event === 'messages.upsert') {
      console.log('📨 Processing message event:', {
        content: payload.message?.content,
        from: payload.message?.from,
        instance: payload.instance
      })
      
      if (!payload.message) {
        console.error('❌ No message data in payload')
        throw new Error('No message data in payload')
      }

      const instanceName = payload.instance?.instanceName
      if (!instanceName) {
        console.error('❌ Instance name not found in webhook payload')
        throw new Error('Instance name not found in webhook payload')
      }

      console.log('🔍 Looking for instance:', instanceName)

      const { data: instance, error: instanceError } = await supabaseClient
        .from('evolution_instances')
        .select('*, profiles!inner(*)')
        .eq('name', instanceName)
        .single()

      if (instanceError) {
        console.error('❌ Error fetching instance:', instanceError)
        throw instanceError
      }

      if (!instance) {
        console.error(`❌ Instance not found: ${instanceName}`)
        throw new Error(`Instance not found: ${instanceName}`)
      }

      console.log('✅ Found instance:', {
        id: instance.id,
        name: instance.name,
        userId: instance.user_id
      })

      // Salvar a mensagem no histórico
      if (!payload.message.fromMe) {
        console.log('💾 Saving incoming message to chat history')
        const { error: saveError } = await supabaseClient
          .from('chat_messages')
          .insert([{
            instance_id: instance.id,
            user_id: instance.user_id,
            sender_type: 'user',
            content: payload.message.content
          }])

        if (saveError) {
          console.error('❌ Error saving message:', saveError)
          throw saveError
        }

        // Processar mensagem com LangChain
        console.log('🤖 Processing message with LangChain')
        const { data: response, error } = await supabaseClient.functions.invoke(
          'process-message-with-langchain',
          {
            body: {
              message: payload.message.content,
              instanceId: instance.id,
              phoneNumber: payload.message.from
            }
          }
        )

        if (error) {
          console.error('❌ Error processing message:', error)
          throw error
        }

        console.log('✅ Message processed successfully')
      } else {
        console.log('⏭️ Skipping message from bot (fromMe=true)')
      }
    } else if (payload.event === 'connection.update') {
      console.log('🔌 Processing connection update:', payload)
      
      const instanceName = payload.instance?.instanceName
      if (instanceName) {
        console.log('📝 Updating connection status for instance:', instanceName)
        const { error: updateError } = await supabaseClient
          .from('evolution_instances')
          .update({ 
            connection_status: payload.state?.status || 'disconnected',
            updated_at: new Date().toISOString()
          })
          .eq('name', instanceName)

        if (updateError) {
          console.error('❌ Error updating instance status:', updateError)
          throw updateError
        }

        console.log('✅ Connection status updated successfully')
      }
    } else {
      console.log('⚠️ Unhandled event type:', payload.event)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error processing webhook:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
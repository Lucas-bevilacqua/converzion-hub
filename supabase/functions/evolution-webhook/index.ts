import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('⚡ Evolution Webhook function initialized')

serve(async (req) => {
  console.log('📩 New request received:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  })

  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      console.log('🔄 Handling CORS preflight request')
      return new Response(null, { headers: corsHeaders })
    }

    // Log request headers for debugging
    console.log('📋 Request headers:', Object.fromEntries(req.headers.entries()))

    const rawBody = await req.text()
    console.log('📦 Raw webhook payload:', rawBody)

    let payload
    try {
      payload = JSON.parse(rawBody)
      console.log('✅ Successfully parsed webhook payload:', JSON.stringify(payload, null, 2))
    } catch (parseError) {
      console.error('❌ Failed to parse webhook payload:', parseError)
      throw new Error('Invalid JSON payload')
    }

    console.log('🔍 Initializing Supabase client')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (payload.event === 'messages.upsert') {
      console.log('📨 Processing message event:', {
        content: payload.message?.content,
        from: payload.message?.from,
        instance: payload.instance?.instanceName
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

        console.log('✅ Message saved successfully')

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

        console.log('✅ LangChain response:', response)

        // Enviar resposta via Evolution API
        console.log('📤 Sending response through Evolution API')
        const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
        const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')

        if (!evolutionApiUrl || !evolutionApiKey) {
          console.error('❌ Missing Evolution API configuration:', { 
            hasUrl: !!evolutionApiUrl,
            hasKey: !!evolutionApiKey
          })
          throw new Error('Missing Evolution API configuration')
        }

        console.log('📡 Evolution API config:', { 
          url: evolutionApiUrl,
          hasKey: !!evolutionApiKey,
          instanceName
        })

        const evolutionResponse = await fetch(
          `${evolutionApiUrl}/message/sendText/${instanceName}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
              number: payload.message.from,
              text: response.response || "Desculpe, não consegui processar sua mensagem."
            }),
          }
        )

        const evolutionResponseText = await evolutionResponse.text()
        console.log('📨 Evolution API response:', {
          status: evolutionResponse.status,
          ok: evolutionResponse.ok,
          text: evolutionResponseText
        })

        if (!evolutionResponse.ok) {
          console.error('❌ Evolution API error:', evolutionResponseText)
          throw new Error(`Evolution API error: ${evolutionResponseText}`)
        }

        console.log('✅ Message processed and response sent successfully')
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
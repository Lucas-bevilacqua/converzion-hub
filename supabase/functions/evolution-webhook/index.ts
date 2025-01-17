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
    console.log('👉 Starting to process webhook request')
    const payload = await req.json()
    console.log('📦 Webhook payload received:', JSON.stringify(payload, null, 2))

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (payload.event === 'messages.upsert') {
      console.log('📨 Received message event:', payload)
      
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

      if (payload.message?.fromMe === false) {
        console.log('📥 Processing incoming message:', {
          content: payload.message.content,
          from: payload.message.from,
          instanceId: instance.id
        })

        // Processar mensagem com LangChain
        console.log('🤖 Calling process-message-with-langchain function')
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

        // Enviar resposta via Evolution API
        console.log('📤 Sending response through Evolution API:', response)
        const evolutionResponse = await fetch(
          `${Deno.env.get('EVOLUTION_API_URL')}/message/sendText/${instanceName}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
            },
            body: JSON.stringify({
              number: payload.message.from,
              text: response.response || "Desculpe, não consegui processar sua mensagem."
            }),
          }
        )

        if (!evolutionResponse.ok) {
          const error = await evolutionResponse.text()
          console.error('❌ Evolution API error:', error)
          throw new Error(`Evolution API error: ${error}`)
        }

        console.log('✅ Successfully sent response')
      } else {
        console.log('⏭️ Skipping message from bot (fromMe=true)')
      }
    } else if (payload.event === 'connection.update') {
      console.log('🔌 Received connection update event:', payload)
      
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

        console.log('✅ Successfully updated instance status')
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
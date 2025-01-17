import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WAIT_TIME = 5000; // 5 segundos de espera
const messageQueue = new Map();

console.log('⚡ Evolution Webhook function initialized')

serve(async (req) => {
  console.log('📩 New request received:', {
    method: req.method,
    url: req.url,
  })

  try {
    if (req.method === 'OPTIONS') {
      console.log('🔄 Handling CORS preflight request')
      return new Response(null, { headers: corsHeaders })
    }

    const rawBody = await req.text()
    console.log('📦 Raw webhook payload:', rawBody)

    let payload
    try {
      const webhookData = JSON.parse(rawBody)
      payload = Array.isArray(webhookData) ? webhookData[0].body : webhookData
      console.log('✅ Parsed webhook payload:', JSON.stringify(payload, null, 2))
    } catch (parseError) {
      console.error('❌ Failed to parse webhook payload:', parseError)
      throw new Error('Invalid JSON payload')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (payload.event === 'messages.upsert' || payload.event === 'messages.set') {
      console.log('📨 Processing message event')
      
      if (!payload.data?.message) {
        console.error('❌ No message data in payload')
        throw new Error('No message data in payload')
      }

      const instanceName = payload.instance
      const phoneNumber = payload.data.key.remoteJid
      const messageId = payload.data.key.id // ID único da mensagem do WhatsApp
      
      if (!instanceName) {
        console.error('❌ Instance name not found in webhook payload')
        throw new Error('Instance name not found in webhook payload')
      }

      // Verifica se a mensagem já foi processada
      const { data: existingMessage } = await supabaseClient
        .from('chat_messages')
        .select('id')
        .eq('whatsapp_message_id', messageId)
        .single()

      if (existingMessage) {
        console.log('⚠️ Message already processed, skipping:', messageId)
        return new Response(
          JSON.stringify({ success: true, skipped: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Cria uma chave única para este usuário/instância
      const queueKey = `${instanceName}-${phoneNumber}`
      
      // Limpa qualquer timer existente para este usuário
      if (messageQueue.has(queueKey)) {
        clearTimeout(messageQueue.get(queueKey))
      }
      
      // Define um novo timer
      const timer = setTimeout(async () => {
        console.log(`⏰ Timer expired for ${queueKey}, processing messages...`)
        messageQueue.delete(queueKey)
        
        try {
          // Processa a mensagem após o tempo de espera
          const { data: instance, error: instanceError } = await supabaseClient
            .from('evolution_instances')
            .select('*, profiles!inner(*)')
            .eq('name', instanceName)
            .single()

          if (instanceError) throw instanceError

          // Salva a mensagem no histórico com o ID único do WhatsApp
          if (!payload.data.key.fromMe) {
            await supabaseClient
              .from('chat_messages')
              .insert([{
                instance_id: instance.id,
                user_id: instance.user_id,
                sender_type: 'user',
                content: payload.data.message.conversation || payload.data.message.text || '',
                whatsapp_message_id: messageId
              }])

            // Processa com LangChain
            await supabaseClient.functions.invoke(
              'process-message-with-langchain',
              {
                body: {
                  message: payload.data.message.conversation || payload.data.message.text || '',
                  instanceId: instance.id,
                  phoneNumber: phoneNumber
                }
              }
            )
          }
        } catch (error) {
          console.error('❌ Error processing delayed message:', error)
        }
      }, WAIT_TIME)

      messageQueue.set(queueKey, timer)
      
      console.log(`⏳ Message queued for ${queueKey}, waiting ${WAIT_TIME}ms for more messages...`)
    } else if (payload.event === 'connection.update') {
      console.log('🔌 Processing connection update:', payload)
      
      const instanceName = payload.instance
      if (instanceName) {
        console.log('📝 Updating connection status for instance:', instanceName)
        const { error: updateError } = await supabaseClient
          .from('evolution_instances')
          .update({ 
            connection_status: payload.data?.state?.status || 'disconnected',
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
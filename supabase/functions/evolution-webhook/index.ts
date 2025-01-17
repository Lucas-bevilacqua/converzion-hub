import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabaseClient = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
)

// Cache para armazenar as mensagens em espera
const pendingMessages = new Map()

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log('📥 Received webhook:', JSON.stringify(payload, null, 2))

    // Ignora mensagens que não são de texto
    if (!payload.data?.message?.conversation && !payload.data?.message?.text) {
      console.log('⚠️ Not a text message, skipping')
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ignora mensagens do próprio bot
    if (payload.data.key.fromMe) {
      console.log('⚠️ Message from bot, skipping')
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const instanceName = payload.instance
    const phoneNumber = payload.data.key.remoteJid
    const messageId = payload.data.key.id
    const messageContent = payload.data.message.conversation || payload.data.message.text || ''

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
    const userKey = `${phoneNumber}-${instanceName}`
    
    // Se já existe uma mensagem pendente para este usuário, atualiza o timer
    if (pendingMessages.has(userKey)) {
      clearTimeout(pendingMessages.get(userKey).timer)
    }

    // Cria uma nova promessa para processar a mensagem após o delay
    const processingPromise = new Promise((resolve) => {
      const timer = setTimeout(async () => {
        try {
          console.log('🕒 Processing delayed message for:', userKey)
          
          // Busca a instância
          const { data: instance, error: instanceError } = await supabaseClient
            .from('evolution_instances')
            .select('*')
            .eq('name', instanceName)
            .single()

          if (instanceError) throw instanceError

          // Salva a mensagem no histórico com o ID único do WhatsApp
          await supabaseClient
            .from('chat_messages')
            .insert([{
              instance_id: instance.id,
              user_id: instance.user_id,
              sender_type: 'user',
              content: messageContent,
              whatsapp_message_id: messageId
            }])

          // Processa com LangChain
          const processResponse = await fetch(`${SUPABASE_URL}/functions/v1/process-message-with-langchain`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              instanceId: instance.id,
              message: messageContent,
              phoneNumber
            })
          })

          if (!processResponse.ok) {
            throw new Error(`Error processing message: ${processResponse.statusText}`)
          }

          resolve({
            success: true,
            message: 'Message processed successfully'
          })
        } catch (error) {
          console.error('❌ Error processing message:', error)
          resolve({
            success: false,
            error: error.message
          })
        } finally {
          // Remove a mensagem do cache após processamento
          pendingMessages.delete(userKey)
        }
      }, 5000) // 5 segundos de delay

      // Armazena o timer e a promessa no cache
      pendingMessages.set(userKey, {
        timer,
        promise: processingPromise
      })
    })

    // Aguarda o processamento da mensagem
    const result = await processingPromise

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
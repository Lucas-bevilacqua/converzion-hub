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

function cleanPhoneNumber(remoteJid: string): string {
  console.log('📱 Original remoteJid:', remoteJid)
  
  // Extrai apenas o número antes do @
  const rawNumber = remoteJid.split('@')[0]
  console.log('📱 Número extraído antes do @:', rawNumber)
  
  // Remove caracteres não numéricos
  let cleanNumber = rawNumber.replace(/\D/g, '')
  console.log('📱 Número após remover não-numéricos:', cleanNumber)

  // Se começar com 55 e tiver mais de 12 dígitos, remove o primeiro 55
  if (cleanNumber.startsWith('55') && cleanNumber.length > 12) {
    cleanNumber = cleanNumber.substring(2)
    console.log('📱 Número após remover 55 inicial:', cleanNumber)
  }

  return cleanNumber
}

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
    const phoneNumber = cleanPhoneNumber(payload.data.key.remoteJid)
    const messageId = payload.data.key.id
    const messageContent = payload.data.message.conversation || payload.data.message.text || ''

    console.log('📱 Processando mensagem:', {
      instanceName,
      phoneNumber,
      messageId,
      messageContent: messageContent.substring(0, 50) + '...'
    })

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

    // Busca a instância
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*')
      .eq('name', instanceName)
      .single()

    if (instanceError) {
      console.error('❌ Error fetching instance:', instanceError)
      throw instanceError
    }

    // Atualiza o último tempo de mensagem do cliente
    const { error: clientError } = await supabaseClient
      .from('Users_clientes')
      .upsert({
        TelefoneClientes: phoneNumber,
        NomeDaEmpresa: instance.id,
        last_message_time: new Date().toISOString()
      }, {
        onConflict: 'TelefoneClientes'
      })

    if (clientError) {
      console.error('❌ Error updating client:', clientError)
      throw clientError
    }

    // Salva a mensagem do usuário
    const { error: saveError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: instance.id,
        user_id: instance.user_id,
        sender_type: 'user',
        content: messageContent,
        whatsapp_message_id: messageId
      })

    if (saveError) {
      console.error('❌ Error saving message:', saveError)
      throw saveError
    }

    // Processa com LangChain e envia resposta automaticamente
    console.log('🤖 Processing message with LangChain...')
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
      const error = await processResponse.text()
      console.error('❌ Error processing message:', error)
      throw new Error(`Error processing message: ${error}`)
    }

    const result = await processResponse.json()
    console.log('✅ Message processed successfully:', result)

    return new Response(
      JSON.stringify({ success: true }),
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
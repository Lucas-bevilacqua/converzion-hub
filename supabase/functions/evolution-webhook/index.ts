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
    // Extrai o número do telefone do remoteJid (formato: número@s.whatsapp.net)
    const rawPhoneNumber = payload.data.key.remoteJid.split('@')[0]
    
    // Função auxiliar para limpar o número
    const cleanPhoneNumber = (number: string) => {
      console.log('🔍 Cleaning phone number:', {
        input: number,
        step1: number.replace(/\D/g, ''),
      })

      // Remove qualquer caractere que não seja número
      let cleaned = number.replace(/\D/g, '')
      
      console.log('🔍 After removing non-digits:', cleaned)

      // Se começar com 55 duplicado (ex: 555496...), remove o primeiro 55
      if (cleaned.startsWith('5554')) {
        cleaned = cleaned.substring(2)
        console.log('🔍 Number started with 5554, after removing first 55:', cleaned)
      }
      // Se começar com 55 do Brasil e não for um caso de 5554, remove também
      else if (cleaned.startsWith('55')) {
        cleaned = cleaned.substring(2)
        console.log('🔍 Number started with 55, after removing:', cleaned)
      }

      console.log('🔍 Final cleaned number:', cleaned)
      return cleaned
    }

    const phoneNumber = cleanPhoneNumber(rawPhoneNumber)
    
    console.log('📱 Processing message from:', {
      originalNumber: rawPhoneNumber,
      cleanedNumber: phoneNumber,
      remoteJid: payload.data.key.remoteJid,
      processingSteps: {
        rawInput: rawPhoneNumber,
        afterCleaning: phoneNumber
      }
    })
    
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

    console.log('📝 Saving contact:', {
      phoneNumber,
      instanceId: instance.id,
      tableName: 'users_clientes'
    })

    // Atualiza o último tempo de mensagem do cliente
    const { error: clientError } = await supabaseClient
      .from('users_clientes')
      .upsert({
        telefoneclientes: phoneNumber,
        nomedaempresa: instance.id,
        last_message_time: new Date().toISOString()
      }, {
        onConflict: 'telefoneclientes'
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
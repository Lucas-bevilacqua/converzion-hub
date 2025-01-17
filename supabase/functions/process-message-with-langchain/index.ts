import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('⚡ Process Message with OpenAI function initialized')

async function splitAndSendMessage(message: string, instanceName: string, phoneNumber: string, evolutionApiUrl: string, evolutionApiKey: string) {
  // Divide a mensagem em frases usando pontuação como delimitador
  const sentences = message.match(/[^.!?]+[.!?]+/g) || [message];
  
  console.log(`🔄 Dividindo mensagem em ${sentences.length} partes`)
  
  for (const sentence of sentences) {
    // Adiciona um pequeno delay aleatório entre as mensagens (1-3 segundos)
    const delay = Math.floor(Math.random() * 2000) + 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    console.log(`📤 Enviando parte da mensagem: ${sentence.substring(0, 50)}...`)
    
    const evolutionResponse = await fetch(
      `${evolutionApiUrl}/message/sendText/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({
          number: phoneNumber,
          text: sentence.trim()
        }),
      }
    )

    if (!evolutionResponse.ok) {
      const error = await evolutionResponse.text()
      console.error(`❌ Erro ao enviar parte da mensagem: ${error}`)
      throw new Error(`Evolution API error: ${error}`)
    }
    
    console.log('✅ Parte da mensagem enviada com sucesso')
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { message, instanceId, phoneNumber } = await req.json()
    console.log('📩 Received request:', { message, instanceId, phoneNumber })

    if (!message || !instanceId || !phoneNumber) {
      console.error('❌ Missing required parameters')
      throw new Error('Message, instanceId and phoneNumber are required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔍 Fetching instance data...')
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*, profiles!inner(*)')
      .eq('id', instanceId)
      .single()

    if (instanceError) {
      console.error('❌ Error fetching instance:', instanceError)
      throw instanceError
    }

    console.log('✅ Instance fetched:', instance)

    console.log('🔍 Fetching chat history...')
    const { data: chatHistory, error: chatError } = await supabaseClient
      .from('chat_messages')
      .select('*')
      .eq('instance_id', instanceId)
      .eq('user_id', instance.user_id)
      .order('created_at', { ascending: true })
      .limit(10)

    if (chatError) {
      console.error('❌ Error fetching chat history:', chatError)
      throw chatError
    }
    console.log('✅ Chat history fetched, count:', chatHistory?.length)

    console.log('💾 Saving user message...')
    const { error: saveError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: instanceId,
        user_id: instance.user_id,
        sender_type: 'user',
        content: message
      })

    if (saveError) {
      console.error('❌ Error saving user message:', saveError)
      throw saveError
    }
    console.log('✅ User message saved successfully')

    const messages = [
      { role: 'system', content: instance.system_prompt || "You are a helpful AI assistant." }
    ]

    if (chatHistory) {
      chatHistory.forEach((msg) => {
        messages.push({
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: msg.content
        })
      })
    }

    messages.push({ role: 'user', content: message })
    console.log('🤖 Prepared messages for OpenAI, count:', messages.length)

    console.log('🔄 Sending request to OpenAI...')
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.7,
      }),
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      console.error('❌ OpenAI API error:', error)
      throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await openaiResponse.json()
    const aiResponse = data.choices[0].message.content
    console.log('✅ Received AI response:', aiResponse.substring(0, 100) + '...')

    console.log('💾 Saving AI response...')
    const { error: saveResponseError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: instanceId,
        user_id: instance.user_id,
        sender_type: 'assistant',
        content: aiResponse
      })

    if (saveResponseError) {
      console.error('❌ Error saving AI response:', saveResponseError)
      throw saveResponseError
    }
    console.log('✅ AI response saved successfully')

    // Clean and normalize the Evolution API URL
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/+$/, '') || ''
    console.log('📤 Iniciando envio fracionado da mensagem...')
    
    await splitAndSendMessage(
      aiResponse,
      instance.name,
      phoneNumber,
      evolutionApiUrl,
      Deno.env.get('EVOLUTION_API_KEY') || ''
    )

    console.log('🎉 Function completed successfully')
    return new Response(
      JSON.stringify({ 
        success: true,
        response: aiResponse
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Function error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
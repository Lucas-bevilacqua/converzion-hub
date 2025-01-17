import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('Function started - Received request')

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { message, instanceId, phoneNumber } = await req.json()
    console.log('Received parameters:', { message, instanceId, phoneNumber })

    if (!message || !instanceId || !phoneNumber) {
      console.error('Missing required parameters')
      throw new Error('Message, instanceId and phoneNumber are required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    console.log('Supabase client created')

    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*, profiles!inner(*)')
      .eq('id', instanceId)
      .single()

    if (instanceError) {
      console.error('Error fetching instance:', instanceError)
      throw instanceError
    }
    console.log('Instance fetched:', instance)

    const { data: chatHistory, error: chatError } = await supabaseClient
      .from('chat_messages')
      .select('*')
      .eq('instance_id', instanceId)
      .eq('user_id', instance.user_id)
      .order('created_at', { ascending: true })
      .limit(10)

    if (chatError) {
      console.error('Error fetching chat history:', chatError)
      throw chatError
    }
    console.log('Chat history fetched, count:', chatHistory?.length)

    const { error: saveError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: instanceId,
        user_id: instance.user_id,
        sender_type: 'user',
        content: message
      })

    if (saveError) {
      console.error('Error saving user message:', saveError)
      throw saveError
    }
    console.log('User message saved successfully')

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
    console.log('Prepared messages for OpenAI, count:', messages.length)

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: messages,
        temperature: 0.7,
      }),
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      console.error('OpenAI API error:', error)
      throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await openaiResponse.json()
    const aiResponse = data.choices[0].message.content
    console.log('Received AI response:', aiResponse.substring(0, 100) + '...')

    const evolutionResponse = await fetch(`${Deno.env.get('EVOLUTION_API_URL')}/message/sendText/${instance.name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: aiResponse
      }),
    })

    if (!evolutionResponse.ok) {
      const error = await evolutionResponse.text()
      console.error('Evolution API error:', error)
      throw new Error(`Evolution API error: ${error}`)
    }

    const evolutionData = await evolutionResponse.json()
    console.log('Evolution API response:', evolutionData)

    const { error: saveResponseError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: instanceId,
        user_id: instance.user_id,
        sender_type: 'assistant',
        content: aiResponse
      })

    if (saveResponseError) {
      console.error('Error saving AI response:', saveResponseError)
      throw saveResponseError
    }
    console.log('AI response saved successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        response: aiResponse,
        evolutionResponse: evolutionData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
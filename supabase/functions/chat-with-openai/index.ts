import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { message, instanceId, phoneNumber } = await req.json()
    console.log('Received webhook request:', { message, instanceId, phoneNumber })

    if (!message || !instanceId || !phoneNumber) {
      throw new Error('Message, instanceId and phoneNumber are required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get instance details to check system prompt
    console.log('Fetching instance details for ID:', instanceId)
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*, profiles!inner(*)')
      .eq('id', instanceId)
      .single()

    if (instanceError) {
      console.error('Error fetching instance:', instanceError)
      throw instanceError
    }

    console.log('Instance found:', {
      instanceId: instance.id,
      instanceName: instance.name,
      userId: instance.user_id,
      userName: instance.profiles?.full_name
    })

    // Get recent chat history
    console.log('Fetching recent chat history')
    const { data: chatHistory, error: chatError } = await supabaseClient
      .from('chat_messages')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: true })
      .limit(10)

    if (chatError) {
      console.error('Error fetching chat history:', chatError)
      throw chatError
    }

    // Save the new user message
    console.log('Saving user message to chat history')
    const { error: saveError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: instanceId,
        user_id: instance.user_id,
        sender_type: 'user',
        content: message
      })

    if (saveError) {
      console.error('Error saving message:', saveError)
      throw saveError
    }

    // Prepare messages array for OpenAI
    const messages = [
      { role: 'system', content: instance.system_prompt || "You are a helpful AI assistant." }
    ]

    // Add chat history to context
    if (chatHistory) {
      chatHistory.forEach((msg) => {
        messages.push({
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: msg.content
        })
      })
    }

    // Add current message
    messages.push({ role: 'user', content: message })

    console.log('Sending request to OpenAI with model gpt-4o-mini')
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
    console.log('Generated response:', aiResponse)

    // Send response back through Evolution API
    console.log('Sending response through Evolution API')
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

    // Save the AI response to chat history
    console.log('Saving AI response to chat history')
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

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in chat-with-openai:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
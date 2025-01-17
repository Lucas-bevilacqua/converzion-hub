import "https://deno.land/x/xhr@0.1.0/mod.ts"
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
    const { 
      instanceId, 
      instanceName, 
      userId, 
      delayMinutes, 
      maxAttempts, 
      stopOnReply, 
      stopKeywords, 
      systemPrompt,
      skipInitialMessage 
    } = await req.json()

    console.log('Processing AI follow-up:', {
      instanceId,
      instanceName,
      skipInitialMessage
    })

    // If skipInitialMessage is true, just configure the follow-up without sending a message
    if (skipInitialMessage) {
      console.log('Skipping initial message as requested')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Follow-up configured successfully, initial message skipped' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get chat history for context
    const { data: chatHistory, error: chatError } = await supabaseClient
      .from('chat_messages')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (chatError) {
      console.error('❌ Error fetching chat history:', chatError)
      throw chatError
    }

    // Prepare context for AI
    let contextMessages = []
    
    if (chatHistory && chatHistory.length > 0) {
      console.log('📝 Using existing chat history for context')
      contextMessages = chatHistory.map(msg => ({
        role: msg.sender_type === 'user' ? 'user' : 'assistant',
        content: msg.content
      })).reverse()
    }

    // Add system prompt if provided
    if (systemPrompt) {
      contextMessages.unshift({
        role: 'system',
        content: systemPrompt
      })
    } else {
      // Default system prompt in Portuguese
      contextMessages.unshift({
        role: 'system',
        content: 'Você é um assistente gerando uma mensagem de follow-up em português. Mantenha a mensagem amigável, profissional e concisa.'
      })
    }

    // Add a user prompt to generate the follow-up message
    contextMessages.push({
      role: 'user',
      content: 'Gere uma mensagem de follow-up para um cliente. A mensagem deve ser envolvente mas breve. Não mencione horários ou datas específicas.'
    })

    console.log('🤖 Generating AI message with context:', contextMessages)

    // Generate message with OpenAI
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: contextMessages,
        temperature: 0.7,
      }),
    })

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text()
      console.error('❌ OpenAI API error:', error)
      throw new Error(`OpenAI API error: ${error}`)
    }

    const aiData = await openAIResponse.json()
    const message = aiData.choices[0].message.content
    console.log('✅ AI message generated:', message)

    return new Response(
      JSON.stringify({ success: true, message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in process-ai-follow-up:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

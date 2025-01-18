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

    console.log('Configurando follow-up de IA:', {
      instanceId,
      instanceName,
      userId,
      delayMinutes,
      maxAttempts,
      stopOnReply,
      stopKeywords,
      systemPrompt
    })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar histórico de mensagens
    const { data: chatHistory, error: chatError } = await supabaseClient
      .from('chat_messages')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: true })
      .limit(10)

    if (chatError) {
      console.error('Erro ao buscar histórico:', chatError)
      throw chatError
    }

    // Preparar mensagens para a IA
    const messages = [
      { 
        role: 'system', 
        content: systemPrompt || "Você é um assistente prestativo que gera mensagens de follow-up naturais e contextualizadas." 
      }
    ]

    // Adicionar histórico de conversa
    if (chatHistory) {
      chatHistory.forEach(msg => {
        messages.push({
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: msg.content
        })
      })
    }

    // Adicionar instrução específica para follow-up
    messages.push({ 
      role: 'user', 
      content: 'Por favor, gere uma mensagem de follow-up apropriada para esta conversa. A mensagem deve ser natural e contextualizada com base no histórico.'
    })

    console.log('Enviando requisição para OpenAI com mensagens:', messages)

    // Gerar resposta com OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
      }),
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      console.error('Erro na API da OpenAI:', error)
      throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await openaiResponse.json()
    const followUpMessage = data.choices[0].message.content

    console.log('Mensagem de follow-up gerada:', followUpMessage)

    // Enviar mensagem via Evolution API
    const evolutionResponse = await fetch(
      `${Deno.env.get('EVOLUTION_API_URL')}/message/sendText/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
        },
        body: JSON.stringify({
          number: phoneNumber,
          text: followUpMessage
        }),
      }
    )

    if (!evolutionResponse.ok) {
      const error = await evolutionResponse.text()
      console.error('Erro ao enviar mensagem:', error)
      throw new Error(`Evolution API error: ${error}`)
    }

    const evolutionData = await evolutionResponse.json()
    console.log('Resposta da Evolution API:', evolutionData)

    // Salvar mensagem no histórico
    const { error: saveError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: instanceId,
        user_id: userId,
        sender_type: 'follow_up',
        content: followUpMessage
      })

    if (saveError) {
      console.error('Erro ao salvar mensagem:', saveError)
      throw saveError
    }

    console.log('Follow-up processado com sucesso')
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Follow-up processado e enviado com sucesso',
        followUpMessage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro ao processar follow-up:', error)
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
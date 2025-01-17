import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, instanceName, userId, delayMinutes, maxAttempts, stopOnReply, stopKeywords } = await req.json();
    console.log('📩 Processing AI follow-up for instance:', instanceId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get chat history for context
    const { data: chatHistory, error: chatError } = await supabaseClient
      .from('chat_messages')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (chatError) {
      console.error('❌ Error fetching chat history:', chatError);
      throw chatError;
    }

    // Prepare context for AI
    const contextMessages = chatHistory?.map(msg => ({
      role: msg.sender_type === 'user' ? 'user' : 'assistant',
      content: msg.content
    })) || [];

    // Generate message with OpenAI
    console.log('🤖 Generating AI message...');
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um assistente que gera mensagens de follow-up personalizadas e naturais para clientes que não responderam.'
          },
          ...contextMessages,
          { 
            role: 'user', 
            content: `Por favor, gere uma mensagem de follow up para o cliente. 
                     A mensagem deve ser amigável e profissional, considerando o histórico da conversa.
                     Mantenha a mensagem curta e direta.`
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text();
      console.error('❌ OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error}`);
    }

    const aiData = await openAIResponse.json();
    const message = aiData.choices[0].message.content;
    console.log('✅ AI message generated:', message);

    // Send message via Evolution API
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const evolutionApiEndpoint = `${evolutionApiUrl}/message/sendText/${instanceName}`;
    
    console.log('🔗 Evolution API endpoint:', evolutionApiEndpoint);
    
    const evolutionResponse = await fetch(evolutionApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
      },
      body: JSON.stringify({
        number: chatHistory[0]?.phone_number,
        text: message
      }),
    });

    if (!evolutionResponse.ok) {
      const error = await evolutionResponse.text();
      console.error('❌ Evolution API error:', error);
      throw new Error(`Evolution API error: ${error}`);
    }

    const evolutionData = await evolutionResponse.json();
    console.log('✅ Message sent:', evolutionData);

    // Save message in chat history
    const { error: chatSaveError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: instanceId,
        user_id: userId,
        sender_type: 'assistant',
        content: message
      });

    if (chatSaveError) {
      console.error('❌ Error saving message to chat history:', chatSaveError);
      throw chatSaveError;
    }

    console.log('✅ AI follow-up processed successfully');

    return new Response(
      JSON.stringify({ success: true, message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error processing AI follow-up:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
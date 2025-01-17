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
    const { message, instanceId, phoneNumber } = await req.json();
    console.log('📩 Received message:', { message, instanceId, phoneNumber });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get instance data
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*, profiles!inner(*)')
      .eq('id', instanceId)
      .maybeSingle();

    if (instanceError) {
      console.error('❌ Instance error:', instanceError);
      throw instanceError;
    }

    // Get chat history
    const { data: chatHistory, error: chatError } = await supabaseClient
      .from('chat_messages')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: true })
      .limit(10);

    if (chatError) {
      console.error('❌ Chat history error:', chatError);
      throw chatError;
    }

    // Save user message
    const { error: saveError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: instanceId,
        user_id: instance.user_id,
        sender_type: 'user',
        content: message
      });

    if (saveError) {
      console.error('❌ Error saving user message:', saveError);
      throw saveError;
    }

    // Prepare messages for OpenAI
    const messages = [
      { 
        role: 'system', 
        content: instance?.system_prompt || "Você é um assistente prestativo que responde de forma natural e amigável." 
      },
      ...chatHistory?.map(msg => ({
        role: msg.sender_type === 'user' ? 'user' : 'assistant',
        content: msg.content
      })) || [],
      { role: 'user', content: message }
    ];

    console.log('🤖 Sending request to OpenAI');
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
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('❌ OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await openaiResponse.json();
    const aiResponse = data.choices[0].message.content;
    console.log('✅ Received AI response:', aiResponse);

    // Save AI response
    const { error: saveResponseError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: instanceId,
        user_id: instance.user_id,
        sender_type: 'assistant',
        content: aiResponse
      });

    if (saveResponseError) {
      console.error('❌ Error saving AI response:', saveResponseError);
      throw saveResponseError;
    }

    // Send through Evolution API
    console.log('📤 Sending message through Evolution API');
    const evolutionResponse = await fetch(
      `${Deno.env.get('EVOLUTION_API_URL')}/message/sendText/${instance.name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
        },
        body: JSON.stringify({
          number: phoneNumber,
          text: aiResponse
        }),
      }
    );

    if (!evolutionResponse.ok) {
      const error = await evolutionResponse.text();
      console.error('❌ Evolution API error:', error);
      throw new Error(`Evolution API error: ${error}`);
    }

    const evolutionData = await evolutionResponse.json();
    console.log('✅ Evolution API response:', evolutionData);

    return new Response(
      JSON.stringify({ 
        success: true,
        response: aiResponse
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
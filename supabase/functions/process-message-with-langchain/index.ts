import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TYPING_DELAY_PER_CHAR = 50; // ms per character for typing simulation
const MIN_RESPONSE_DELAY = 2000; // minimum 2 seconds delay
const MESSAGE_ACCUMULATION_TIME = 10000; // 10 seconds to accumulate messages

const messageQueue = new Map<string, {
  messages: { role: string; content: string }[];
  lastUpdate: number;
}>();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, instanceId, phoneNumber } = await req.json();
    console.log('📩 Received message:', { message, instanceId, phoneNumber });

    // Initialize or get queue for this conversation
    const queueKey = `${instanceId}-${phoneNumber}`;
    const now = Date.now();
    
    if (!messageQueue.has(queueKey)) {
      messageQueue.set(queueKey, {
        messages: [],
        lastUpdate: now
      });
    }

    const queue = messageQueue.get(queueKey)!;
    queue.messages.push({ role: 'user', content: message });
    queue.lastUpdate = now;

    // Check if we should process messages (if enough time has passed)
    if (now - queue.lastUpdate < MESSAGE_ACCUMULATION_TIME) {
      console.log('⏳ Accumulating messages, waiting more time...');
      return new Response(JSON.stringify({ 
        status: 'accumulating',
        message: 'Messages are being accumulated before processing'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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

    if (instanceError) throw instanceError;

    // Get chat history
    const { data: chatHistory, error: chatError } = await supabaseClient
      .from('chat_messages')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: true })
      .limit(10);

    if (chatError) throw chatError;

    // Prepare messages for OpenAI
    const messages = [
      { 
        role: 'system', 
        content: instance?.system_prompt || "Você é um assistente prestativo que responde de forma natural e amigável. Espere alguns segundos antes de responder para simular uma conversa mais natural." 
      },
      ...chatHistory?.map(msg => ({
        role: msg.sender_type === 'user' ? 'user' : 'assistant',
        content: msg.content
      })) || [],
      ...queue.messages // Add accumulated messages
    ];

    // Get OpenAI response
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
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await openaiResponse.json();
    const aiResponse = data.choices[0].message.content;

    // Calculate delay based on message length
    const responseDelay = Math.max(
      MIN_RESPONSE_DELAY,
      aiResponse.length * TYPING_DELAY_PER_CHAR
    );
    
    await new Promise(resolve => setTimeout(resolve, responseDelay));

    // Save all accumulated messages
    for (const queuedMsg of queue.messages) {
      await supabaseClient
        .from('chat_messages')
        .insert({
          instance_id: instanceId,
          user_id: instance.user_id,
          sender_type: 'user',
          content: queuedMsg.content
        });
    }

    // Save AI response
    await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: instanceId,
        user_id: instance.user_id,
        sender_type: 'assistant',
        content: aiResponse
      });

    // Clear queue after processing
    messageQueue.delete(queueKey);

    // Send response through Evolution API
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
      throw new Error(`Evolution API error: ${error}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        response: aiResponse
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
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
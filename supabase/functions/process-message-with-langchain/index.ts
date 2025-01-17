import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reduced accumulation time to 3 seconds for better responsiveness
const MESSAGE_ACCUMULATION_TIME = 3000; // 3 seconds

const messageQueue = new Map<string, {
  messages: { role: string; content: string }[];
  lastUpdate: number;
  processing: boolean;
}>();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, instanceId, phoneNumber } = await req.json();
    console.log('📩 Received message:', { message, instanceId, phoneNumber });

    // Create queue key
    const queueKey = `${instanceId}-${phoneNumber}`;
    const now = Date.now();
    
    // Initialize or update queue
    if (!messageQueue.has(queueKey)) {
      messageQueue.set(queueKey, {
        messages: [],
        lastUpdate: now,
        processing: false
      });
    }

    const queue = messageQueue.get(queueKey)!;
    queue.messages.push({ role: 'user', content: message });
    queue.lastUpdate = now;

    // If already processing, return accumulating status
    if (queue.processing) {
      console.log('⏳ Already processing messages for:', queueKey);
      return new Response(JSON.stringify({ 
        status: 'accumulating',
        message: 'Messages are being accumulated before processing'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if enough time has passed since last message
    const timeSinceLastUpdate = now - queue.lastUpdate;
    if (timeSinceLastUpdate < MESSAGE_ACCUMULATION_TIME) {
      console.log('⏳ Accumulating messages for:', queueKey);
      return new Response(JSON.stringify({ 
        status: 'accumulating',
        message: 'Messages are being accumulated before processing'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mark as processing to prevent duplicate processing
    queue.processing = true;

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
        content: instance?.system_prompt || "Você é um assistente prestativo que responde de forma natural e amigável." 
      },
      ...chatHistory?.map(msg => ({
        role: msg.sender_type === 'user' ? 'user' : 'assistant',
        content: msg.content
      })) || [],
      ...queue.messages // Add accumulated messages
    ];

    // Get OpenAI response
    console.log('🤖 Sending request to OpenAI with messages:', messages);
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
    console.log('✅ Received AI response:', aiResponse);

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

    // Send through Evolution API
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

    // Clear queue after successful processing
    messageQueue.delete(queueKey);

    return new Response(
      JSON.stringify({ 
        success: true,
        response: aiResponse
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
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
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reduced to 1.5 seconds for faster response
const MESSAGE_ACCUMULATION_TIME = 1500;

// Global cleanup interval to prevent memory leaks
const CLEANUP_INTERVAL = 60000; // 1 minute

const messageQueue = new Map<string, {
  messages: { role: string; content: string }[];
  lastUpdate: number;
  processing: boolean;
  attempts: number;
}>();

// Cleanup old queues periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, queue] of messageQueue.entries()) {
    if (now - queue.lastUpdate > CLEANUP_INTERVAL) {
      console.log('🧹 Cleaning up old queue:', key);
      messageQueue.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, instanceId, phoneNumber } = await req.json();
    console.log('📩 Received message:', { message, instanceId, phoneNumber });

    const queueKey = `${instanceId}-${phoneNumber}`;
    const now = Date.now();
    
    if (!messageQueue.has(queueKey)) {
      messageQueue.set(queueKey, {
        messages: [],
        lastUpdate: now,
        processing: false,
        attempts: 0
      });
    }

    const queue = messageQueue.get(queueKey)!;

    // Reset processing flag if it's been stuck for too long (30 seconds)
    if (queue.processing && now - queue.lastUpdate > 30000) {
      console.log('🔄 Resetting stuck processing flag for:', queueKey);
      queue.processing = false;
      queue.attempts = 0;
    }

    queue.messages.push({ role: 'user', content: message });
    queue.lastUpdate = now;

    // If already processing, return accumulating status
    if (queue.processing) {
      console.log('⏳ Already processing messages for:', queueKey);
      return new Response(JSON.stringify({ 
        status: 'accumulating',
        message: 'Messages are being accumulated'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if enough time has passed since last message
    const timeSinceLastUpdate = now - queue.lastUpdate;
    if (timeSinceLastUpdate < MESSAGE_ACCUMULATION_TIME) {
      console.log('⏳ Accumulating messages for:', queueKey, 'Time left:', MESSAGE_ACCUMULATION_TIME - timeSinceLastUpdate);
      return new Response(JSON.stringify({ 
        status: 'accumulating',
        message: 'Messages are being accumulated'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Increment attempts and check if we've tried too many times
    queue.attempts++;
    if (queue.attempts > 3) {
      console.error('❌ Too many attempts for:', queueKey);
      messageQueue.delete(queueKey);
      throw new Error('Too many processing attempts');
    }

    // Mark as processing
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
      ...queue.messages
    ];

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
      console.error('❌ OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await openaiResponse.json();
    const aiResponse = data.choices[0].message.content;
    console.log('✅ Received AI response:', aiResponse);

    // Save all accumulated messages
    for (const queuedMsg of queue.messages) {
      const { error: saveError } = await supabaseClient
        .from('chat_messages')
        .insert({
          instance_id: instanceId,
          user_id: instance.user_id,
          sender_type: 'user',
          content: queuedMsg.content
        });

      if (saveError) {
        console.error('❌ Error saving user message:', saveError);
        throw saveError;
      }
    }

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
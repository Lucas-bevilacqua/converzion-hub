import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60 // 60 requests per minute
const requestTimestamps: number[] = []

function isRateLimited(): boolean {
  const now = Date.now()
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW) {
    requestTimestamps.shift()
  }
  if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return true
  }
  requestTimestamps.push(now)
  return false
}

async function processFollowUps() {
  const executionId = crypto.randomUUID();
  const startTime = new Date();
  console.log(`[${executionId}] 🔄 Starting follow-up processing`);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log execution start
    const { error: logError } = await supabase
      .from('follow_up_executions')
      .insert({
        status: 'started',
        details: {
          execution_id: executionId,
          start_time: startTime.toISOString()
        }
      });

    if (logError) {
      console.error(`[${executionId}] ❌ Error logging execution start:`, logError);
    }

    // Fetch active follow-ups
    console.log(`[${executionId}] 🔍 Fetching active follow-ups`);
    const { data: followUps, error: followUpsError } = await supabase
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id,
          name,
          user_id,
          phone_number,
          connection_status
        )
      `)
      .eq('is_active', true)
      .eq('follow_up_type', 'ai_generated');

    if (followUpsError) {
      throw followUpsError;
    }

    console.log(`[${executionId}] 📝 Found ${followUps?.length || 0} follow-ups to process`);

    for (const followUp of followUps || []) {
      try {
        console.log(`[${executionId}] Processing follow-up for instance: ${followUp.instance?.name}`);

        // Add a small delay between processing each follow-up
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if instance is connected
        if (followUp.instance?.connection_status !== 'connected') {
          console.log(`[${executionId}] ⚠️ Instance ${followUp.instance?.name} is not connected, skipping`);
          continue;
        }

        // Check last message
        const { data: lastMessage } = await supabase
          .from('chat_messages')
          .select('created_at')
          .eq('instance_id', followUp.instance_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastMessage) {
          const lastMessageTime = new Date(lastMessage.created_at);
          const delayMinutes = followUp.delay_minutes || 60;
          const nextMessageTime = new Date(lastMessageTime.getTime() + delayMinutes * 60000);

          console.log(`[${executionId}] ⏰ Last message: ${lastMessageTime.toISOString()}`);
          console.log(`[${executionId}] ⏰ Next message: ${nextMessageTime.toISOString()}`);
          console.log(`[${executionId}] ⏰ Current time: ${new Date().toISOString()}`);

          if (nextMessageTime > new Date()) {
            console.log(`[${executionId}] ⏳ Waiting for delay time to pass for instance ${followUp.instance?.name}`);
            continue;
          }
        }

        // Check attempt count
        const { data: followUpMessages } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('instance_id', followUp.instance_id)
          .eq('sender_type', 'follow_up')
          .order('created_at', { ascending: false });

        if (followUpMessages && followUpMessages.length >= (followUp.max_attempts || 3)) {
          console.log(`[${executionId}] 🔄 Max attempts reached for instance ${followUp.instance?.name}`);
          continue;
        }

        // Check for replies
        if (followUp.stop_on_reply && followUpMessages?.length > 0) {
          const { data: userReplies } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('instance_id', followUp.instance_id)
            .eq('sender_type', 'user')
            .gt('created_at', followUpMessages[0].created_at)
            .order('created_at', { ascending: false });

          if (userReplies?.length > 0) {
            console.log(`[${executionId}] ✋ User has replied for instance ${followUp.instance?.name}, stopping follow-up`);
            continue;
          }
        }

        // Check stop keywords
        const stopKeywords = followUp.stop_on_keyword || [];
        const { data: messages } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('instance_id', followUp.instance_id)
          .order('created_at', { ascending: true });

        const hasStopKeyword = messages?.some(msg => 
          msg.sender_type === 'user' && 
          stopKeywords.some(keyword => 
            msg.content.toLowerCase().includes(keyword.toLowerCase())
          )
        );

        if (hasStopKeyword) {
          console.log(`[${executionId}] 🛑 Stop keyword found for instance ${followUp.instance?.name}`);
          continue;
        }

        // Generate message with OpenAI
        console.log(`[${executionId}] 🤖 Generating message with OpenAI for instance ${followUp.instance?.name}`);
        const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              { 
                role: 'system', 
                content: followUp.system_prompt || "You are a helpful assistant that generates natural and contextualized follow-up messages." 
              },
              ...(messages?.map(msg => ({
                role: msg.sender_type === 'user' ? 'user' : 'assistant',
                content: msg.content
              })) || []),
              { 
                role: 'user', 
                content: 'Please generate an appropriate follow-up message for this conversation.' 
              }
            ],
            temperature: 0.7,
            max_tokens: 150
          }),
        });

        if (!openAiResponse.ok) {
          const errorText = await openAiResponse.text();
          console.error(`[${executionId}] ❌ OpenAI error for instance ${followUp.instance?.name}:`, errorText);
          throw new Error(`OpenAI API error: ${errorText}`);
        }

        const aiData = await openAiResponse.json();
        const followUpMessage = aiData.choices[0].message.content;

        console.log(`[${executionId}] 📝 Generated message:`, followUpMessage);

        // Send message via Evolution API
        console.log(`[${executionId}] 📤 Sending message via Evolution API for instance ${followUp.instance?.name}`);
        const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '');
        const evolutionResponse = await fetch(
          `${evolutionApiUrl}/message/sendText/${followUp.instance.name}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
            },
            body: JSON.stringify({
              number: followUp.instance.phone_number,
              text: followUpMessage
            })
          }
        );

        if (!evolutionResponse.ok) {
          const errorText = await evolutionResponse.text();
          console.error(`[${executionId}] ❌ Evolution API error for instance ${followUp.instance?.name}:`, errorText);
          throw new Error(`Evolution API error: ${errorText}`);
        }

        const evolutionData = await evolutionResponse.json();
        console.log(`[${executionId}] ✅ Message sent successfully for instance ${followUp.instance?.name}`);

        // Save message to history
        const { error: saveError } = await supabase
          .from('chat_messages')
          .insert({
            instance_id: followUp.instance_id,
            user_id: followUp.instance.user_id,
            sender_type: 'follow_up',
            content: followUpMessage,
            whatsapp_message_id: evolutionData.key?.id
          });

        if (saveError) {
          console.error(`[${executionId}] ❌ Error saving message for instance ${followUp.instance?.name}:`, saveError);
          throw saveError;
        }

      } catch (error) {
        console.error(`[${executionId}] ❌ Error processing follow-up for instance ${followUp.instance?.name}:`, error);
      }
    }

    const endTime = new Date();
    const executionTime = endTime.getTime() - startTime.getTime();

    // Log completion
    const { error: completionError } = await supabase
      .from('follow_up_executions')
      .insert({
        status: 'completed',
        details: {
          execution_id: executionId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          execution_time_ms: executionTime,
          follow_ups_found: followUps?.length || 0
        },
        next_run_time: new Date(Date.now() + 60000).toISOString() // Schedule next run in 1 minute
      });

    if (completionError) {
      console.error(`[${executionId}] ❌ Error logging completion:`, completionError);
    }

  } catch (error) {
    console.error(`[${executionId}] ❌ Processing error:`, error);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase
      .from('follow_up_executions')
      .insert({
        status: 'error',
        details: {
          execution_id: executionId,
          error: error.message,
          stack: error.stack,
          time: new Date().toISOString()
        }
      });
  }
}

// Start continuous loop with interval
let isProcessing = false;
const INTERVAL = 60000; // 1 minute

setInterval(async () => {
  if (!isProcessing) {
    isProcessing = true;
    try {
      await processFollowUps();
    } finally {
      isProcessing = false;
    }
  } else {
    console.log('🔄 Previous processing still in progress, skipping this iteration');
  }
}, INTERVAL);

// Status endpoint
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ 
      status: 'running',
      rate_limit: {
        window: RATE_LIMIT_WINDOW,
        max_requests: MAX_REQUESTS_PER_WINDOW,
        current_requests: requestTimestamps.length
      }
    }),
    { 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      } 
    }
  );
});
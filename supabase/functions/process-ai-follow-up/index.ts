import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple rate limiting implementation
const rateLimiter = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 30; // Max requests per minute

serve(async (req) => {
  const executionId = crypto.randomUUID();
  console.log(`[${executionId}] 🚀 Starting AI follow-up processing`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Rate limiting check
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;
    
    // Clean up old entries
    for (const [key, timestamp] of rateLimiter.entries()) {
      if (timestamp < windowStart) {
        rateLimiter.delete(key);
      }
    }

    const currentRequests = Array.from(rateLimiter.values()).filter(
      timestamp => timestamp > windowStart
    ).length;

    if (currentRequests >= MAX_REQUESTS) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    rateLimiter.set(executionId, now);

    // Log execution start
    await supabase
      .from('follow_up_executions')
      .insert({
        status: 'started',
        details: {
          execution_id: executionId,
          start_time: new Date().toISOString()
        }
      });

    // Fetch active follow-ups with batching
    const batchSize = 10;
    let lastId = null;
    let processedCount = 0;

    while (true) {
      const query = supabase
        .from('instance_follow_ups')
        .select(`
          *,
          instance:evolution_instances(
            id,
            name,
            user_id,
            phone_number,
            connection_status,
            system_prompt
          )
        `)
        .eq('is_active', true)
        .eq('follow_up_type', 'ai_generated')
        .order('id')
        .limit(batchSize);

      if (lastId) {
        query.gt('id', lastId);
      }

      const { data: followUps, error: followUpsError } = await query;

      if (followUpsError) {
        throw followUpsError;
      }

      if (!followUps?.length) {
        break;
      }

      for (const followUp of followUps) {
        try {
          if (followUp.instance?.connection_status !== 'connected') {
            console.log(`[${executionId}] ⚠️ Instance ${followUp.instance?.name} is not connected, skipping`);
            continue;
          }

          // Check last message with delay
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

            if (nextMessageTime > new Date()) {
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

          if ((followUpMessages?.length || 0) >= (followUp.max_attempts || 3)) {
            continue;
          }

          // Generate message with OpenAI
          const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                  content: followUp.system_prompt || "You are a helpful assistant that generates natural follow-up messages." 
                },
                { 
                  role: 'user', 
                  content: 'Please generate an appropriate follow-up message for this conversation.' 
                }
              ],
              temperature: 0.7,
            }),
          });

          if (!openAiResponse.ok) {
            const errorText = await openAiResponse.text();
            console.error(`[${executionId}] ❌ OpenAI error:`, errorText);
            continue;
          }

          const aiData = await openAiResponse.json();
          const followUpMessage = aiData.choices[0].message.content;

          // Send message via Evolution API
          const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/, '');
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
            console.error(`[${executionId}] ❌ Evolution API error:`, errorText);
            continue;
          }

          const evolutionData = await evolutionResponse.json();

          // Save message to history
          await supabase
            .from('chat_messages')
            .insert({
              instance_id: followUp.instance_id,
              user_id: followUp.instance.user_id,
              sender_type: 'follow_up',
              content: followUpMessage,
              whatsapp_message_id: evolutionData.key?.id
            });

          processedCount++;

          // Add delay between messages to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`[${executionId}] ❌ Error processing follow-up:`, error);
        }
      }

      lastId = followUps[followUps.length - 1].id;
    }

    // Log completion
    await supabase
      .from('follow_up_executions')
      .insert({
        status: 'completed',
        details: {
          execution_id: executionId,
          end_time: new Date().toISOString(),
          messages_processed: processedCount
        },
        next_run_time: new Date(Date.now() + 60000).toISOString()
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Follow-up processing completed',
        executionId,
        processedCount
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error(`[${executionId}] ❌ Fatal error:`, error);
    
    // Log error
    await supabase
      .from('follow_up_executions')
      .insert({
        status: 'error',
        details: {
          execution_id: executionId,
          error: error.message,
          stack: error.stack
        },
        next_run_time: new Date(Date.now() + 60000).toISOString()
      });

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        executionId
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
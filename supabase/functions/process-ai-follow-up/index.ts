import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000 // 1 minute in milliseconds
const MAX_REQUESTS_PER_WINDOW = 30 // Maximum requests per minute
const requestTimestamps: number[] = []

function isRateLimited(): boolean {
  const now = Date.now()
  // Remove timestamps older than the window
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW) {
    requestTimestamps.shift()
  }
  // Check if we're over the limit
  if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return true
  }
  // Add current timestamp
  requestTimestamps.push(now)
  return false
}

serve(async (req) => {
  const executionId = crypto.randomUUID();
  const startTime = new Date();
  console.log(`[${executionId}] 🚀 Starting process-ai-follow-up function at ${startTime.toISOString()}`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check rate limiting
    if (isRateLimited()) {
      console.log(`[${executionId}] ⚠️ Rate limit exceeded`);
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Please wait before making more requests',
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
        }),
        { 
          status: 429,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(RATE_LIMIT_WINDOW / 1000).toString()
          }
        }
      );
    }

    console.log(`[${executionId}] 🔑 Initializing Supabase client`);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log de início da execução
    console.log(`[${executionId}] 📝 Registrando início da execução`);
    await supabase
      .from('ai_follow_up_job_logs')
      .insert({
        status: 'started',
        details: {
          execution_id: executionId,
          start_time: startTime.toISOString()
        }
      });

    // Buscar follow-ups ativos do tipo AI
    console.log(`[${executionId}] 🔍 Buscando follow-ups ativos`);
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
      console.error(`[${executionId}] ❌ Erro ao buscar follow-ups:`, followUpsError);
      throw followUpsError;
    }

    console.log(`[${executionId}] ✅ Encontrados ${followUps?.length || 0} follow-ups ativos`);

    const processedFollowUps = [];
    const errors = [];

    for (const followUp of followUps || []) {
      try {
        console.log(`[${executionId}] Processing follow-up for instance: ${followUp.instance?.name}`);

        // Add a small delay between processing each follow-up
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verificar se a instância está conectada
        if (followUp.instance?.connection_status !== 'connected') {
          console.log(`[${executionId}] ⚠️ Instance ${followUp.instance?.name} is not connected, skipping`);
          continue;
        }

        // Verificar última mensagem
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

          console.log(`[${executionId}] ⏰ Last message time: ${lastMessageTime.toISOString()}`);
          console.log(`[${executionId}] ⏰ Next message time: ${nextMessageTime.toISOString()}`);
          console.log(`[${executionId}] ⏰ Current time: ${new Date().toISOString()}`);

          if (nextMessageTime > new Date()) {
            console.log(`[${executionId}] ⏳ Waiting for delay time to pass for instance ${followUp.instance?.name}`);
            continue;
          }
        }

        // Verificar número de tentativas
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

        // Verificar se houve resposta
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

        // Verificar palavras-chave de parada
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
          console.log(`[${executionId}] 🛑 Stop keyword found for instance ${followUp.instance?.name}, skipping`);
          continue;
        }

        // Gerar mensagem com OpenAI
        console.log(`[${executionId}] 🤖 Generating message with OpenAI for instance ${followUp.instance?.name}`);
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

        // Enviar mensagem via Evolution API
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

        // Salvar mensagem no histórico
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

        processedFollowUps.push({
          instanceId: followUp.instance_id,
          messageId: evolutionData.key?.id,
          message: followUpMessage
        });

      } catch (error) {
        console.error(`[${executionId}] ❌ Error processing follow-up for instance ${followUp.instance?.name}:`, error);
        errors.push({
          instanceId: followUp.instance_id,
          error: error.message
        });
      }
    }

    const endTime = new Date();
    const executionTime = endTime.getTime() - startTime.getTime();
    console.log(`[${executionId}] ⏱️ Total execution time: ${executionTime}ms`);

    // Log de conclusão
    console.log(`[${executionId}] 📝 Registrando conclusão da execução`);
    await supabase
      .from('ai_follow_up_job_logs')
      .insert({
        status: 'completed',
        details: {
          execution_id: executionId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          execution_time_ms: executionTime,
          follow_ups_found: followUps?.length || 0,
          processed: processedFollowUps,
          errors: errors
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        execution_id: executionId,
        execution_time_ms: executionTime,
        follow_ups_found: followUps?.length || 0,
        processed: processedFollowUps,
        errors: errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${executionId}] ❌ Critical error:`, error);
    
    const endTime = new Date();
    const executionTime = endTime.getTime() - startTime.getTime();
    
    // Log do erro
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabase
        .from('ai_follow_up_job_logs')
        .insert({
          status: 'error',
          details: {
            execution_id: executionId,
            error: error.message,
            stack: error.stack,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            execution_time_ms: executionTime
          }
        });
    } catch (logError) {
      console.error(`[${executionId}] ❌ Erro ao registrar log:`, logError);
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        execution_id: executionId,
        execution_time_ms: executionTime
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

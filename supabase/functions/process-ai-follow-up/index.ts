import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const executionId = crypto.randomUUID();
  console.log(`[${executionId}] 🚀 Starting process-ai-follow-up function`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
          start_time: new Date().toISOString()
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
          phone_number
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

          if (nextMessageTime > new Date()) {
            console.log(`[${executionId}] Waiting for delay time to pass`);
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
          console.log(`[${executionId}] Max attempts reached`);
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
            console.log(`[${executionId}] User has replied, stopping follow-up`);
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
          console.log(`[${executionId}] Stop keyword found, skipping`);
          continue;
        }

        // Gerar mensagem com OpenAI
        console.log(`[${executionId}] Generating message with OpenAI`);
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
          }),
        });

        if (!openAiResponse.ok) {
          throw new Error(await openAiResponse.text());
        }

        const aiData = await openAiResponse.json();
        const followUpMessage = aiData.choices[0].message.content;

        // Enviar mensagem via Evolution API
        console.log(`[${executionId}] Sending message via Evolution API`);
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
          throw new Error(await evolutionResponse.text());
        }

        const evolutionData = await evolutionResponse.json();

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
          throw saveError;
        }

        processedFollowUps.push({
          instanceId: followUp.instance_id,
          messageId: evolutionData.key?.id
        });

      } catch (error) {
        console.error(`[${executionId}] Error processing follow-up:`, error);
        errors.push({
          instanceId: followUp.instance_id,
          error: error.message
        });
      }
    }

    // Log de conclusão
    console.log(`[${executionId}] 📝 Registrando conclusão da execução`);
    await supabase
      .from('ai_follow_up_job_logs')
      .insert({
        status: errors.length > 0 ? 'completed with errors' : 'completed successfully',
        details: {
          execution_id: executionId,
          processed: processedFollowUps,
          errors,
          end_time: new Date().toISOString()
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: processedFollowUps,
        errors 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${executionId}] ❌ Erro crítico:`, error);
    
    // Log do erro
    try {
      await supabase
        .from('ai_follow_up_job_logs')
        .insert({
          status: 'error',
          details: {
            execution_id: executionId,
            error: error.message,
            stack: error.stack,
            time: new Date().toISOString()
          }
        });
    } catch (logError) {
      console.error(`[${executionId}] ❌ Erro ao registrar log:`, logError);
    }

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
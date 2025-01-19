import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('🚀 Starting process-ai-follow-up function');

serve(async (req) => {
  const executionId = crypto.randomUUID();
  console.log(`[${executionId}] 📥 Received ${req.method} request`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/, '');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error(`[${executionId}] ❌ Missing Supabase configuration`);
      throw new Error('Missing Supabase configuration');
    }

    if (!openAiKey) {
      console.error(`[${executionId}] ❌ Missing OpenAI API key`);
      throw new Error('Missing OpenAI API key');
    }

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error(`[${executionId}] ❌ Missing Evolution API configuration`);
      throw new Error('Missing Evolution API configuration');
    }

    console.log(`[${executionId}] ✅ Configuration validated`);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log(`[${executionId}] ✅ Supabase client initialized`);

    // Log execution start
    const { data: logEntry, error: logError } = await supabase
      .from('ai_follow_up_logs')
      .insert({
        status: 'started',
        details: { 
          execution_id: executionId,
          start_time: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (logError) {
      console.error(`[${executionId}] ❌ Error creating log entry:`, logError);
      throw logError;
    }

    console.log(`[${executionId}] ✅ Created execution log:`, logEntry);

    // Fetch active follow-ups
    console.log(`[${executionId}] 🔍 Fetching active AI follow-ups...`);
    
    const { data: activeFollowUps, error: followUpsError } = await supabase
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id,
          name,
          user_id,
          phone_number,
          system_prompt
        )
      `)
      .eq('is_active', true)
      .eq('follow_up_type', 'ai_generated');

    if (followUpsError) {
      console.error(`[${executionId}] ❌ Error fetching follow-ups:`, followUpsError);
      await supabase
        .from('ai_follow_up_logs')
        .update({ 
          status: 'error',
          details: { 
            execution_id: executionId,
            error: followUpsError.message,
            end_time: new Date().toISOString()
          }
        })
        .eq('id', logEntry.id);
      
      throw followUpsError;
    }

    console.log(`[${executionId}] ✅ Found ${activeFollowUps?.length || 0} active follow-ups`);

    if (!activeFollowUps?.length) {
      console.log(`[${executionId}] ℹ️ No active follow-ups to process`);
      await supabase
        .from('ai_follow_up_logs')
        .update({ 
          status: 'completed - no active follow-ups',
          details: { 
            execution_id: executionId,
            message: 'No active follow-ups found',
            end_time: new Date().toISOString()
          }
        })
        .eq('id', logEntry.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active follow-ups',
          execution_id: executionId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processedFollowUps = [];
    const errors = [];

    // Process each follow-up
    for (const followUp of activeFollowUps) {
      try {
        console.log(`[${executionId}] 📝 Processing follow-up:`, {
          id: followUp.id,
          instanceId: followUp.instance_id,
          instanceName: followUp.instance?.name
        });

        if (!followUp.instance?.name || !followUp.instance?.phone_number) {
          console.error(`[${executionId}] ❌ Incomplete instance data:`, followUp.instance_id);
          errors.push({
            type: 'missing_instance_data',
            followUpId: followUp.id
          });
          continue;
        }

        // Verificar se já passou o tempo de delay desde a última mensagem
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
            console.log(`[${executionId}] ⏳ Ainda não passou o tempo de delay para:`, followUp.instance_id);
            continue;
          }
        }

        // Fetch message history
        console.log(`[${executionId}] 📚 Fetching chat history...`);
        const { data: chatHistory, error: chatError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('instance_id', followUp.instance_id)
          .order('created_at', { ascending: true })
          .limit(10);

        if (chatError) {
          console.error(`[${executionId}] ❌ Error fetching chat history:`, chatError);
          errors.push({
            type: 'chat_history_error',
            followUpId: followUp.id,
            error: chatError
          });
          continue;
        }

        // Verificar se já atingiu o número máximo de tentativas
        const { data: followUpMessages } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('instance_id', followUp.instance_id)
          .eq('sender_type', 'follow_up')
          .order('created_at', { ascending: false });

        if (followUpMessages && followUpMessages.length >= (followUp.max_attempts || 3)) {
          console.log(`[${executionId}] ⚠️ Máximo de tentativas atingido para:`, followUp.instance_id);
          continue;
        }

        // Verificar se recebeu resposta (se stop_on_reply estiver ativo)
        if (followUp.stop_on_reply) {
          const hasReply = chatHistory?.some(msg => 
            msg.sender_type === 'user' && 
            msg.created_at > (followUpMessages?.[0]?.created_at || '')
          );

          if (hasReply) {
            console.log(`[${executionId}] ✋ Usuário já respondeu para:`, followUp.instance_id);
            continue;
          }
        }

        // Verificar palavras-chave de parada
        const stopKeywords = followUp.stop_on_keyword || [];
        const hasStopKeyword = chatHistory?.some(msg => 
          msg.sender_type === 'user' && 
          stopKeywords.some(keyword => 
            msg.content.toLowerCase().includes(keyword.toLowerCase())
          )
        );

        if (hasStopKeyword) {
          console.log(`[${executionId}] 🚫 Palavra-chave de parada encontrada para:`, followUp.instance_id);
          continue;
        }

        // Prepare messages for AI
        const messages = [
          { 
            role: 'system', 
            content: followUp.system_prompt || followUp.instance.system_prompt || 
              "You are a helpful assistant that generates natural and contextualized follow-up messages." 
          }
        ];

        if (chatHistory?.length) {
          chatHistory.forEach(msg => {
            messages.push({
              role: msg.sender_type === 'user' ? 'user' : 'assistant',
              content: msg.content
            });
          });
        }

        messages.push({ 
          role: 'user', 
          content: 'Please generate an appropriate follow-up message for this conversation.' 
        });

        console.log(`[${executionId}] 🤖 Generating message with OpenAI...`, {
          systemPrompt: messages[0].content,
          historyLength: chatHistory?.length || 0
        });
        
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAiKey}`,
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
          console.error(`[${executionId}] ❌ OpenAI API error:`, error);
          errors.push({
            type: 'openai_api_error',
            followUpId: followUp.id,
            error
          });
          continue;
        }

        const data = await openaiResponse.json();
        const followUpMessage = data.choices[0].message.content;
        console.log(`[${executionId}] ✅ Message generated:`, followUpMessage);

        // Send message via Evolution API
        console.log(`[${executionId}] 📤 Sending message via Evolution API...`);
        const fullUrl = `${evolutionApiUrl}/message/sendText/${followUp.instance.name}`;
        
        console.log(`[${executionId}] 🔗 Evolution API URL:`, fullUrl);
        console.log(`[${executionId}] 📱 Phone number:`, followUp.instance.phone_number);
        
        const evolutionResponse = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            number: followUp.instance.phone_number,
            text: followUpMessage
          })
        });

        if (!evolutionResponse.ok) {
          const error = await evolutionResponse.text();
          console.error(`[${executionId}] ❌ Evolution API error:`, error);
          errors.push({
            type: 'evolution_api_error',
            followUpId: followUp.id,
            error
          });
          continue;
        }

        const evolutionData = await evolutionResponse.json();
        console.log(`[${executionId}] ✅ Evolution API response:`, evolutionData);

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
          console.error(`[${executionId}] ❌ Error saving message:`, saveError);
          errors.push({
            type: 'save_message_error',
            followUpId: followUp.id,
            error: saveError
          });
          continue;
        }

        processedFollowUps.push({
          id: followUp.id,
          messageId: evolutionData.key?.id
        });

      } catch (error) {
        console.error(`[${executionId}] ❌ Error processing follow-up:`, error);
        errors.push({
          type: 'follow_up_processing_error',
          followUpId: followUp.id,
          error: error.message
        });
      }
    }

    // Update final status in log
    const finalStatus = errors.length > 0 
      ? `completed with ${errors.length} errors` 
      : 'completed successfully';

    await supabase
      .from('ai_follow_up_logs')
      .update({ 
        status: finalStatus,
        details: { 
          execution_id: executionId,
          processed: processedFollowUps,
          errors,
          end_time: new Date().toISOString()
        }
      })
      .eq('id', logEntry.id);

    console.log(`[${executionId}] 🏁 Processing completed:`, {
      processed: processedFollowUps.length,
      errors: errors.length
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Follow-ups processed',
        execution_id: executionId,
        processed: processedFollowUps,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${executionId}] ❌ Critical error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false,
        execution_id: executionId,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('🚀 Function process-ai-follow-up is starting...');

serve(async (req) => {
  // Log request details
  console.log(`📥 Received ${req.method} request at ${new Date().toISOString()}`);
  
  if (req.method === 'OPTIONS') {
    console.log('👋 Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with detailed logging
    console.log('🔄 Initializing Supabase client...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase configuration');
      throw new Error('Missing Supabase configuration');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized');

    // Create execution log
    console.log('📝 Creating execution log...');
    const { data: logData, error: logError } = await supabaseClient
      .from('cron_execution_logs')
      .insert({
        job_name: 'process-ai-follow-up',
        status: 'started',
        response: { start_time: new Date().toISOString() }
      })
      .select()
      .single();

    if (logError) {
      console.error('❌ Error creating execution log:', logError);
      throw logError;
    }

    console.log('✅ Execution log created:', logData);

    // Fetch active follow-ups
    console.log('🔍 Fetching active AI follow-ups...');
    const { data: activeFollowUps, error: followUpsError } = await supabaseClient
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
      console.error('❌ Error fetching follow-ups:', followUpsError);
      
      // Update log with error
      await supabaseClient
        .from('cron_execution_logs')
        .update({ 
          status: 'error',
          response: { error: followUpsError.message }
        })
        .eq('id', logData?.id);
      
      throw followUpsError;
    }

    console.log(`✅ Found ${activeFollowUps?.length || 0} active AI follow-ups`);

    if (!activeFollowUps?.length) {
      console.log('ℹ️ No active AI follow-ups found');
      
      // Update log for no follow-ups case
      await supabaseClient
        .from('cron_execution_logs')
        .update({ 
          status: 'completed - no active follow-ups',
          response: { message: 'No active follow-ups found' }
        })
        .eq('id', logData?.id);

      return new Response(
        JSON.stringify({ success: true, message: 'No active follow-ups' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get required API keys
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey || !openAiKey) {
      console.error('❌ Missing API configuration');
      throw new Error('Missing API configuration');
    }

    const processedFollowUps = [];
    const errors = [];

    // Process each follow-up
    for (const followUp of activeFollowUps) {
      try {
        console.log('📝 Processing follow-up:', {
          id: followUp.id,
          instanceId: followUp.instance_id,
          instanceName: followUp.instance?.name
        });

        if (!followUp.instance?.name || !followUp.instance?.phone_number) {
          console.error('❌ Incomplete instance data:', followUp.instance_id);
          errors.push({
            type: 'missing_instance_data',
            followUpId: followUp.id
          });
          continue;
        }

        // Fetch message history
        console.log('📚 Fetching chat history...');
        const { data: chatHistory, error: chatError } = await supabaseClient
          .from('chat_messages')
          .select('*')
          .eq('instance_id', followUp.instance_id)
          .order('created_at', { ascending: true })
          .limit(10);

        if (chatError) {
          console.error('❌ Error fetching chat history:', chatError);
          errors.push({
            type: 'chat_history_error',
            followUpId: followUp.id,
            error: chatError
          });
          continue;
        }

        // Prepare messages for AI
        const messages = [
          { 
            role: 'system', 
            content: followUp.system_prompt || followUp.instance.system_prompt || "You are a helpful assistant that generates natural and contextualized follow-up messages." 
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

        console.log('🤖 Generating message with OpenAI...');
        
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages,
            temperature: 0.7,
          }),
        });

        if (!openaiResponse.ok) {
          const error = await openaiResponse.text();
          console.error('❌ OpenAI API error:', error);
          errors.push({
            type: 'openai_api_error',
            followUpId: followUp.id,
            error
          });
          continue;
        }

        const data = await openaiResponse.json();
        const followUpMessage = data.choices[0].message.content;
        console.log('✅ Message generated:', followUpMessage);

        // Send message via Evolution API
        console.log('📤 Sending message via Evolution API...');
        const fullUrl = `${evolutionApiUrl}/message/sendText/${followUp.instance.name}`;
        
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
          console.error('❌ Evolution API error:', error);
          errors.push({
            type: 'evolution_api_error',
            followUpId: followUp.id,
            error
          });
          continue;
        }

        const evolutionData = await evolutionResponse.json();
        console.log('✅ Evolution API response:', evolutionData);

        // Save message to history
        const { error: saveError } = await supabaseClient
          .from('chat_messages')
          .insert({
            instance_id: followUp.instance_id,
            user_id: followUp.instance.user_id,
            sender_type: 'follow_up',
            content: followUpMessage,
            whatsapp_message_id: evolutionData.key?.id
          });

        if (saveError) {
          console.error('❌ Error saving message:', saveError);
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
        console.error('❌ Error processing follow-up:', error);
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

    await supabaseClient
      .from('cron_execution_logs')
      .update({ 
        status: finalStatus,
        response: { 
          processed: processedFollowUps,
          errors,
          end_time: new Date().toISOString()
        }
      })
      .eq('id', logData?.id);

    console.log('🏁 Processing completed:', {
      processed: processedFollowUps.length,
      errors: errors.length
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Follow-ups processed',
        processed: processedFollowUps,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Critical error:', error);
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
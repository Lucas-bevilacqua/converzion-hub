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
    const { instanceId, instanceName, userId, delayMinutes, maxAttempts, stopOnReply, stopKeywords } = await req.json();
    console.log('📩 Processing AI follow-up for instance:', instanceId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get chat history for context
    const { data: chatHistory, error: chatError } = await supabaseClient
      .from('chat_messages')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (chatError) {
      console.error('❌ Error fetching chat history:', chatError);
      throw chatError;
    }

    if (!chatHistory || chatHistory.length === 0) {
      console.error('❌ No chat history found for instance:', instanceId);
      throw new Error('No chat history found');
    }

    // Get the last user message to extract context
    const lastUserMessage = chatHistory.find(msg => msg.sender_type === 'user');
    if (!lastUserMessage) {
      console.error('❌ No user messages found in chat history');
      throw new Error('No user messages found');
    }

    // Get the phone number from Users_clientes table
    const { data: clientData, error: clientError } = await supabaseClient
      .from('Users_clientes')
      .select('TelefoneClientes')
      .eq('NomeDaEmpresa', instanceId)
      .single();

    if (clientError) {
      console.error('❌ Error fetching client data:', clientError);
      throw clientError;
    }

    if (!clientData?.TelefoneClientes) {
      console.error('❌ No phone number found for client');
      throw new Error('No phone number found for client');
    }

    console.log('📱 Found phone number:', clientData.TelefoneClientes);

    // Detect language from chat history
    const userMessages = chatHistory
      .filter(msg => msg.sender_type === 'user')
      .map(msg => msg.content);
    
    // Simple language detection based on common words
    const isPortuguese = userMessages.some(msg => 
      msg.toLowerCase().match(/(\s|^)(oi|olá|obrigado|bom dia|boa tarde|boa noite)(\s|$)/)
    );

    console.log('🌐 Detected language:', isPortuguese ? 'Portuguese' : 'English');

    // Prepare context for AI with language instruction
    const contextMessages = chatHistory.map(msg => ({
      role: msg.sender_type === 'user' ? 'user' : 'assistant',
      content: msg.content
    })).reverse();

    // Generate message with OpenAI
    console.log('🤖 Generating AI message...');
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: isPortuguese 
              ? 'Você é um assistente gerando mensagens de follow-up em português. Mantenha as respostas amigáveis, profissionais e concisas.'
              : 'You are an AI assistant generating follow-up messages. Keep responses friendly, professional, and concise.'
          },
          ...contextMessages,
          { 
            role: 'user', 
            content: isPortuguese
              ? 'Gere uma mensagem de follow-up para um cliente que não respondeu. Considere o histórico do chat e mantenha a mensagem envolvente mas breve. Não mencione horários ou datas específicas.'
              : 'Generate a follow-up message for a customer who hasn\'t responded. Consider the chat history and keep the message engaging but brief. Do not mention specific times or dates.'
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text();
      console.error('❌ OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error}`);
    }

    const aiData = await openAIResponse.json();
    const message = aiData.choices[0].message.content;
    console.log('✅ AI message generated:', message);

    // Send message via Evolution API
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const evolutionApiEndpoint = `${evolutionApiUrl}/message/sendText/${instanceName}`;
    
    console.log('🔗 Evolution API endpoint:', evolutionApiEndpoint);
    
    // Clean and format the phone number
    const cleanPhoneNumber = clientData.TelefoneClientes.replace(/\D/g, '');
    console.log('📱 Clean phone number:', cleanPhoneNumber);

    const evolutionResponse = await fetch(evolutionApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
      },
      body: JSON.stringify({
        number: cleanPhoneNumber,
        text: message
      }),
    });

    if (!evolutionResponse.ok) {
      const error = await evolutionResponse.text();
      console.error('❌ Evolution API error:', error);
      throw new Error(`Evolution API error: ${error}`);
    }

    const evolutionData = await evolutionResponse.json();
    console.log('✅ Message sent:', evolutionData);

    // Save message in chat history
    const { error: chatSaveError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: instanceId,
        user_id: userId,
        sender_type: 'assistant',
        content: message,
        whatsapp_message_id: evolutionData.key?.id
      });

    if (chatSaveError) {
      console.error('❌ Error saving message to chat history:', chatSaveError);
      throw chatSaveError;
    }

    console.log('✅ AI follow-up processed successfully');

    return new Response(
      JSON.stringify({ success: true, message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error processing AI follow-up:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
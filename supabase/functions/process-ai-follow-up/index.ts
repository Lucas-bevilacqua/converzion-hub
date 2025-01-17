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
    const { contact, followUp } = await req.json();
    console.log('📩 Processando follow-up AI para:', contact);

    // Verificar se já passou o tempo de delay configurado
    const lastMessageTime = new Date(contact.last_message_time || contact.created_at);
    const now = new Date();
    const minutesSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60);

    console.log('⏰ Tempo desde última mensagem:', minutesSinceLastMessage, 'minutos');
    console.log('⚙️ Delay configurado:', followUp.delay_minutes, 'minutos');

    if (minutesSinceLastMessage < followUp.delay_minutes) {
      console.log('⏳ Ainda não é hora de enviar o follow-up');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Waiting for delay time' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gerar mensagem com OpenAI
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
            content: followUp.systemPrompt || 'Você é um assistente prestativo.'
          },
          { 
            role: 'user', 
            content: `Gere uma mensagem de follow up para o cliente ${contact.NomeClientes || 'cliente'}. 
                     A mensagem deve ser amigável e profissional.`
          }
        ],
      }),
    });

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text();
      console.error('❌ Erro OpenAI:', error);
      throw new Error(`OpenAI API error: ${error}`);
    }

    const aiData = await openAIResponse.json();
    const message = aiData.choices[0].message.content;
    console.log('✅ Mensagem gerada:', message);

    // Enviar mensagem via Evolution API
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const evolutionApiEndpoint = `${evolutionApiUrl}/message/sendText/${followUp.instanceName}`;
    
    console.log('🔗 Evolution API endpoint:', evolutionApiEndpoint);
    
    const evolutionResponse = await fetch(evolutionApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
      },
      body: JSON.stringify({
        number: contact.TelefoneClientes,
        text: message
      }),
    });

    if (!evolutionResponse.ok) {
      const error = await evolutionResponse.text();
      console.error('❌ Erro Evolution API:', error);
      throw new Error(`Evolution API error: ${error}`);
    }

    const evolutionData = await evolutionResponse.json();
    console.log('✅ Mensagem enviada:', evolutionData);

    // Atualizar status do contato
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: updateError } = await supabaseClient
      .from('Users_clientes')
      .update({ 
        ConversationId: 'follow-up-sent',
        last_message_time: new Date().toISOString()
      })
      .eq('id', contact.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar contato:', updateError);
      throw updateError;
    }

    console.log('✅ Follow-up processado com sucesso');

    return new Response(
      JSON.stringify({ success: true, message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Erro ao processar follow-up AI:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
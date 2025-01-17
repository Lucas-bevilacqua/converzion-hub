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
      throw new Error(`OpenAI API error: ${await openAIResponse.text()}`);
    }

    const aiData = await openAIResponse.json();
    const message = aiData.choices[0].message.content;

    // Enviar mensagem via Evolution API
    const evolutionResponse = await fetch(
      `${Deno.env.get('EVOLUTION_API_URL')}/message/sendText/${followUp.instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
        },
        body: JSON.stringify({
          number: contact.TelefoneClientes,
          text: message
        }),
      }
    );

    if (!evolutionResponse.ok) {
      throw new Error(`Evolution API error: ${await evolutionResponse.text()}`);
    }

    // Atualizar status do contato
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: updateError } = await supabaseClient
      .from('Users_clientes')
      .update({ ConversationId: 'follow-up-sent' })
      .eq('id', contact.id);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Follow-up AI processado com sucesso');

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
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] 🚀 Iniciando função get-follow-up-contacts`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar request
    if (!req.headers.get('authorization')) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get service key from secure_configurations
    console.log(`[${requestId}] 🔑 Buscando chave de serviço`);
    const { data: keyData, error: keyError } = await supabaseClient
      .from('secure_configurations')
      .select('config_value')
      .eq('config_key', 'supabase_service_role_key')
      .single();

    if (keyError) {
      console.error(`[${requestId}] ❌ Erro ao buscar chave de serviço:`, keyError);
      throw new Error('Failed to get service key');
    }

    if (!keyData) {
      console.error(`[${requestId}] ❌ Chave de serviço não encontrada`);
      throw new Error('Service key not found');
    }

    const serviceKey = keyData.config_value;
    console.log(`[${requestId}] ✅ Chave de serviço obtida com sucesso`);

    // Registrar execução
    console.log(`[${requestId}] 📝 Registrando execução`);
    const { error: logError } = await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'started',
        details: 'Iniciando busca de contatos para follow-up',
        details_json: { request_id: requestId }
      });

    if (logError) {
      console.error(`[${requestId}] ⚠️ Erro ao registrar log:`, logError);
    }

    // Buscar follow-ups ativos
    console.log(`[${requestId}] 🔍 Buscando follow-ups ativos`);
    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id,
          name,
          user_id,
          connection_status
        )
      `)
      .eq('is_active', true);

    if (followUpsError) {
      console.error(`[${requestId}] ❌ Erro ao buscar follow-ups:`, followUpsError);
      throw new Error(`Erro ao buscar follow-ups: ${followUpsError.message}`);
    }

    console.log(`[${requestId}] ✅ Encontrados ${followUps?.length || 0} follow-ups ativos`);

    const processedFollowUps = [];
    const errors = [];

    for (const followUp of (followUps || [])) {
      try {
        if (!followUp.instance?.connection_status || followUp.instance.connection_status === 'disconnected') {
          console.log(`[${requestId}] ⚠️ Instância ${followUp.instance?.name} não conectada, pulando`);
          continue;
        }

        // Determinar qual endpoint chamar baseado no tipo de follow-up
        const endpoint = followUp.follow_up_type === 'ai_generated' 
          ? 'process-ai-follow-up'
          : 'process-follow-up';

        console.log(`[${requestId}] 🔄 Usando endpoint: ${endpoint}`);

        // Buscar contatos
        console.log(`[${requestId}] 🔍 Buscando contatos para instância: ${followUp.instance.name}`);
        const { data: contacts, error: contactsError } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .not('TelefoneClientes', 'is', null)
          .order('last_message_time', { ascending: true, nullsFirst: true });

        if (contactsError) {
          console.error(`[${requestId}] ❌ Erro ao buscar contatos:`, contactsError);
          throw new Error(`Erro ao buscar contatos: ${contactsError.message}`);
        }

        console.log(`[${requestId}] 📊 Encontrados ${contacts?.length || 0} contatos`);

        for (const contact of (contacts || [])) {
          try {
            const processFollowUpUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${endpoint}`;
            
            console.log(`[${requestId}] 🔄 Processando contato: ${contact.TelefoneClientes}`);
            const processingResponse = await fetch(
              processFollowUpUrl,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${serviceKey}`
                },
                body: JSON.stringify({
                  contact: {
                    ...contact,
                    followUp: {
                      ...followUp,
                      instance_id: followUp.instance_id,
                      instanceName: followUp.instance.name,
                      userId: followUp.instance.user_id
                    }
                  }
                })
              }
            );

            if (!processingResponse.ok) {
              const errorText = await processingResponse.text();
              throw new Error(`Erro ao processar follow-up: ${errorText}`);
            }

            const responseData = await processingResponse.json();
            console.log(`[${requestId}] ✅ Follow-up processado:`, responseData);

            processedFollowUps.push({
              followUpId: followUp.id,
              instanceId: followUp.instance_id,
              contactId: contact.id,
              type: followUp.follow_up_type,
              timestamp: new Date().toISOString()
            });

          } catch (contactError) {
            console.error(`[${requestId}] ❌ Erro ao processar contato:`, contactError);
            errors.push({
              followUpId: followUp.id,
              contactId: contact.id,
              type: followUp.follow_up_type,
              error: contactError.message,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        console.error(`[${requestId}] ❌ Erro ao processar follow-up:`, error);
        errors.push({
          followUpId: followUp.id,
          type: followUp.follow_up_type,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Log conclusão
    const endTime = new Date().toISOString();
    const finalLog = {
      request_id: requestId,
      processed: processedFollowUps.length,
      errors: errors.length,
      endTime,
      duration: new Date(endTime).getTime() - new Date().getTime()
    };
    
    console.log(`[${requestId}] 📝 Execução concluída:`, finalLog);
    
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'completed',
        details: 'Processamento de follow-up concluído',
        details_json: finalLog
      });

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedFollowUps,
        errors,
        request_id: requestId
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error(`[${requestId}] ❌ Erro crítico:`, error);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    await supabase
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'error',
        details: 'Falha na execução da função',
        details_json: {
          request_id: requestId,
          error: error.message,
          stack: error.stack
        }
      });

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        request_id: requestId,
        timestamp: new Date().toISOString()
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
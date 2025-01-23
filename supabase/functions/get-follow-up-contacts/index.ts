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
  
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Validate authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error(`[${requestId}] ❌ Requisição sem header de autorização`);
      throw new Error('Missing authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error(`[${requestId}] ❌ Variáveis de ambiente não configuradas`);
      throw new Error('Environment variables not configured');
    }

    console.log(`[${requestId}] ✅ Variáveis de ambiente OK`);
    
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Log execution start
    const { error: logError } = await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'started',
        details: 'Iniciando execução da função',
        details_json: { request_id: requestId }
      });

    if (logError) {
      console.error(`[${requestId}] ⚠️ Erro ao registrar log inicial:`, logError);
    }

    // Fetch active follow-ups
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
      throw new Error(`Error fetching follow-ups: ${followUpsError.message}`);
    }

    console.log(`[${requestId}] ✅ Encontrados ${followUps?.length || 0} follow-ups ativos`);

    const processedFollowUps = [];
    const errors = [];

    // Process each follow-up
    for (const followUp of (followUps || [])) {
      try {
        if (!followUp.instance?.connection_status || followUp.instance.connection_status === 'disconnected') {
          console.log(`[${requestId}] ⚠️ Instância ${followUp.instance?.name} não conectada, pulando`);
          continue;
        }

        const endpoint = followUp.follow_up_type === 'ai_generated' 
          ? 'process-ai-follow-up'
          : 'process-follow-up';

        console.log(`[${requestId}] 🔄 Processando follow-up tipo: ${endpoint}`);

        // Get contacts for this instance
        const { data: contacts, error: contactsError } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .not('TelefoneClientes', 'is', null)
          .order('last_message_time', { ascending: true, nullsFirst: true });

        if (contactsError) {
          console.error(`[${requestId}] ❌ Erro ao buscar contatos:`, contactsError);
          throw new Error(`Error fetching contacts: ${contactsError.message}`);
        }

        console.log(`[${requestId}] 📊 Encontrados ${contacts?.length || 0} contatos para processamento`);

        // Process each contact
        for (const contact of (contacts || [])) {
          try {
            const processFollowUpUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${endpoint}`;
            
            console.log(`[${requestId}] 🔄 Processando contato: ${contact.TelefoneClientes}`);
            
            const response = await fetch(processFollowUpUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
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
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Error processing follow-up: ${errorText}`);
            }

            const responseData = await response.json();
            console.log(`[${requestId}] ✅ Follow-up processado com sucesso:`, responseData);

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
      } catch (followUpError) {
        console.error(`[${requestId}] ❌ Erro ao processar follow-up:`, followUpError);
        errors.push({
          followUpId: followUp.id,
          type: followUp.follow_up_type,
          error: followUpError.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Log completion
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
        details: 'Processamento concluído com sucesso',
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
    console.error(`[${requestId}] ❌ Erro crítico na execução:`, error);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('cron_logs')
        .insert({
          job_name: 'get-follow-up-contacts',
          status: 'error',
          details: 'Erro crítico na execução',
          details_json: {
            request_id: requestId,
            error: error.message,
            stack: error.stack
          }
        });
    }

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
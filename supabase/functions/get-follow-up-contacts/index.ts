import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_LIMIT = 5;
const BATCH_SIZE = 3;
const DELAY_BETWEEN_CONTACTS = 2000;
const activeRequests = new Set();

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] 🚀 Iniciando função get-follow-up-contacts`);

  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Verificar autenticação
    const authHeader = req.headers.get('authorization');
    const apiKey = req.headers.get('apikey');

    if (!authHeader && !apiKey) {
      console.error(`[${requestId}] ❌ Sem header de autorização ou apikey`);
      throw new Error('No authorization provided');
    }

    // Verificar rate limit
    if (activeRequests.size >= RATE_LIMIT) {
      console.log(`[${requestId}] ⚠️ Rate limit excedido`);
      throw new Error('Too many concurrent requests');
    }

    activeRequests.add(requestId);

    // Inicializar cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Registrar início
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'started',
        details: 'Iniciando execução da função',
        details_json: { request_id: requestId }
      });

    // Buscar follow-ups ativos
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
      .eq('is_active', true)
      .lt('next_execution_time', new Date().toISOString())
      .lt('execution_count', 'max_attempts')
      .limit(BATCH_SIZE);

    if (followUpsError) {
      throw followUpsError;
    }

    console.log(`[${requestId}] 📊 Follow-ups encontrados:`, followUps?.length || 0);

    // Processar follow-ups
    const processedFollowUps = [];
    const errors = [];

    for (const followUp of (followUps || [])) {
      try {
        if (!followUp.instance?.connection_status || 
            followUp.instance.connection_status !== 'connected') {
          console.log(`[${requestId}] ⚠️ Instância ${followUp.instance?.name} não conectada`);
          continue;
        }

        // Verificar Evolution API
        const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
        const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

        if (!evolutionApiUrl || !evolutionApiKey) {
          throw new Error('Evolution API configuration missing');
        }

        // Buscar contatos
        const { data: contacts } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .limit(BATCH_SIZE);

        console.log(`[${requestId}] 📱 Processando ${contacts?.length || 0} contatos`);

        // Processar cada contato
        for (const contact of (contacts || [])) {
          try {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CONTACTS));

            const endpoint = followUp.follow_up_type === 'ai_generated' 
              ? 'process-ai-follow-up'
              : 'process-follow-up';

            const response = await supabaseClient.functions.invoke(endpoint, {
              body: { 
                contact: {
                  ...contact,
                  followUp: {
                    ...followUp,
                    instance_id: followUp.instance_id,
                    instanceName: followUp.instance.name,
                    userId: followUp.instance.user_id
                  }
                }
              }
            });

            processedFollowUps.push({
              followUpId: followUp.id,
              status: 'success',
              result: response.data
            });

          } catch (error) {
            console.error(`[${requestId}] ❌ Erro ao processar contato:`, error);
            errors.push({
              followUpId: followUp.id,
              contactId: contact.id,
              error: error.message
            });
          }
        }

        // Atualizar contadores
        await supabaseClient
          .from('instance_follow_ups')
          .update({
            execution_count: (followUp.execution_count || 0) + 1,
            last_execution_time: new Date().toISOString(),
            next_execution_time: new Date(Date.now() + (followUp.delay_minutes * 60 * 1000)).toISOString()
          })
          .eq('id', followUp.id);

      } catch (error) {
        console.error(`[${requestId}] ❌ Erro ao processar follow-up:`, error);
        errors.push({
          followUpId: followUp.id,
          error: error.message
        });
      }
    }

    // Registrar conclusão
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: errors.length ? 'completed_with_errors' : 'completed',
        details: 'Execução finalizada',
        details_json: { 
          request_id: requestId,
          processed: processedFollowUps.length,
          errors: errors.length,
          error_details: errors
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedFollowUps.length,
        errors: errors.length,
        results: [...processedFollowUps, ...errors]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${requestId}] ❌ Erro crítico:`, error);
    
    // Registrar erro
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    await supabaseClient
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

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        request_id: requestId
      }),
      { 
        status: error.message.includes('Too many concurrent requests') ? 429 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } finally {
    activeRequests.delete(requestId);
  }
});
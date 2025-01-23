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

    const authHeader = req.headers.get('authorization');
    const apiKey = req.headers.get('apikey');

    if (!authHeader && !apiKey) {
      console.error(`[${requestId}] ❌ Sem header de autorização ou apikey`);
      return new Response(
        JSON.stringify({
          error: 'No authorization provided',
          details: 'Please provide either an authorization header or apikey'
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (activeRequests.size >= RATE_LIMIT) {
      console.log(`[${requestId}] ⚠️ Rate limit excedido`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Too many concurrent requests. Please try again later.'
        }),
        { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    activeRequests.add(requestId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[${requestId}] 📝 Registrando início da execução`);
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'started',
        details: 'Iniciando execução da função',
        details_json: { request_id: requestId }
      });

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
      .eq('is_active', true)
      .lt('next_execution_time', new Date().toISOString())
      .lt('execution_count', 'max_attempts')
      .limit(BATCH_SIZE);

    if (followUpsError) {
      console.error(`[${requestId}] ❌ Erro ao buscar follow-ups:`, followUpsError);
      throw followUpsError;
    }

    console.log(`[${requestId}] 📊 Follow-ups encontrados:`, {
      quantidade: followUps?.length || 0,
      detalhes: followUps?.map(f => ({
        id: f.id,
        instance_name: f.instance?.name,
        is_active: f.is_active,
        next_execution_time: f.next_execution_time,
        execution_count: f.execution_count,
        max_attempts: f.max_attempts,
        connection_status: f.instance?.connection_status
      }))
    });

    const processedFollowUps = [];
    const errors = [];

    for (const followUp of (followUps || [])) {
      try {
        console.log(`[${requestId}] 🔄 Verificando follow-up:`, {
          id: followUp.id,
          instance_name: followUp.instance?.name,
          connection_status: followUp.instance?.connection_status,
          execution_count: followUp.execution_count,
          max_attempts: followUp.max_attempts
        });

        if (!followUp.instance?.connection_status || 
            followUp.instance.connection_status.toLowerCase() !== 'connected') {
          console.log(`[${requestId}] ⚠️ Instância ${followUp.instance?.name} não está conectada, pulando`);
          continue;
        }

        console.log(`[${requestId}] 🔄 Processando follow-up para instância ${followUp.instance.name}`);

        const endpoint = followUp.follow_up_type === 'ai_generated' 
          ? 'process-ai-follow-up'
          : 'process-follow-up';

        const { data: contacts } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .limit(BATCH_SIZE);

        console.log(`[${requestId}] 📊 Encontrados ${contacts?.length || 0} contatos para processamento`);

        for (const contact of (contacts || [])) {
          try {
            console.log(`[${requestId}] 🔄 Processando contato:`, {
              telefone: contact.TelefoneClientes,
              endpoint: endpoint,
              instance: followUp.instance.name
            });
            
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CONTACTS));

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

            console.log(`[${requestId}] ✅ Contato processado com sucesso:`, response.data);

            processedFollowUps.push({
              followUpId: followUp.id,
              status: 'success',
              result: response.data
            });

          } catch (error) {
            console.error(`[${requestId}] ❌ Erro ao processar contato:`, error);
            errors.push({
              followUpId: followUp.id,
              status: 'error',
              error: error.message
            });
          }
        }

        // Atualizar contador de execuções e próximo horário
        const { error: updateError } = await supabaseClient
          .from('instance_follow_ups')
          .update({
            execution_count: (followUp.execution_count || 0) + 1,
            last_execution_time: new Date().toISOString(),
            next_execution_time: new Date(Date.now() + (followUp.delay_minutes * 60 * 1000)).toISOString()
          })
          .eq('id', followUp.id);

        if (updateError) {
          console.error(`[${requestId}] ❌ Erro ao atualizar follow-up:`, updateError);
        }

      } catch (error) {
        console.error(`[${requestId}] ❌ Erro ao processar follow-up:`, error);
        errors.push({
          followUpId: followUp.id,
          status: 'error',
          error: error.message
        });
      }
    }

    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'completed',
        details: 'Execução da função completada',
        details_json: { 
          request_id: requestId,
          processed: processedFollowUps.length,
          errors: errors.length
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedFollowUps.length,
        results: [...processedFollowUps, ...errors]
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error(`[${requestId}] ❌ Erro crítico:`, error);
    
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'error',
        details: 'Execução da função falhou',
        details_json: { 
          request_id: requestId,
          error: error.message
        }
      });

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        request_id: requestId
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } finally {
    activeRequests.delete(requestId);
  }
});
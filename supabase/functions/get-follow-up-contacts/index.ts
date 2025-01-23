import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_RETRIES = 3;
const BATCH_SIZE = 3;
const DELAY_BETWEEN_CONTACTS = 2000;
const RETRY_DELAY = 2000;
const activeRequests = new Set();

async function retryOperation<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      console.log(`🔄 [DEBUG] Tentando novamente, ${retries} tentativas restantes`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return retryOperation(operation, retries - 1);
    }
    throw error;
  }
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] 🚀 Iniciando função get-follow-up-contacts`);

  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch active follow-ups
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
      console.error(`[${requestId}] ❌ Error fetching follow-ups:`, followUpsError);
      throw followUpsError;
    }

    console.log(`[${requestId}] 📊 Follow-ups encontrados:`, followUps?.length || 0);

    const processedFollowUps = [];
    const errors = [];

    for (const followUp of (followUps || [])) {
      try {
        console.log(`[${requestId}] 🔄 Processando follow-up para instância ${followUp.instance?.name}`);
        
        // Verificar se execution_count é menor que max_attempts
        const executionCount = followUp.execution_count || 0;
        const maxAttempts = followUp.max_attempts || 3;
        
        console.log(`[${requestId}] 📝 Verificando tentativas:`, {
          executionCount,
          maxAttempts,
          comparison: executionCount >= maxAttempts
        });
        
        // Changed comparison to use < instead of >= to continue while we haven't hit max attempts
        if (executionCount >= maxAttempts) {
          console.log(`[${requestId}] ⚠️ Número máximo de tentativas atingido para follow-up ${followUp.id}`);
          
          // Update follow-up to mark it as inactive since max attempts reached
          const { error: updateError } = await supabaseClient
            .from('instance_follow_ups')
            .update({
              is_active: false,
              last_execution_time: new Date().toISOString(),
              execution_count: executionCount
            })
            .eq('id', followUp.id);

          if (updateError) {
            console.error(`[${requestId}] ❌ Error updating follow-up status:`, updateError);
          }
          
          continue;
        }

        if (!followUp.instance?.connection_status || 
            followUp.instance.connection_status !== 'connected') {
          console.log(`[${requestId}] ⚠️ Instância ${followUp.instance?.name} não conectada`);
          continue;
        }

        // Fetch contacts
        const { data: contacts } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .limit(BATCH_SIZE);

        console.log(`[${requestId}] 📱 Processando ${contacts?.length || 0} contatos`);

        for (const contact of (contacts || [])) {
          try {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CONTACTS));

            const endpoint = followUp.follow_up_type === 'ai_generated' 
              ? 'process-ai-follow-up'
              : 'process-follow-up';

            const response = await retryOperation(() => 
              supabaseClient.functions.invoke(endpoint, {
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
              })
            );

            console.log(`[${requestId}] ✅ Contato processado com sucesso:`, contact.TelefoneClientes);

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

        // Update follow-up execution count and time
        const { error: updateError } = await supabaseClient
          .from('instance_follow_ups')
          .update({
            execution_count: executionCount + 1,
            last_execution_time: new Date().toISOString(),
            next_execution_time: new Date(Date.now() + (followUp.delay_minutes * 60 * 1000)).toISOString()
          })
          .eq('id', followUp.id);

        if (updateError) {
          console.error(`[${requestId}] ❌ Error updating follow-up:`, updateError);
          throw updateError;
        }

      } catch (error) {
        console.error(`[${requestId}] ❌ Error processing follow-up:`, error);
        errors.push({
          followUpId: followUp.id,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedFollowUps.length,
        errors: errors.length,
        results: [...processedFollowUps, ...errors]
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error(`[${requestId}] ❌ Fatal error:`, error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        request_id: requestId
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
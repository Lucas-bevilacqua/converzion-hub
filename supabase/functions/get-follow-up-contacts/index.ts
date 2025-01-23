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
const INITIAL_DELAY = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithBackoff<T>(
  operation: () => Promise<T>, 
  retries: number = MAX_RETRIES,
  delay: number = INITIAL_DELAY
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      console.log(`🔄 [DEBUG] Retrying operation, ${retries} attempts remaining, waiting ${delay}ms`);
      await sleep(delay);
      return retryWithBackoff(operation, retries - 1, delay * 2);
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

    console.log(`[${requestId}] 🔍 Buscando follow-ups ativos...`);
    
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
      .lt('execution_count', 'max_attempts') // Using raw SQL to compare columns
      .order('last_execution_time', { ascending: true, nullsFirst: true });

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
        
        const executionCount = followUp.execution_count || 0;
        const maxAttempts = followUp.max_attempts || 3;
        
        console.log(`[${requestId}] 📝 Verificando tentativas:`, {
          executionCount,
          maxAttempts,
          comparison: executionCount >= maxAttempts
        });

        if (!followUp.instance?.connection_status || 
            followUp.instance.connection_status.toLowerCase() !== 'connected') {
          console.log(`[${requestId}] ⚠️ Instância ${followUp.instance?.name} não conectada. Status: ${followUp.instance?.connection_status}`);
          continue;
        }

        console.log(`[${requestId}] 🔍 Buscando contatos para instância ${followUp.instance_id}`);
        
        const { data: contacts, error: contactsError } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .limit(BATCH_SIZE);

        if (contactsError) {
          console.error(`[${requestId}] ❌ Erro ao buscar contatos:`, contactsError);
          continue;
        }

        console.log(`[${requestId}] 📱 Processando ${contacts?.length || 0} contatos`);

        let messageToSend = '';
        if (followUp.follow_up_type === 'manual' && Array.isArray(followUp.manual_messages)) {
          const currentMessage = followUp.manual_messages[executionCount];
          if (currentMessage?.message) {
            messageToSend = currentMessage.message;
            console.log(`[${requestId}] 📝 Usando mensagem manual ${executionCount + 1}:`, messageToSend);
          }
        } else {
          messageToSend = followUp.template_message || '';
          console.log(`[${requestId}] 📝 Usando mensagem template:`, messageToSend);
        }

        if (!messageToSend) {
          console.log(`[${requestId}] ⚠️ Nenhuma mensagem disponível para follow-up ${followUp.id}`);
          continue;
        }

        for (const contact of (contacts || [])) {
          try {
            await sleep(DELAY_BETWEEN_CONTACTS);

            console.log(`[${requestId}] 📝 Enviando mensagem para ${contact.TelefoneClientes}:`, messageToSend);

            await retryWithBackoff(async () => {
              const { error: messageError } = await supabaseClient
                .from('chat_messages')
                .insert({
                  instance_id: followUp.instance_id,
                  user_id: followUp.instance.user_id,
                  content: messageToSend,
                  sender_type: 'follow_up'
                });

              if (messageError) throw messageError;
            });

            await retryWithBackoff(async () => {
              const { error: updateError } = await supabaseClient
                .from('instance_follow_ups')
                .update({
                  execution_count: executionCount + 1,
                  last_execution_time: new Date().toISOString(),
                  next_execution_time: new Date(Date.now() + (followUp.delay_minutes * 60 * 1000)).toISOString()
                })
                .eq('id', followUp.id);

              if (updateError) throw updateError;
            });

            processedFollowUps.push({
              followUpId: followUp.id,
              status: 'success',
              contact: contact.TelefoneClientes
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
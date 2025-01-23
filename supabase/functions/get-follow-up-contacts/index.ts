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
      .filter('execution_count', 'lt', 'max_attempts')
      .order('last_execution_time', { ascending: true, nullsFirst: true });

    if (followUpsError) {
      console.error(`[${requestId}] ❌ Error fetching follow-ups:`, followUpsError);
      throw followUpsError;
    }

    console.log(`[${requestId}] 📊 Follow-ups encontrados:`, followUps?.length || 0);
    console.log(`[${requestId}] 🔍 Detalhes dos follow-ups:`, followUps);

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
        
        if (executionCount >= maxAttempts) {
          console.log(`[${requestId}] ⚠️ Número máximo de tentativas atingido para follow-up ${followUp.id}`);
          
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
        console.log(`[${requestId}] 🔍 Detalhes dos contatos:`, contacts);

        for (const contact of (contacts || [])) {
          try {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CONTACTS));

            const message = followUp.follow_up_type === 'manual' 
              ? (followUp.manual_messages?.[0]?.message || followUp.template_message || '')
              : followUp.template_message || '';

            console.log(`[${requestId}] 📝 Enviando mensagem:`, message);

            const { error: messageError } = await supabaseClient
              .from('chat_messages')
              .insert({
                instance_id: followUp.instance_id,
                user_id: followUp.instance.user_id,
                content: message,
                sender_type: 'follow_up'
              });

            if (messageError) {
              throw messageError;
            }

            console.log(`[${requestId}] ✅ Mensagem enviada com sucesso para:`, contact.TelefoneClientes);

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
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting implementation with reduced limits
const RATE_LIMIT = 5; // Reduced from 10 to 5 concurrent requests
const BATCH_SIZE = 3; // Reduced from 5 to 3 contacts per batch
const DELAY_BETWEEN_CONTACTS = 2000; // Increased delay between contacts to 2 seconds
const activeRequests = new Set();

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] 🚀 Starting get-follow-up-contacts function`);

  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Check rate limit
    if (activeRequests.size >= RATE_LIMIT) {
      console.log(`[${requestId}] ⚠️ Rate limit exceeded`);
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

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log execution start
    console.log(`[${requestId}] 📝 Logging execution start`);
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'started',
        details: 'Starting function execution',
        details_json: { request_id: requestId }
      });

    // Fetch active follow-ups
    console.log(`[${requestId}] 🔍 Fetching active follow-ups`);
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
      .limit(BATCH_SIZE);

    if (followUpsError) {
      throw followUpsError;
    }

    console.log(`[${requestId}] ✅ Found ${followUps?.length || 0} active follow-ups`);

    const processedFollowUps = [];
    const errors = [];

    // Process each follow-up
    for (const followUp of (followUps || [])) {
      try {
        if (!followUp.instance?.connection_status || 
            followUp.instance.connection_status.toLowerCase() !== 'connected') {
          continue;
        }

        console.log(`[${requestId}] 🔄 Processing follow-up for instance ${followUp.instance.name}`);

        const endpoint = followUp.follow_up_type === 'ai_generated' 
          ? 'process-ai-follow-up'
          : 'process-follow-up';

        // Fetch contacts in smaller batches
        const { data: contacts } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .limit(BATCH_SIZE);

        console.log(`[${requestId}] 📊 Found ${contacts?.length || 0} contacts for processing`);

        for (const contact of (contacts || [])) {
          try {
            console.log(`[${requestId}] 🔄 Processing contact ${contact.TelefoneClientes} via ${endpoint}`);
            
            // Add delay between processing contacts
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

            processedFollowUps.push({
              followUpId: followUp.id,
              status: 'success',
              result: response.data
            });

          } catch (error) {
            console.error(`[${requestId}] ❌ Error processing contact:`, error);
            errors.push({
              followUpId: followUp.id,
              status: 'error',
              error: error.message
            });
          }
        }
      } catch (error) {
        console.error(`[${requestId}] ❌ Error processing follow-up:`, error);
        errors.push({
          followUpId: followUp.id,
          status: 'error',
          error: error.message
        });
      }
    }

    // Log completion
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'completed',
        details: 'Function execution completed',
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
    console.error(`[${requestId}] ❌ Critical error:`, error);
    
    // Log error
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'error',
        details: 'Function execution failed',
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
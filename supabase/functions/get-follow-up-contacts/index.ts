import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting implementation
const RATE_LIMIT = 10; // Max concurrent requests
const activeRequests = new Set();

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] 🚀 Starting get-follow-up-contacts function`);

  try {
    // Handle CORS preflight
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

    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Environment variables not configured');
    }

    console.log(`[${requestId}] ✅ Environment variables OK`);
    
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

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

    // Fetch active follow-ups with pagination
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
      .limit(5); // Process in smaller batches

    if (followUpsError) {
      throw followUpsError;
    }

    console.log(`[${requestId}] ✅ Found ${followUps?.length || 0} active follow-ups`);

    const processedFollowUps = [];
    const errors = [];

    // Process each follow-up with resource limits
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

        const { data: contacts } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .limit(2); // Process fewer contacts per batch

        console.log(`[${requestId}] 📊 Found ${contacts?.length || 0} contacts for processing`);

        for (const contact of (contacts || [])) {
          try {
            console.log(`[${requestId}] 🔄 Processing contact ${contact.TelefoneClientes} via ${endpoint}`);
            
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

            // Add delay between processing contacts
            await new Promise(resolve => setTimeout(resolve, 1000));

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
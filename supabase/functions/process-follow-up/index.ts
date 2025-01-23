import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function retryOperation<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      console.log(`🔄 [DEBUG] Retrying operation, ${retries} attempts remaining`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return retryOperation(operation, retries - 1);
    }
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 204
    })
  }

  try {
    console.log('🔄 [DEBUG] Starting follow-up processing')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch active follow-ups with retry
    const { data: followUps, error: followUpsError } = await retryOperation(async () => {
      console.log('🔍 [DEBUG] Fetching active follow-ups')
      return await supabaseClient
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
    });

    if (followUpsError) {
      console.error('❌ [ERROR] Failed to fetch active follow-ups:', followUpsError)
      throw new Error(`Failed to fetch active follow-ups: ${followUpsError.message}`)
    }

    console.log(`✅ [DEBUG] Found ${followUps?.length || 0} active follow-ups`)

    const processedFollowUps = [];
    const errors = [];

    // Process each follow-up with retry
    for (const followUp of (followUps || [])) {
      try {
        if (!followUp.instance?.connection_status || followUp.instance.connection_status.toLowerCase() !== 'connected') {
          console.log(`⚠️ [DEBUG] Instance ${followUp.instance?.name} not connected, skipping`)
          continue;
        }

        console.log(`🔄 [DEBUG] Processing follow-up for instance ${followUp.instance.name}`)

        const endpoint = followUp.follow_up_type === 'ai_generated' 
          ? 'process-ai-follow-up'
          : 'process-follow-up';

        const result = await retryOperation(async () => {
          console.log(`🔄 [DEBUG] Processing via ${endpoint}`)
          const response = await supabaseClient.functions.invoke(endpoint, {
            body: { 
              followUp: {
                ...followUp,
                instance_id: followUp.instance_id,
                instanceName: followUp.instance.name,
                userId: followUp.instance.user_id
              }
            }
          });

          if (response.error) throw response.error;
          return response.data;
        });

        processedFollowUps.push({
          followUpId: followUp.id,
          status: 'success',
          result
        });

      } catch (error) {
        console.error(`❌ [ERROR] Failed to process follow-up ${followUp.id}:`, error)
        errors.push({
          followUpId: followUp.id,
          status: 'error',
          error: error.message
        });
      }
    }

    // Return results with appropriate status code
    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        processed: processedFollowUps.length,
        results: [...processedFollowUps, ...errors],
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: errors.length === 0 ? 200 : 207 // 207 Multi-Status if some operations failed
      }
    )

  } catch (error) {
    console.error('❌ [ERROR] Critical error in follow-up processing:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
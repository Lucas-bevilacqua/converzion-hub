import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] 🚀 Starting get-follow-up-contacts function`);
  
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error(`[${requestId}] ❌ Environment variables not configured:`, {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      });
      throw new Error('Environment variables not configured');
    }

    console.log(`[${requestId}] ✅ Environment variables OK`);
    
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Log execution start
    console.log(`[${requestId}] 📝 Logging execution start`);
    const { error: logError } = await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'started',
        details: 'Starting function execution',
        details_json: { request_id: requestId }
      });

    if (logError) {
      console.error(`[${requestId}] ⚠️ Error logging start:`, logError);
    }

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
      .eq('is_active', true);

    if (followUpsError) {
      console.error(`[${requestId}] ❌ Error fetching follow-ups:`, followUpsError);
      throw followUpsError;
    }

    console.log(`[${requestId}] ✅ Found ${followUps?.length || 0} active follow-ups:`, followUps);

    const processedFollowUps = [];
    const errors = [];

    // Process each follow-up
    for (const followUp of (followUps || [])) {
      try {
        if (!followUp.instance?.connection_status || followUp.instance.connection_status !== 'connected') {
          console.log(`[${requestId}] ⚠️ Instance ${followUp.instance?.name} not connected, skipping`);
          continue;
        }

        console.log(`[${requestId}] 🔄 Processing follow-up for instance ${followUp.instance.name}`);

        // Get contacts for this instance
        const { data: contacts, error: contactsError } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .not('TelefoneClientes', 'is', null)
          .order('last_message_time', { ascending: true, nullsFirst: true });

        if (contactsError) {
          console.error(`[${requestId}] ❌ Error fetching contacts:`, contactsError);
          throw contactsError;
        }

        console.log(`[${requestId}] 📊 Found ${contacts?.length || 0} contacts for processing`);

        // Process each contact
        for (const contact of (contacts || [])) {
          try {
            const endpoint = followUp.follow_up_type === 'ai_generated' 
              ? 'process-ai-follow-up'
              : 'process-follow-up';

            console.log(`[${requestId}] 🔄 Processing contact ${contact.TelefoneClientes} via ${endpoint}`);
            
            const processFollowUpUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${endpoint}`;
            
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
              console.error(`[${requestId}] ❌ Error processing contact:`, {
                status: response.status,
                error: errorText,
                contact: contact.TelefoneClientes
              });
              throw new Error(`Error processing follow-up: ${errorText}`);
            }

            const responseData = await response.json();
            console.log(`[${requestId}] ✅ Follow-up processed successfully:`, responseData);

            processedFollowUps.push({
              followUpId: followUp.id,
              instanceId: followUp.instance_id,
              contactId: contact.id,
              type: followUp.follow_up_type,
              timestamp: new Date().toISOString()
            });

          } catch (contactError) {
            console.error(`[${requestId}] ❌ Error processing contact:`, contactError);
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
        console.error(`[${requestId}] ❌ Error processing follow-up:`, followUpError);
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
    
    console.log(`[${requestId}] 📝 Execution completed:`, finalLog);
    
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'completed',
        details: 'Processing completed successfully',
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
    console.error(`[${requestId}] ❌ Critical error in execution:`, error);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('cron_logs')
        .insert({
          job_name: 'get-follow-up-contacts',
          status: 'error',
          details: 'Critical error in execution',
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
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FollowUpContact {
  id: string;
  instance_id: string;
  execution_count: number;
  max_attempts: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔄 [DEBUG] Starting follow-up contacts processing')

    // Get Supabase URL and key from environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Validate environment variables
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    // Initialize Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // Get all active follow-ups
    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('instance_follow_ups')
      .select('*, evolution_instances!inner(*)')
      .eq('is_active', true)
      .filter('evolution_instances.connection_status', 'eq', 'connected')

    if (followUpsError) {
      console.error('❌ [ERROR] Error fetching follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log('✅ [DEBUG] Found follow-ups:', followUps?.length)

    // Process each follow-up
    const results = await Promise.all(
      (followUps ?? []).map(async (followUp: FollowUpContact) => {
        try {
          // Only process if execution_count is less than max_attempts
          const executionCount = Number(followUp.execution_count) || 0
          const maxAttempts = Number(followUp.max_attempts) || 3

          if (executionCount >= maxAttempts) {
            console.log(`⏭️ [DEBUG] Skipping follow-up ${followUp.id} - max attempts reached (${executionCount}/${maxAttempts})`)
            return {
              success: false,
              followUpId: followUp.id,
              reason: 'max_attempts_reached',
              details: { executionCount, maxAttempts }
            }
          }

          // Update execution count and time
          const { error: updateError } = await supabaseClient
            .from('instance_follow_ups')
            .update({
              execution_count: executionCount + 1,
              last_execution_time: new Date().toISOString()
            })
            .eq('id', followUp.id)

          if (updateError) {
            console.error('❌ [ERROR] Error updating follow-up:', updateError)
            throw updateError
          }

          // Get contacts that haven't been processed yet
          const { data: contacts, error: contactsError } = await supabaseClient
            .from('instance_contacts')
            .select('*')
            .eq('instance_id', followUp.instance_id)
            .eq('follow_up_status', 'pending')
            .limit(50)

          if (contactsError) {
            console.error('❌ [ERROR] Error fetching contacts:', contactsError)
            throw contactsError
          }

          return { 
            success: true, 
            followUpId: followUp.id,
            contactsCount: contacts?.length || 0,
            details: { executionCount: executionCount + 1, maxAttempts }
          }
        } catch (error) {
          console.error('❌ [ERROR] Error processing follow-up:', error)
          return { 
            success: false, 
            followUpId: followUp.id, 
            error: error.message,
            details: { error: error.stack }
          }
        }
      })
    )

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('❌ [ERROR] Unhandled error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 500 
      }
    )
  }
})
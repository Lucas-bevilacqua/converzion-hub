import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔄 [DEBUG] Starting follow-up processing from GitHub Action')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get active follow-ups
    const { data: activeFollowUps, error: followUpsError } = await supabaseClient
      .from('instance_follow_ups')
      .select(`
        id,
        instance_id,
        follow_up_type,
        delay_minutes,
        manual_messages,
        system_prompt
      `)
      .eq('is_active', true)

    if (followUpsError) {
      throw new Error(`Failed to fetch active follow-ups: ${followUpsError.message}`)
    }

    console.log(`✅ [DEBUG] Found ${activeFollowUps?.length || 0} active follow-ups`)

    // Process each active follow-up
    const results = await Promise.all((activeFollowUps || []).map(async (followUp) => {
      try {
        const { error: processError } = await supabaseClient.functions.invoke('get-follow-up-contacts', {
          body: { 
            instanceId: followUp.instance_id,
            followUpId: followUp.id,
            source: 'github-action'
          }
        })

        if (processError) {
          throw processError
        }

        return {
          followUpId: followUp.id,
          status: 'success'
        }
      } catch (error) {
        console.error(`❌ [ERROR] Failed to process follow-up ${followUp.id}:`, error)
        return {
          followUpId: followUp.id,
          status: 'error',
          error: error.message
        }
      }
    }))

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('❌ [ERROR] Follow-up processing failed:', error)
    
    return new Response(
      JSON.stringify({
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
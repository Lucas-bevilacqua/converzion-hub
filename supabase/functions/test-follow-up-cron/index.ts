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
    console.log('🔍 [DEBUG] Starting follow-up cron test')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Test 1: Check if cron job exists
    const { data: cronJobs, error: cronError } = await supabaseClient.rpc(
      'test_follow_up_service_key'
    )

    if (cronError) {
      throw new Error(`Failed to check cron jobs: ${cronError.message}`)
    }

    // Test 2: Check recent executions
    const { data: recentLogs, error: logsError } = await supabaseClient
      .from('cron_logs')
      .select('*')
      .eq('job_name', 'process-ai-follow-up-every-minute')
      .order('execution_time', { ascending: false })
      .limit(5)

    if (logsError) {
      throw new Error(`Failed to check execution logs: ${logsError.message}`)
    }

    // Test 3: Trigger a manual execution
    const { error: executionError } = await supabaseClient.rpc(
      'execute_ai_follow_up'
    )

    if (executionError) {
      throw new Error(`Failed to execute follow-up: ${executionError.message}`)
    }

    const diagnosticResults = {
      cronJobStatus: cronJobs,
      recentExecutions: recentLogs,
      manualExecutionStatus: 'Success',
      timestamp: new Date().toISOString()
    }

    console.log('✅ [DEBUG] Follow-up cron test completed:', diagnosticResults)

    return new Response(
      JSON.stringify(diagnosticResults),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('❌ [ERROR] Follow-up cron test failed:', error)
    
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
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
    console.log('🔍 Starting follow-up system test')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Test 1: Check service key in secure_configurations
    const { data: keyConfig, error: keyError } = await supabaseClient
      .from('secure_configurations')
      .select('config_value')
      .eq('config_key', 'supabase_service_role_key')
      .single()

    if (keyError) {
      throw new Error(`Failed to check service key: ${keyError.message}`)
    }

    // Test 2: Check cron job status
    const { data: cronJobs, error: cronError } = await supabaseClient.rpc(
      'test_follow_up_service_key'
    )

    if (cronError) {
      throw new Error(`Failed to check cron jobs: ${cronError.message}`)
    }

    // Test 3: Check recent executions
    const { data: recentLogs, error: logsError } = await supabaseClient
      .from('cron_logs')
      .select('*')
      .eq('job_name', 'process-ai-follow-up-every-minute')
      .order('execution_time', { ascending: false })
      .limit(5)

    if (logsError) {
      throw new Error(`Failed to check execution logs: ${logsError.message}`)
    }

    // Test 4: Trigger a manual execution
    const { error: executionError } = await supabaseClient.rpc(
      'execute_ai_follow_up'
    )

    if (executionError) {
      throw new Error(`Failed to execute follow-up: ${executionError.message}`)
    }

    const diagnosticResults = {
      serviceKey: {
        exists: !!keyConfig?.config_value,
        timestamp: new Date().toISOString()
      },
      cronJobStatus: cronJobs,
      recentExecutions: recentLogs,
      manualExecutionStatus: 'Success',
      timestamp: new Date().toISOString()
    }

    console.log('✅ Follow-up system test completed:', diagnosticResults)

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
    console.error('❌ Follow-up system test failed:', error)
    
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
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { instanceId, instanceName } = await req.json()
    console.log('Checking state for instance:', { instanceId, instanceName })

    // Validate input
    if (!instanceId) {
      throw new Error('Instance ID is required')
    }

    // Get environment variables
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!evolutionApiUrl || !evolutionApiKey || !supabaseUrl || !supabaseKey) {
      console.error('Missing required environment variables')
      throw new Error('Server configuration error')
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get instance name from database if not provided
    let finalInstanceName = instanceName
    if (!finalInstanceName) {
      const { data: instance, error: instanceError } = await supabase
        .from('evolution_instances')
        .select('name')
        .eq('id', instanceId)
        .single()

      if (instanceError) {
        console.error('Error fetching instance:', instanceError)
        throw instanceError
      }

      if (!instance) {
        throw new Error('Instance not found')
      }

      finalInstanceName = instance.name
    }

    console.log('Checking Evolution API state for:', finalInstanceName)

    // Check instance state in Evolution API
    const response = await fetch(`${evolutionApiUrl}/instance/connectionState/${finalInstanceName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
    })

    if (!response.ok) {
      console.error('Evolution API error:', response.status, await response.text())
      throw new Error('Failed to check instance state')
    }

    const data = await response.json()
    console.log('Evolution API response:', data)

    return new Response(
      JSON.stringify({
        instance: data,
        state: data.state,
        connected: data.state === 'open'
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )

  } catch (error) {
    console.error('Error in check-instance-state:', error)
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      { 
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
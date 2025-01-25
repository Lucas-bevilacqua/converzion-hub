import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { instanceId } = await req.json()
    
    if (!instanceId) {
      console.error('Missing required parameter: instanceId')
      return new Response(
        JSON.stringify({ error: 'Instance ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get secrets
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/, '')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!evolutionApiUrl || !evolutionApiKey || !supabaseUrl || !supabaseKey) {
      console.error('Missing required environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Create Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get instance name from database
    const { data: instance, error: dbError } = await supabase
      .from('evolution_instances')
      .select('name')
      .eq('id', instanceId)
      .single()

    if (dbError || !instance) {
      console.error('Error fetching instance:', dbError)
      return new Response(
        JSON.stringify({ error: 'Instance not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    console.log(`Checking state for instance: ${instance.name} (ID: ${instanceId})`)
    
    const url = `${evolutionApiUrl}/instance/connectionState/${instance.name}`
    console.log('Making request to:', url)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error from Evolution API:', errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to check instance state', details: errorText }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
        )
      }

      const data = await response.json()
      console.log('Instance state response:', data)

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (fetchError) {
      console.error('Error fetching from Evolution API:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to connect to Evolution API', details: fetchError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      )
    }

  } catch (error) {
    console.error('Error in check-instance-state:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
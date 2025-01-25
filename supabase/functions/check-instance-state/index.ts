import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const requestData = await req.json()
    console.log('Received request data:', requestData)

    const { instanceId } = requestData

    // Validate input
    if (!instanceId) {
      console.error('Missing instanceId in request')
      return new Response(
        JSON.stringify({ error: 'Instance ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get environment variables
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!evolutionApiUrl || !evolutionApiKey || !supabaseUrl || !supabaseKey) {
      console.error('Missing required environment variables:', {
        hasEvolutionUrl: !!evolutionApiUrl,
        hasEvolutionKey: !!evolutionApiKey,
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseKey
      })
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get instance name from database
    const { data: instance, error: instanceError } = await supabase
      .from('evolution_instances')
      .select('name')
      .eq('id', instanceId)
      .single()

    if (instanceError) {
      console.error('Error fetching instance:', instanceError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch instance details' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!instance) {
      console.error('Instance not found:', instanceId)
      return new Response(
        JSON.stringify({ error: 'Instance not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Checking Evolution API state for:', instance.name)

    // Check instance state in Evolution API
    const response = await fetch(`${evolutionApiUrl}/instance/connectionState/${instance.name}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
    })

    if (!response.ok) {
      const responseText = await response.text()
      console.error('Evolution API error:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      })
      return new Response(
        JSON.stringify({ 
          error: 'Failed to check instance state',
          details: responseText
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const data = await response.json()
    console.log('Evolution API response:', data)

    // Update instance status in database
    const { error: updateError } = await supabase
      .from('evolution_instances')
      .update({ 
        connection_status: data.state === 'open' ? 'connected' : 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId)

    if (updateError) {
      console.error('Error updating instance status:', updateError)
      // Don't throw here, we still want to return the state
    }

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
        error: error.message || 'An unexpected error occurred'
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
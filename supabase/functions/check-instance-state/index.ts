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
    // Get instance ID from request
    const { instanceId } = await req.json()
    console.log('Received request to check state for instance:', instanceId)

    if (!instanceId) {
      console.error('No instance ID provided')
      return new Response(
        JSON.stringify({ error: 'Instance ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get instance details from database
    const { data: instance, error: instanceError } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      console.error('Error fetching instance:', instanceError)
      return new Response(
        JSON.stringify({ error: 'Instance not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Evolution API configuration
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('Evolution API configuration missing')
      return new Response(
        JSON.stringify({ error: 'Evolution API configuration missing' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Clean the base URL by removing trailing slashes
    const baseUrl = evolutionApiUrl.replace(/\/+$/, '')
    console.log('Checking Evolution API state for:', instance.name)

    // Use the exact endpoint that works with your Evolution API
    const connectionStateUrl = `${baseUrl}/instance/connectionState/${instance.name}`
    console.log('Making request to Evolution API URL:', connectionStateUrl)

    // Check instance state in Evolution API
    const response = await fetch(connectionStateUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      }
    })

    if (!response.ok) {
      console.error('Evolution API error:', {
        status: response.status,
        statusText: response.statusText
      })

      const errorText = await response.text()
      console.error('Error response body:', errorText)

      return new Response(
        JSON.stringify({ 
          error: 'Failed to check instance state',
          details: {
            status: response.status,
            error: response.statusText,
            response: errorText ? JSON.parse(errorText) : null
          }
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
        error: 'Failed to check instance state',
        details: error.message
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
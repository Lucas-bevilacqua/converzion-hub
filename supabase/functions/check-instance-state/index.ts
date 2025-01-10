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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw userError || new Error('User not found')
    }

    // Get instance ID from request body
    const { instanceId } = await req.json()
    console.log('Checking state for instance:', instanceId)
    
    // Get instance details from database
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (instanceError) {
      console.error('Database error:', instanceError)
      throw instanceError
    }

    if (!instance) {
      console.error('Instance not found in database')
      throw new Error('Instance not found')
    }

    // Check instance state in Evolution API
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    if (!evolutionApiUrl) {
      throw new Error('Evolution API URL not configured')
    }

    const baseUrl = evolutionApiUrl.endsWith('/') 
      ? evolutionApiUrl.slice(0, -1) 
      : evolutionApiUrl

    // First check if instance exists in Evolution API
    console.log('Checking if instance exists in Evolution API')
    const checkInstanceUrl = `${baseUrl}/instance/fetchInstances`
    const checkResponse = await fetch(checkInstanceUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') ?? '',
      }
    })

    if (!checkResponse.ok) {
      console.error('Error checking instances:', await checkResponse.text())
      throw new Error('Failed to check instances in Evolution API')
    }

    const instances = await checkResponse.json()
    const instanceExists = instances.some((inst: any) => inst.instanceName === instance.name)

    if (!instanceExists) {
      console.log('Instance does not exist in Evolution API:', instance.name)
      // Update instance status in database to disconnected
      await supabaseClient
        .from('evolution_instances')
        .update({
          connection_status: 'disconnected',
          updated_at: new Date().toISOString()
        })
        .eq('id', instanceId)

      return new Response(
        JSON.stringify({ state: 'disconnected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If instance exists, check its state
    const stateUrl = `${baseUrl}/instance/connectionState/${instance.name}`
    console.log('Checking state at:', stateUrl)

    const stateResponse = await fetch(stateUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') ?? '',
      }
    })

    if (!stateResponse.ok) {
      console.error('Evolution API state check error:', await stateResponse.text())
      throw new Error('Failed to get instance state')
    }

    const stateData = await stateResponse.json()
    console.log('State response:', stateData)

    // Map Evolution API state to our connection status
    let connectionStatus = 'disconnected'
    
    if (stateData.instance?.state === 'open') {
      connectionStatus = 'connected'
    } else if (stateData.instance?.state === 'connecting') {
      connectionStatus = 'pending'
    }

    console.log('Mapped connection status:', connectionStatus)

    // Update instance state in database
    const { error: updateError } = await supabaseClient
      .from('evolution_instances')
      .update({
        connection_status: connectionStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId)

    if (updateError) {
      console.error('Error updating instance status:', updateError)
      throw updateError
    }

    console.log('Instance status updated successfully to:', connectionStatus)

    return new Response(
      JSON.stringify({ state: connectionStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in check-instance-state:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.cause || error.stack
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
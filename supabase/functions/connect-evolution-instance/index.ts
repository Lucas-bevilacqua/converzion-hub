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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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

    // Check subscription status - now including trial status
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .or('status.eq.active,status.eq.trial')
      .maybeSingle()

    if (subError) throw subError
    if (!subscription) {
      return new Response(
        JSON.stringify({ error: 'Active or trial subscription required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { instanceId } = await req.json()

    // Get instance details
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      throw instanceError || new Error('Instance not found')
    }

    // Connect to Evolution API
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API configuration not found')
    }

    // Clean up the base URL and construct the endpoint
    const baseUrl = evolutionApiUrl.replace(/\/+$/, '')
    const instanceName = encodeURIComponent(instance.name)
    
    console.log('Evolution API Base URL:', baseUrl)
    console.log('Instance Name:', instanceName)

    // First, check if instance exists in Evolution API
    const checkInstanceUrl = `${baseUrl}/instance/fetchInstances`
    console.log('Checking instances at:', checkInstanceUrl)
    
    const checkResponse = await fetch(checkInstanceUrl, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!checkResponse.ok) {
      const errorText = await checkResponse.text()
      console.error('Evolution API check instance error:', errorText)
      throw new Error(`Evolution API check failed: ${errorText}`)
    }

    const instances = await checkResponse.json()
    console.log('Available instances:', instances)

    const instanceExists = instances.find((inst: any) => inst.instanceName === instance.name)

    // Only create instance if it doesn't exist
    if (!instanceExists) {
      console.log('Instance not found, creating new instance:', instance.name)
      
      const createUrl = `${baseUrl}/instance/create`
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instanceName: instance.name,
          token: "any",
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        })
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.error('Evolution API create instance error:', errorText)
        
        // If instance already exists, continue with connection
        if (!errorText.includes('already in use')) {
          throw new Error(`Failed to create instance: ${errorText}`)
        }
      }
    }

    // Now connect to get QR code
    const connectUrl = `${baseUrl}/instance/connect/${instanceName}`
    console.log('Connecting to instance at:', connectUrl)
    
    const evolutionResponse = await fetch(connectUrl, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text()
      console.error('Evolution API connect error:', errorText)
      throw new Error(`Evolution API returned status ${evolutionResponse.status}: ${errorText}`)
    }

    const evolutionData = await evolutionResponse.json()
    console.log('Evolution API response:', evolutionData)

    // Extract QR code from response, checking all possible paths
    const qrCode = evolutionData.base64 || 
                  evolutionData.qrcode?.base64 || 
                  evolutionData.qrcode || 
                  evolutionData.data?.qrcode?.base64 || 
                  evolutionData.data?.qrcode

    console.log('QR code found:', qrCode ? 'Yes' : 'No')

    if (!qrCode) {
      console.error('No QR code found in response')
      throw new Error('No QR code found in Evolution API response')
    }

    // Update instance status and QR code
    const { error: updateError } = await supabaseClient
      .from('evolution_instances')
      .update({
        qr_code: qrCode,
        last_qr_update: new Date().toISOString(),
        connection_status: evolutionData.connected ? 'connected' : 'pending'
      })
      .eq('id', instanceId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({
        id: instance.id,
        name: instance.name,
        qrCode: qrCode,
        connected: evolutionData.connected || false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in connect-evolution-instance:', error)
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
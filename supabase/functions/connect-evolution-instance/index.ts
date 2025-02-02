import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'
import { checkInstance, createInstance, connectInstance } from './evolution-api.ts'

console.log('Connect Evolution Instance function started')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response(null, { 
      headers: { ...corsHeaders }
    })
  }

  try {
    console.log('Processing request:', req.method)
    
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
      console.error('User auth error:', userError)
      throw userError || new Error('User not found')
    }

    // Check subscription status
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .or('status.eq.active,status.eq.trial')
      .maybeSingle()

    if (subError) {
      console.error('Subscription check error:', subError)
      throw subError
    }
    
    if (!subscription) {
      console.log('No active subscription found')
      return new Response(
        JSON.stringify({ error: 'Active or trial subscription required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { instanceId } = await req.json()
    console.log('Processing instance:', instanceId)

    // Get instance details
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      console.error('Instance fetch error:', instanceError)
      throw instanceError || new Error('Instance not found')
    }

    // Connect to Evolution API
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('Missing Evolution API configuration')
      throw new Error('Evolution API configuration not found')
    }

    const baseUrl = evolutionApiUrl.replace(/\/+$/, '')
    const instanceName = encodeURIComponent(instance.name)
    
    console.log('Evolution API Base URL:', baseUrl)
    console.log('Instance Name:', instanceName)

    // Check if instance exists
    const instanceExists = await checkInstance(baseUrl, evolutionApiKey, instance.name)
    console.log('Instance exists?', instanceExists)

    // Create instance if it doesn't exist
    if (!instanceExists) {
      console.log('Creating new instance')
      await createInstance(baseUrl, evolutionApiKey, instance.name)
    }

    // Connect and get QR code
    console.log('Connecting instance')
    const evolutionData = await connectInstance(baseUrl, evolutionApiKey, instance.name)
    console.log('Evolution API response:', evolutionData)

    // Extract QR code from response with better error handling
    let qrCode = null
    if (evolutionData.base64) {
      qrCode = evolutionData.base64
    } else if (evolutionData.qrcode?.base64) {
      qrCode = evolutionData.qrcode.base64
    } else if (evolutionData.qrcode) {
      qrCode = evolutionData.qrcode
    } else if (evolutionData.data?.qrcode?.base64) {
      qrCode = evolutionData.data.qrcode.base64
    } else if (evolutionData.data?.qrcode) {
      qrCode = evolutionData.data.qrcode
    }

    if (!qrCode) {
      console.error('No QR code found in response:', evolutionData)
      throw new Error('No QR code found in Evolution API response')
    }

    // Ensure QR code is properly formatted
    if (!qrCode.startsWith('data:image')) {
      qrCode = `data:image/png;base64,${qrCode}`
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

    if (updateError) {
      console.error('Instance update error:', updateError)
      throw updateError
    }

    console.log('Successfully processed instance connection')

    return new Response(
      JSON.stringify({
        id: instance.id,
        name: instance.name,
        qrCode: qrCode,
        connected: evolutionData.connected || false
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        } 
      }
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
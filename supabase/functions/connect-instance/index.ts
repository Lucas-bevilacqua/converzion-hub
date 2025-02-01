import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('Connect Instance function started')

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
    console.log('Attempting to generate QR code...')

    // Generate QR code
    const qrResponse = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text()
      console.error('Evolution API QR code error:', errorText)
      throw new Error(`Failed to generate QR code: ${errorText}`)
    }

    const qrData = await qrResponse.json()
    console.log('QR code response:', qrData)

    const qrCode = qrData.qrcode?.base64 || qrData.qrcode || qrData.base64
    if (!qrCode) {
      console.error('No QR code in response:', qrData)
      throw new Error('No QR code found in Evolution API response')
    }

    // Update instance with QR code
    const { error: updateError } = await supabaseClient
      .from('evolution_instances')
      .update({
        qr_code: qrCode,
        last_qr_update: new Date().toISOString(),
        connection_status: 'pending'
      })
      .eq('id', instanceId)

    if (updateError) {
      console.error('Instance update error:', updateError)
      throw updateError
    }

    console.log('Successfully generated and stored QR code')

    return new Response(
      JSON.stringify({
        id: instance.id,
        name: instance.name,
        qrCode: qrCode
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        } 
      }
    )
  } catch (error) {
    console.error('Error in connect-instance:', error)
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
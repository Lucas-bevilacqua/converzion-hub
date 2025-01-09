import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'
import { checkInstance, createInstance, connectInstance } from './evolution-api.ts'

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

    // Check subscription status
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

    const baseUrl = evolutionApiUrl.replace(/\/+$/, '')
    const instanceName = encodeURIComponent(instance.name)
    
    console.log('Evolution API Base URL:', baseUrl)
    console.log('Instance Name:', instanceName)

    // Check if instance exists
    const instanceExists = await checkInstance(baseUrl, evolutionApiKey, instance.name)

    // Create instance if it doesn't exist
    if (!instanceExists) {
      await createInstance(baseUrl, evolutionApiKey, instance.name)
    }

    // Connect and get QR code
    const evolutionData = await connectInstance(baseUrl, evolutionApiKey, instance.name)

    // Extract QR code from response
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
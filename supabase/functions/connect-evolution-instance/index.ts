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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
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
      .maybeSingle()

    if (subError) throw subError
    if (!subscription || subscription.status !== 'active') {
      throw new Error('Active subscription required')
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
    const evolutionResponse = await fetch(`${Deno.env.get('EVOLUTION_API_URL')}/instance/connect/${instance.name}`, {
      method: 'GET',
      headers: {
        'apikey': Deno.env.get('EVOLUTION_API_KEY') ?? '',
      }
    })

    if (!evolutionResponse.ok) {
      throw new Error('Failed to connect to Evolution API')
    }

    const evolutionData = await evolutionResponse.json()

    // Update instance status and QR code
    const { error: updateError } = await supabaseClient
      .from('evolution_instances')
      .update({
        qr_code: evolutionData.qrcode,
        last_qr_update: new Date().toISOString(),
        connection_status: evolutionData.connected ? 'connected' : 'disconnected'
      })
      .eq('id', instanceId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({
        id: instance.id,
        name: instance.name,
        qrCode: evolutionData.qrcode,
        connected: evolutionData.connected
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
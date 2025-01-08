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

    // Get instance count
    const { count, error: countError } = await supabaseClient
      .from('evolution_instances')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    if (countError) throw countError

    // Check instance limit based on plan
    const instanceLimit = subscription.plan_id?.includes('professional') ? 3 : 1
    if (count && count >= instanceLimit) {
      throw new Error(`Instance limit (${instanceLimit}) reached for your plan`)
    }

    const { instanceName, phoneNumber } = await req.json()

    // Create instance in Evolution API
    const evolutionResponse = await fetch(`${Deno.env.get('EVOLUTION_API_URL')}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') ?? '',
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      })
    })

    if (!evolutionResponse.ok) {
      throw new Error('Failed to create Evolution API instance')
    }

    // Save instance to database
    const { data: instance, error: insertError } = await supabaseClient
      .from('evolution_instances')
      .insert({
        user_id: user.id,
        name: instanceName,
        phone_number: phoneNumber,
        connection_status: 'disconnected'
      })
      .select()
      .single()

    if (insertError) throw insertError

    return new Response(
      JSON.stringify(instance),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
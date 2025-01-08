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

    console.log('Checking subscription for user:', user.id)

    // Get user profile first
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      throw profileError
    }

    if (!profile) {
      console.error('Profile not found for user:', user.id)
      throw new Error('User profile not found')
    }

    // Check subscription status using profile.id
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle()

    if (subError) {
      console.error('Error fetching subscription:', subError)
      throw subError
    }

    console.log('Subscription data:', subscription)

    if (!subscription || subscription.status !== 'active') {
      console.error('No active subscription found for user:', user.id)
      throw new Error('Active subscription required')
    }

    // Get instance count
    const { count, error: countError } = await supabaseClient
      .from('evolution_instances')
      .select('*', { count: 'exact' })
      .eq('user_id', profile.id)

    if (countError) {
      console.error('Error counting instances:', countError)
      throw countError
    }

    console.log('Current instance count:', count)

    // Check instance limit based on plan
    const instanceLimit = subscription.plan_id?.includes('professional') ? 3 : 1
    if (count && count >= instanceLimit) {
      console.error('Instance limit reached:', { count, instanceLimit })
      throw new Error(`Instance limit (${instanceLimit}) reached for your plan`)
    }

    const body = await req.json()
    const { instanceName, phoneNumber } = body

    if (!instanceName || !phoneNumber) {
      console.error('Missing required parameters:', { instanceName, phoneNumber })
      throw new Error('Missing required parameters: instanceName and phoneNumber are required')
    }

    console.log('Creating Evolution API instance:', { instanceName, phoneNumber })

    // Create instance in Evolution API
    const evolutionResponse = await fetch(`${Deno.env.get('EVOLUTION_API_URL')}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') ?? '',
      },
      body: JSON.stringify({
        instanceName: instanceName.replace(/[^a-zA-Z0-9]/g, ''), // Sanitize instance name
        qrcode: true,
        number: phoneNumber.replace(/\D/g, ''), // Remove non-digits
        integration: "WHATSAPP-BAILEYS"
      })
    })

    if (!evolutionResponse.ok) {
      const errorData = await evolutionResponse.text()
      console.error('Evolution API error:', errorData)
      throw new Error(`Failed to create Evolution API instance: ${errorData}`)
    }

    const evolutionData = await evolutionResponse.json()
    console.log('Evolution API response:', evolutionData)

    // Save instance to database
    const { data: instance, error: insertError } = await supabaseClient
      .from('evolution_instances')
      .insert({
        user_id: profile.id,
        name: instanceName,
        phone_number: phoneNumber,
        connection_status: 'disconnected'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      throw insertError
    }

    console.log('Instance created successfully:', instance)

    return new Response(
      JSON.stringify(instance),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    console.error('Error in create-evolution-instance:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
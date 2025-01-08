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
      console.error('User error:', userError)
      throw userError || new Error('User not found')
    }

    console.log('Checking subscription status for user:', user.id)

    // Check subscription status using service role client
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (subError) {
      console.error('Error fetching subscription:', subError)
      throw subError
    }

    if (!subscription) {
      console.error('No active subscription found for user:', user.id)
      return new Response(
        JSON.stringify({ error: 'Active subscription required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get instance count
    const { count, error: countError } = await supabaseClient
      .from('evolution_instances')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    if (countError) {
      console.error('Error counting instances:', countError)
      throw countError
    }

    // Check instance limit based on plan
    const instanceLimit = subscription.plan_id?.includes('professional') ? 3 : 1
    if (count && count >= instanceLimit) {
      console.error('Instance limit reached for user:', user.id)
      return new Response(
        JSON.stringify({ error: `Instance limit (${instanceLimit}) reached for your plan` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { instanceName, phoneNumber } = await req.json()
    console.log('Creating instance with name:', instanceName, 'and phone:', phoneNumber)

    // Create instance in Evolution API
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    if (!evolutionApiUrl) {
      throw new Error('Evolution API URL not configured')
    }

    console.log('Making request to Evolution API:', `${evolutionApiUrl}/instance/create`)
    
    const evolutionResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') ?? '',
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        number: phoneNumber,
        token: true
      })
    })

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text()
      console.error('Evolution API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to create Evolution API instance', details: errorText }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const evolutionData = await evolutionResponse.json()
    console.log('Evolution API response:', evolutionData)

    // Save instance to database using service role client
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

    if (insertError) {
      console.error('Error inserting instance:', insertError)
      throw insertError
    }

    console.log('Instance created successfully:', instance)
    return new Response(
      JSON.stringify(instance),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in create-evolution-instance:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
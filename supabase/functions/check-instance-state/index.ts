import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('Check Instance State function started')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Get the user from the token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Error getting user:', userError)
      throw new Error('Error getting user')
    }

    console.log('Checking subscription for user:', user.id)

    // Check if user has an active subscription or trial
    const { data: subscription, error: subscriptionError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (subscriptionError) {
      console.error('Error checking subscription:', subscriptionError)
      throw new Error('Error checking subscription')
    }

    if (!subscription) {
      console.log('No subscription found for user:', user.id)
      return new Response(
        JSON.stringify({ 
          error: 'No subscription found',
          code: 'subscription_required'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      )
    }

    if (subscription.status !== 'active' && subscription.status !== 'trial') {
      console.log('No active subscription found for user:', user.id, 'Status:', subscription.status)
      return new Response(
        JSON.stringify({ 
          error: 'No active subscription found',
          code: 'subscription_required',
          status: subscription.status
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      )
    }

    // Get the instance ID from the request
    const { instanceId } = await req.json()
    if (!instanceId) {
      throw new Error('No instance ID provided')
    }

    console.log('Checking instance state for:', instanceId)

    // Check if the instance belongs to the user
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .eq('user_id', user.id)
      .single()

    if (instanceError || !instance) {
      console.error('Error getting instance:', instanceError)
      throw new Error('Instance not found or unauthorized')
    }

    // Make request to Evolution API to check instance state
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API configuration missing')
    }

    const response = await fetch(`${evolutionApiUrl}/instance/connectionState/${instance.name}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      }
    })

    if (!response.ok) {
      console.error('Error from Evolution API:', await response.text())
      throw new Error('Failed to check instance state')
    }

    const stateData = await response.json()
    console.log('Instance state:', stateData)

    // Update instance status in database
    const { error: updateError } = await supabaseClient
      .from('evolution_instances')
      .update({
        connection_status: stateData.state,
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId)

    if (updateError) {
      console.error('Error updating instance:', updateError)
      throw new Error('Failed to update instance status')
    }

    return new Response(
      JSON.stringify(stateData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in check-instance-state:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
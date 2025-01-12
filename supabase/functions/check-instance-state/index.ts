import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isAfter, parseISO } from 'https://esm.sh/date-fns@2'

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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header provided')
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    console.log('Checking subscription for user:', user.id)
    const { data: subscription, error: subscriptionError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (subscriptionError) {
      console.error('Error checking subscription:', subscriptionError)
      return new Response(
        JSON.stringify({ error: 'Error checking subscription' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    console.log('Found subscription:', subscription)
    
    // Check if subscription is active or trial is valid
    const hasValidSubscription = subscription && (
      subscription.status === 'active' || 
      (
        subscription.status === 'trial' && 
        subscription.trial_ends_at && 
        !isAfter(new Date(), parseISO(subscription.trial_ends_at))
      )
    )

    console.log('Subscription validation:', {
      status: subscription?.status,
      trial_ends_at: subscription?.trial_ends_at,
      current_time: new Date().toISOString(),
      hasValidSubscription
    })

    if (!hasValidSubscription) {
      console.log('No valid subscription found')
      return new Response(
        JSON.stringify({ 
          error: 'No active or trial subscription found',
          code: 'subscription_required',
          details: { 
            subscription_status: subscription?.status || 'none',
            trial_ends_at: subscription?.trial_ends_at,
            current_time: new Date().toISOString(),
            user_id: user.id
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      )
    }

    let requestBody;
    try {
      requestBody = await req.json()
    } catch (error) {
      console.error('Error parsing request body:', error)
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    const { instanceId } = requestBody
    if (!instanceId) {
      return new Response(
        JSON.stringify({ error: 'Instance ID is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Verify instance belongs to user
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .eq('user_id', user.id)
      .single()

    if (instanceError || !instance) {
      console.error('Error getting instance:', instanceError)
      return new Response(
        JSON.stringify({ error: 'Instance not found or unauthorized' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      )
    }

    // Get Evolution API configuration
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('Evolution API configuration missing')
      return new Response(
        JSON.stringify({ error: 'Evolution API configuration missing' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    try {
      const stateUrl = `${evolutionApiUrl}/instance/connectionState/${instance.name}`
      console.log('Checking state with URL:', stateUrl)
      
      const response = await fetch(stateUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error from Evolution API:', errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to check instance state', details: errorText }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: response.status
          }
        )
      }

      const stateData = await response.json()
      console.log('Instance state response:', stateData)
      
      // Map Evolution API state to our format
      const connectionState = stateData.instance?.state === 'open' ? 'connected' : 'disconnected'
      
      // Update instance state in database
      const { error: updateError } = await supabaseClient
        .from('evolution_instances')
        .update({
          connection_status: connectionState,
          updated_at: new Date().toISOString()
        })
        .eq('id', instanceId)

      if (updateError) {
        console.error('Error updating instance:', updateError)
      }

      return new Response(
        JSON.stringify({ state: connectionState }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )

    } catch (error) {
      console.error('Error checking instance state with Evolution API:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to check instance state', details: error.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

  } catch (error) {
    console.error('Unexpected error in check-instance-state:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
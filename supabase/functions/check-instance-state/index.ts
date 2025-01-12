import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.12'
import { parseISO, isAfter } from 'https://esm.sh/date-fns@3.3.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { instanceId, instanceName } = await req.json()
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify the JWT and get the user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error('Error getting user:', userError)
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          details: userError,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user's subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (subscriptionError) {
      console.error('Error fetching subscription:', subscriptionError)
      return new Response(
        JSON.stringify({
          error: 'Error fetching subscription',
          details: subscriptionError,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const currentTime = new Date()
    console.log('Current time:', currentTime.toISOString())
    console.log('Subscription:', subscription)

    // Check if user has an active subscription or valid trial
    const hasActiveSubscription = subscription?.status === 'active'
    const hasValidTrial = subscription?.status === 'trial' && 
      subscription.trial_ends_at && 
      !isAfter(currentTime, parseISO(subscription.trial_ends_at))

    if (!hasActiveSubscription && !hasValidTrial) {
      console.log('No active subscription found. Trial ends at:', subscription?.trial_ends_at)
      return new Response(
        JSON.stringify({
          error: 'No active or trial subscription found',
          code: 'subscription_required',
          details: {
            subscription_status: subscription?.status || 'none',
            current_time: currentTime.toISOString(),
            trial_ends_at: subscription?.trial_ends_at,
            user_id: user.id,
          },
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get instance details
    const { data: instance, error: instanceError } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (instanceError || !instance) {
      console.error('Error fetching instance:', instanceError)
      return new Response(
        JSON.stringify({
          error: 'Instance not found or unauthorized',
          details: instanceError,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Make API request to Evolution API
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!
    
    // Ensure URL is properly constructed
    const connectionStateUrl = new URL(`/instance/connectionState/${instanceName}`, evolutionApiUrl).toString()
    console.log('Checking connection state at URL:', connectionStateUrl)

    const response = await fetch(connectionStateUrl, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
    })

    if (!response.ok) {
      console.error('Error from Evolution API:', response.status, response.statusText)
      const errorData = await response.text()
      console.error('Error data:', errorData)
      
      return new Response(
        JSON.stringify({
          error: 'Failed to check instance state',
          details: {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          },
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const data = await response.json()
    console.log('Evolution API response:', data)

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
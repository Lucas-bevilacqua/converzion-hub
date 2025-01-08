import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Webhook request received')
    console.log('Request method:', req.method)
    console.log('Request headers:', Object.fromEntries(req.headers.entries()))
    
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    
    if (!stripeKey || !webhookSecret) {
      console.error('Missing required environment variables:', {
        hasStripeKey: !!stripeKey,
        hasWebhookSecret: !!webhookSecret
      })
      throw new Error('Missing Stripe configuration')
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    })

    // Get the raw request body
    const rawBody = await req.text()
    console.log('Raw request body length:', rawBody.length)
    console.log('Raw request body preview:', rawBody.substring(0, 100))

    // Get the Stripe signature
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      console.error('No Stripe signature in headers:', Object.fromEntries(req.headers.entries()))
      return new Response(
        JSON.stringify({ error: 'No Stripe signature provided' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Stripe signature received:', signature)

    // Verify Stripe signature
    let event
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
      console.log('Event constructed successfully:', event.type)
    } catch (err) {
      console.error('Error constructing webhook event:', err)
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed', details: err.message }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client
    console.log('Initializing Supabase client')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        console.log('Processing checkout session:', session.id)

        if (!session.customer || !session.subscription) {
          console.error('Missing customer or subscription:', {
            customer: session.customer,
            subscription: session.subscription
          })
          throw new Error('Invalid checkout session data')
        }

        // Retrieve subscription details
        console.log('Fetching subscription details:', session.subscription)
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        console.log('Subscription details:', subscription)

        // Retrieve customer details
        console.log('Fetching customer details:', session.customer)
        const customer = await stripe.customers.retrieve(session.customer as string)
        console.log('Customer details:', customer)

        if (!customer.email) {
          console.error('No customer email found')
          throw new Error('Customer email missing')
        }

        // Get user from Supabase using client_reference_id
        console.log('Looking up user:', session.client_reference_id)
        const { data: userData, error: userError } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('id', session.client_reference_id)
          .single()

        if (userError || !userData) {
          console.error('Error finding user:', userError)
          throw new Error('User not found')
        }

        console.log('Found user:', userData)

        // Update subscription in database
        const { error: subscriptionError } = await supabaseClient
          .from('subscriptions')
          .upsert({
            user_id: userData.id,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            status: 'active',
            plan_id: subscription.items.data[0].price.id,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })

        if (subscriptionError) {
          console.error('Error updating subscription:', subscriptionError)
          throw subscriptionError
        }

        console.log('Subscription updated successfully')
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        console.log('Processing subscription update:', subscription.id)

        const { error } = await supabaseClient
          .from('subscriptions')
          .update({
            status: subscription.status === 'active' ? 'active' : 'past_due',
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error('Error updating subscription:', error)
          throw error
        }

        console.log('Subscription status updated successfully')
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        console.log('Processing subscription deletion:', subscription.id)

        const { error } = await supabaseClient
          .from('subscriptions')
          .update({
            status: 'canceled',
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error('Error updating subscription:', error)
          throw error
        }

        console.log('Subscription marked as canceled')
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Processing webhook request...')
    
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

    // Get the signature from the headers
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      console.error('No Stripe signature found in request')
      throw new Error('No signature provided')
    }

    console.log('Received webhook with signature:', signature)

    // Get the raw body
    const body = await req.text()
    console.log('Webhook raw body:', body)
    
    // Verify the webhook signature
    let event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      console.log('Webhook event verified:', event.type)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    console.log('Initializing Supabase client...')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log('Checkout session completed:', session)

        if (!session.customer || !session.subscription) {
          console.error('Missing customer or subscription information:', {
            customer: session.customer,
            subscription: session.subscription
          })
          throw new Error('Missing customer or subscription information')
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        console.log('Subscription retrieved:', subscription)

        // Get user from customer metadata
        const customer = await stripe.customers.retrieve(session.customer as string)
        console.log('Customer retrieved:', customer)

        if (!customer.email) {
          console.error('No customer email found')
          throw new Error('No customer email found')
        }

        // Get user from Supabase by email
        console.log('Looking up user with client reference ID:', session.client_reference_id)
        const { data: userData, error: userError } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('id', session.client_reference_id)
          .single()

        if (userError || !userData) {
          console.error('Error getting user:', userError)
          throw new Error('User not found')
        }

        console.log('Updating subscription for user:', userData.id)

        // Update or create subscription record
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
        const subscription = event.data.object as Stripe.Subscription
        console.log('Subscription updated:', subscription.id)

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
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        console.log('Subscription deleted:', subscription.id)

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
    console.error('Error processing webhook:', error)
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
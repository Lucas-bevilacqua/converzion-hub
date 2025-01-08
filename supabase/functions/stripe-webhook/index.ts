import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { handleCheckoutCompleted, handleSubscriptionUpdated, handleSubscriptionDeleted } from './webhookHandlers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  console.log('Webhook request received')
  console.log('Request method:', req.method)
  console.log('Request headers:', Object.fromEntries(req.headers.entries()))

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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
    const rawBody = await req.text()
    console.log('Raw request body length:', rawBody.length)
    console.log('Raw request body preview:', rawBody.substring(0, 100))

    let event: Stripe.Event
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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, stripe, supabaseClient)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event, supabaseClient)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, supabaseClient)
        break

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
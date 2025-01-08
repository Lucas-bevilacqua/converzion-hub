import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { handleCheckoutCompleted, handleSubscriptionUpdated, handleSubscriptionDeleted } from './webhookHandlers.ts'
import { crypto, toHashString } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const STRIPE_TOLERANCE = 5 * 60 * 1000; // 5 minutes tolerance

  // Extract timestamp and signatures from header
  const [timestampHeader, v1Signature] = header.split(',').map(part => part.split('=')[1]);
  const timestamp = parseInt(timestampHeader);

  // Check timestamp is not too old
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > STRIPE_TOLERANCE) {
    throw new Error('Timestamp too old');
  }

  // Prepare the signed payload
  const signedPayload = `${timestamp}.${payload}`;
  
  // Convert secret to Uint8Array
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Sign the payload
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload)
  );

  // Convert to hex
  const computedSignature = toHashString(new Uint8Array(signature));
  
  // Compare signatures
  return computedSignature === v1Signature;
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

    // Verify signature manually
    const isValid = await verifyStripeSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // Parse the event
    const event = JSON.parse(rawBody) as Stripe.Event;
    console.log('Event parsed successfully:', event.type)

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
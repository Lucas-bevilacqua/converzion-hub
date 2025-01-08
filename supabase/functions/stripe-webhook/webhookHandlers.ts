import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

export const handleCheckoutCompleted = async (
  event: Stripe.Event,
  stripe: Stripe,
  supabaseClient: any
) => {
  const session = event.data.object as Stripe.Checkout.Session
  console.log('Processing checkout session:', session.id)

  if (!session.customer || !session.subscription) {
    console.error('Missing customer or subscription:', {
      customer: session.customer,
      subscription: session.subscription
    })
    throw new Error('Invalid checkout session data')
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
  console.log('Subscription details:', subscription)

  const customer = await stripe.customers.retrieve(session.customer as string)
  console.log('Customer details:', customer)

  if (!customer.email) {
    console.error('No customer email found')
    throw new Error('Customer email missing')
  }

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
}

export const handleSubscriptionUpdated = async (
  event: Stripe.Event,
  supabaseClient: any
) => {
  const subscription = event.data.object as Stripe.Subscription
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
}

export const handleSubscriptionDeleted = async (
  event: Stripe.Event,
  supabaseClient: any
) => {
  const subscription = event.data.object as Stripe.Subscription
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
}
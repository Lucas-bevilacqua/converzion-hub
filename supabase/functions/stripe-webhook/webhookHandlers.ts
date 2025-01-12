import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from 'https://esm.sh/stripe@14.21.0'

export async function handleCheckoutCompleted(
  event: Stripe.Event,
  stripe: Stripe,
  supabaseClient: ReturnType<typeof createClient>
) {
  console.log('Processing checkout.session.completed event')
  const session = event.data.object as Stripe.Checkout.Session

  if (!session?.subscription || !session?.customer) {
    console.error('Missing subscription or customer in session')
    throw new Error('Missing subscription or customer in session')
  }

  console.log('Fetching subscription details from Stripe')
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  )

  if (!subscription) {
    console.error('No subscription found in Stripe')
    throw new Error('No subscription found')
  }

  console.log('Subscription retrieved:', {
    id: subscription.id,
    priceId: subscription.items.data[0].price.id,
    customerId: session.customer
  })

  if (!session.client_reference_id) {
    console.error('No client_reference_id in session')
    throw new Error('No client_reference_id found in session')
  }

  console.log('Looking up user:', session.client_reference_id)
  const { data: userData, error: userError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', session.client_reference_id)
    .single()

  if (userError || !userData) {
    console.error('Error finding user:', userError)
    throw userError || new Error('User not found')
  }

  console.log('Found user:', userData)

  // First check if a subscription already exists for this user
  const { data: existingSubscription } = await supabaseClient
    .from('subscriptions')
    .select('*')
    .eq('user_id', userData.id)
    .maybeSingle()

  const subscriptionData = {
    user_id: userData.id,
    stripe_customer_id: session.customer,
    stripe_subscription_id: session.subscription,
    status: subscription.status === 'active' ? 'active' : 'past_due',
    plan_id: subscription.items.data[0].price.id,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    trial_ends_at: null, // Remove trial when upgrading
    trial_started_at: null // Remove trial when upgrading
  }

  console.log('Updating subscription with data:', subscriptionData)

  let error
  if (existingSubscription) {
    // If exists, update it
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .update(subscriptionData)
      .eq('id', existingSubscription.id)
    error = updateError
  } else {
    // If doesn't exist, create it
    const { error: insertError } = await supabaseClient
      .from('subscriptions')
      .insert(subscriptionData)
    error = insertError
  }

  if (error) {
    console.error('Error updating subscription:', error)
    throw error
  }

  console.log('Subscription updated successfully')
}

export async function handleSubscriptionUpdated(
  event: Stripe.Event,
  supabaseClient: ReturnType<typeof createClient>
) {
  console.log('Processing customer.subscription.updated event')
  const subscription = event.data.object as Stripe.Subscription

  // Find the subscription in our database
  const { data: subscriptionData, error: findError } = await supabaseClient
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (findError) {
    console.error('Error finding subscription:', findError)
    throw findError
  }

  if (!subscriptionData) {
    console.error('No subscription found in database')
    return
  }

  console.log('Updating subscription:', {
    id: subscriptionData.id,
    newPlanId: subscription.items.data[0].price.id,
    newStatus: subscription.status
  })

  const { error: updateError } = await supabaseClient
    .from('subscriptions')
    .update({
      status: subscription.status === 'active' ? 'active' : 
              subscription.status === 'past_due' ? 'past_due' : 'canceled',
      plan_id: subscription.items.data[0].price.id,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_ends_at: null, // Remove trial when updating subscription
      trial_started_at: null // Remove trial when updating subscription
    })
    .eq('id', subscriptionData.id)

  if (updateError) {
    console.error('Error updating subscription:', updateError)
    throw updateError
  }

  console.log('Subscription updated successfully')
}

export async function handleSubscriptionDeleted(
  event: Stripe.Event,
  supabaseClient: ReturnType<typeof createClient>
) {
  console.log('Processing customer.subscription.deleted event')
  const subscription = event.data.object as Stripe.Subscription

  const { error } = await supabaseClient
    .from('subscriptions')
    .update({ 
      status: 'canceled',
      trial_ends_at: null,
      trial_started_at: null
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error canceling subscription:', error)
    throw error
  }

  console.log('Subscription canceled successfully')
}
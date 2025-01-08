export type Subscription = {
  id: string;
  user_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: 'active' | 'canceled' | 'past_due' | null;
  plan_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}
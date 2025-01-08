import { type Subscription } from "@/integrations/supabase/database-types/subscriptions"

export function usePlanDetails(subscription: Subscription | null) {
  const getPlanDetails = () => {
    console.log('Obtendo detalhes do plano para assinatura:', subscription)
    console.log('Status da assinatura:', subscription?.status)
    console.log('ID do plano:', subscription?.plan_id)
    
    if (!subscription || subscription.status !== 'active') {
      return {
        name: 'Gratuito',
        instances: 0,
        color: 'text-gray-500',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200'
      }
    }

    return subscription.plan_id === 'price_1OqbuViKkjJ7tububpw8Vpsrq'
      ? {
          name: 'Profissional',
          instances: 3,
          color: 'text-purple-500',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200'
        }
      : {
          name: 'Inicial',
          instances: 1,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        }
  }

  return getPlanDetails()
}
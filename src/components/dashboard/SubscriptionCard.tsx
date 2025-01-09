import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useSubscription } from "./subscription/useSubscription"
import { useUpgradeSubscription } from "./subscription/useUpgradeSubscription"
import { ActiveSubscriptionCard } from "./subscription/ActiveSubscriptionCard"
import { TrialAlert } from "./overview/TrialAlert"
import { isAfter } from "date-fns"

export function SubscriptionCard() {
  const { data: subscription, isLoading } = useSubscription()
  const { handleUpgrade } = useUpgradeSubscription()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  // Se está em trial e ainda não terminou, mostra apenas o indicador de trial na visão geral
  if (subscription?.status === 'trial' && subscription.trial_ends_at) {
    const trialEnded = isAfter(new Date(), new Date(subscription.trial_ends_at))
    
    if (!trialEnded) {
      // Na visão geral, mostra apenas o alerta de trial
      if (window.location.pathname === '/dashboard') {
        return <TrialAlert trialEndsAt={subscription.trial_ends_at} />
      }
      
      // Na página de assinatura, mostra apenas o status do trial
      return <TrialAlert trialEndsAt={subscription.trial_ends_at} />
    }
  }

  // Se não há assinatura ativa ou trial expirado
  if (!subscription || subscription.status !== 'active') {
    // Na visão geral, não mostra nada
    if (window.location.pathname === '/dashboard') {
      return null
    }
    
    // Na página de assinatura, mostra apenas uma mensagem de que não há assinatura ativa
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Você não possui uma assinatura ativa no momento.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Se há uma assinatura ativa, mostra os detalhes da assinatura
  return (
    <ActiveSubscriptionCard
      planName={subscription.plan_id?.includes('professional') ? 'Profissional' : 'Inicial'}
      instances={subscription.plan_id?.includes('professional') ? 3 : 1}
      currentPeriodEnd={subscription.current_period_end!}
      onUpgrade={() => handleUpgrade('price_1QbuUvKkjJ7tububiklS9tAc')}
    />
  )
}
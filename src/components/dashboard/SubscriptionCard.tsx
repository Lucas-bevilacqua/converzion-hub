import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useSubscription } from "./subscription/useSubscription"
import { useUpgradeSubscription } from "./subscription/useUpgradeSubscription"
import { ActiveSubscriptionCard } from "./subscription/ActiveSubscriptionCard"
import { PlansDisplay } from "./subscription/PlansDisplay"
import { isAfter } from "date-fns"

const plans = [
  {
    name: "Starter",
    price: "497,00",
    description: "Perfeito para começar",
    features: [
      "1 Instância",
      "5.000 Interações de IA",
      "Suporte por email",
      "Integração básica com HubSpot",
      "Modelo de IA: GPT-4",
      "Análises básicas",
    ],
    priceId: "price_1QbuUvKkjJ7tububiklS9tAc"
  },
  {
    name: "Professional",
    price: "997,00",
    description: "Para negócios em crescimento",
    features: [
      "3 Instâncias",
      "15.000 Interações de IA",
      "Suporte prioritário",
      "Modelo de IA: GPT-4",
      "Análises avançadas",
      "Treinamento de IA",
    ],
    highlighted: true,
    priceId: "price_1QbuUvKkjJ7tububiklS9tAc"
  }
]

export function SubscriptionCard() {
  const { data: subscription, isLoading } = useSubscription()
  const { handleUpgrade } = useUpgradeSubscription()

  // Wrapper function to handle Plan object
  const handlePlanUpgrade = (plan: typeof plans[0]) => {
    handleUpgrade(plan.priceId)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  // Se não há assinatura ativa ou trial expirado, mostra os planos disponíveis
  if (!subscription || subscription.status !== 'active') {
    return (
      <PlansDisplay 
        plans={plans}
        onUpgrade={handlePlanUpgrade}
      />
    )
  }

  // Se há uma assinatura ativa, mostra o status da assinatura
  return (
    <ActiveSubscriptionCard
      planName={subscription.plan_id === 'professional' ? 'Professional' : 'Starter'}
      instances={subscription.plan_id === 'professional' ? 3 : 1}
      currentPeriodEnd={subscription.current_period_end!}
      onUpgrade={() => handleUpgrade('price_1QbuUvKkjJ7tububiklS9tAc')}
    />
  )
}
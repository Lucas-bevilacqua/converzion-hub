import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import { PlanCard } from "./subscription/PlanCard"
import { ActiveSubscriptionCard } from "./subscription/ActiveSubscriptionCard"
import { PlansDisplay } from "./subscription/PlansDisplay"
import { TrialAlert } from "./overview/TrialAlert"
import { isAfter } from "date-fns"

const plans = [
  {
    name: "Starter Plan",
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
    priceId: "price_1QbuUiKkjJ7tububpw8Vpsrp"
  },
  {
    name: "Professional Plan",
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
  const { user } = useAuth()
  const { toast } = useToast()

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      console.log('Fetching subscription for user:', user?.id)
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user?.id)
          .maybeSingle()
        
        if (error) {
          console.error('Error fetching subscription:', error)
          throw error
        }

        if (data?.status === 'trial' && data.trial_ends_at) {
          const trialEnded = isAfter(new Date(), new Date(data.trial_ends_at))
          
          if (trialEnded) {
            console.log('Trial period ended, updating status')
            const { error: updateError } = await supabase
              .from('subscriptions')
              .update({ status: null })
              .eq('id', data.id)
            
            if (updateError) {
              console.error('Error updating subscription status:', updateError)
            } else {
              return {
                ...data,
                status: null
              }
            }
          }
        }

        console.log('Subscription data:', data)
        return data
      } catch (error) {
        console.error('Error in subscription query:', error)
        throw error
      }
    },
    enabled: !!user?.id
  })

  const handleUpgrade = async (plan: typeof plans[0]) => {
    try {
      console.log('Iniciando processo de checkout para o plano:', plan.name)
      
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { 
          priceId: plan.priceId
        },
      })

      if (error) {
        console.error('Erro do stripe-checkout:', error)
        throw error
      }
      
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('URL de checkout não retornada')
      }
    } catch (error) {
      console.error('Erro ao criar sessão de checkout:', error)
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o checkout. Tente novamente.",
        variant: "destructive",
      })
    }
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

  // Se está em trial e ainda não terminou, mostra o indicador de trial na visão geral
  if (subscription?.status === 'trial' && subscription.trial_ends_at) {
    const trialEnded = isAfter(new Date(), new Date(subscription.trial_ends_at))
    
    if (!trialEnded) {
      return (
        <div className="space-y-6">
          {window.location.pathname === '/dashboard' && (
            <TrialAlert trialEndsAt={subscription.trial_ends_at} />
          )}
          <PlansDisplay
            plans={plans}
            onUpgrade={handleUpgrade}
            trialPlanName="Professional Plan"
          />
        </div>
      )
    }
  }

  // Se não há assinatura ativa ou trial expirado, mostra os planos disponíveis
  if (!subscription || subscription.status !== 'active') {
    return (
      <PlansDisplay
        plans={plans}
        onUpgrade={handleUpgrade}
      />
    )
  }

  // Se há uma assinatura ativa, mostra os detalhes da assinatura e os planos disponíveis
  return (
    <div className="space-y-6">
      <ActiveSubscriptionCard
        planName={subscription.plan_id?.includes('professional') ? 'Profissional' : 'Inicial'}
        instances={subscription.plan_id?.includes('professional') ? 3 : 1}
        currentPeriodEnd={subscription.current_period_end!}
        onUpgrade={() => handleUpgrade(plans[1])}
      />
      <PlansDisplay
        plans={plans}
        onUpgrade={handleUpgrade}
        currentPlanId={subscription.plan_id}
      />
    </div>
  )
}
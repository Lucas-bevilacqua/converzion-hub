import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Crown, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import { PlanCard } from "./subscription/PlanCard"
import { TrialBadge } from "./subscription/TrialBadge"
import { differenceInDays } from "date-fns"

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
    priceId: "price_1QbuUiKkjJ7tububpw8Vpsrp"
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
      const { data: { session } } = await supabase.auth.getSession()
      
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

  const getDaysRemaining = () => {
    if (!subscription?.trial_ends_at) return 0
    const daysRemaining = differenceInDays(new Date(subscription.trial_ends_at), new Date())
    return Math.max(0, daysRemaining)
  }

  const isInTrial = subscription?.status === 'trial' && getDaysRemaining() > 0

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  // Se está em trial, mostra o badge com dias restantes
  if (isInTrial) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-purple-500" />
            Trial Professional Ativo
          </CardTitle>
          <CardDescription>
            Aproveite todos os recursos do plano Professional
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <TrialBadge daysRemaining={getDaysRemaining()} />
            
            <div className="p-4 border rounded-lg bg-purple-50 border-purple-200">
              <h3 className="text-lg font-semibold text-purple-600 mb-2">
                Plano Professional
              </h3>
              <p className="text-sm text-muted-foreground">
                Acesso completo a todas as funcionalidades
              </p>
            </div>

            <Button 
              onClick={() => handleUpgrade(plans[1])} 
              className="w-full"
            >
              Assinar Agora
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Se não há assinatura ativa ou trial expirado, mostra os planos disponíveis
  if (!subscription || subscription.status !== 'active') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Escolha seu plano
          </CardTitle>
          <CardDescription>
            Selecione o plano ideal para o seu negócio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {plans.map((plan) => (
              <PlanCard
                key={plan.name}
                {...plan}
                onSelect={() => handleUpgrade(plan)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Se há uma assinatura ativa, mostra os detalhes da assinatura
  const planDetails = subscription.plan_id?.includes('professional')
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className={`h-5 w-5 ${planDetails.color}`} />
          Plano Atual
        </CardTitle>
        <CardDescription>
          Gerencie sua assinatura
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className={`p-4 border rounded-lg ${planDetails.bgColor} ${planDetails.borderColor}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-lg font-semibold ${planDetails.color}`}>
                Plano {planDetails.name}
              </h3>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              {planDetails.instances} instância{planDetails.instances !== 1 ? 's' : ''} disponíve{planDetails.instances !== 1 ? 'is' : 'l'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Válido até: {new Date(subscription.current_period_end!).toLocaleDateString()}
            </p>
          </div>

          <Button 
            onClick={() => handleUpgrade(plans[1])} 
            className="w-full"
            variant="outline"
          >
            Fazer Upgrade
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
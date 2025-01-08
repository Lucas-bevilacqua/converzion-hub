import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Crown, Loader2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import { PlanDetailsSection } from "./subscription/PlanDetailsSection"
import { SubscriptionWarning } from "./subscription/SubscriptionWarning"
import { UpgradeButton } from "./subscription/UpgradeButton"
import { useSubscription } from "@/hooks/useSubscription"
import { usePlanDetails } from "@/hooks/usePlanDetails"

export function SubscriptionCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: subscription, isLoading } = useSubscription(user?.id)
  const planDetails = usePlanDetails(subscription)

  const handleUpgrade = async () => {
    try {
      console.log('Iniciando processo de checkout')
      console.log('Assinatura atual:', subscription)
      
      const priceId = !subscription || subscription.status !== 'active'
        ? 'price_1OqbuUiKkjJ7tububpw8Vpsrp'
        : 'price_1OqbuViKkjJ7tububpw8Vpsrq'
      
      console.log('ID do preço selecionado:', priceId)
      
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { priceId }
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
        {isLoading ? (
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <PlanDetailsSection 
              subscription={subscription} 
              planDetails={planDetails}
            />

            {subscription?.status !== 'active' && (
              <SubscriptionWarning />
            )}

            <UpgradeButton 
              subscription={subscription}
              onUpgrade={handleUpgrade}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
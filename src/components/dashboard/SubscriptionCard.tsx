import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Crown, Loader2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/components/ui/use-toast"

export function SubscriptionCard() {
  const { user } = useAuth()
  const { toast } = useToast()

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!user?.id
  })

  const handleUpgrade = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { priceId: subscription?.plan_id },
      })

      if (error) throw error
      
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      toast({
        title: "Error",
        description: "Could not initiate checkout. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-500" />
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
        ) : subscription ? (
          <div className="space-y-4">
            <div>
              <p className="font-medium">Status: {subscription.status}</p>
              <p className="text-sm text-muted-foreground">
                Válido até: {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>
            <Button onClick={handleUpgrade}>
              Fazer Upgrade
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Você ainda não tem uma assinatura ativa
            </p>
            <Button onClick={handleUpgrade}>
              Assinar Agora
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
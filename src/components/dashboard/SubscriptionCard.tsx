import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Crown, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/components/ui/use-toast"

export function SubscriptionCard() {
  const { user } = useAuth()
  const { toast } = useToast()

  const { data: subscription, isLoading, error } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      console.log('Buscando assinatura para o usuário:', user?.id)
      try {
        if (!user?.id) {
          console.log('Usuário não encontrado')
          return null
        }

        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (error) {
          console.error('Erro ao buscar assinatura:', error)
          throw error
        }

        console.log('Dados da assinatura:', data)
        return data
      } catch (error) {
        console.error('Erro na consulta de assinatura:', error)
        throw error
      }
    },
    enabled: !!user?.id,
    retry: 1,
    onError: (error) => {
      console.error('Erro na query de assinatura:', error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados da assinatura",
        variant: "destructive",
      })
    }
  })

  const handleUpgrade = async () => {
    try {
      console.log('Iniciando processo de checkout')
      console.log('Assinatura atual:', subscription)
      
      const priceId = !subscription || subscription.status !== 'active'
        ? 'price_1OqbuUiKkjJ7tububpw8Vpsrp' // Plano inicial
        : 'price_1OqbuViKkjJ7tububpw8Vpsrq' // Plano profissional
      
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

  const planDetails = getPlanDetails()

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Erro ao carregar dados da assinatura
            </p>
          </div>
        </CardContent>
      </Card>
    )
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
            <div className={`p-4 border rounded-lg ${planDetails.bgColor} ${planDetails.borderColor}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-lg font-semibold ${planDetails.color}`}>
                  Plano {planDetails.name}
                </h3>
                {subscription?.status === 'active' && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {planDetails.instances} instância{planDetails.instances !== 1 ? 's' : ''} disponíve{planDetails.instances !== 1 ? 'is' : 'l'}
              </p>
              {subscription?.status === 'active' && subscription.current_period_end && (
                <p className="text-sm text-muted-foreground mt-1">
                  Válido até: {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>

            {subscription?.status !== 'active' && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <p className="text-sm text-yellow-700">
                  Você precisa de uma assinatura ativa para usar as instâncias
                </p>
              </div>
            )}

            <Button 
              onClick={handleUpgrade} 
              className="w-full"
              variant={subscription?.status === 'active' ? 'outline' : 'default'}
            >
              {subscription?.status === 'active' ? 'Fazer Upgrade' : 'Assinar Agora'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
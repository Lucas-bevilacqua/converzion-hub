import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import type { Subscription } from "@/integrations/supabase/database-types/subscriptions"

export function useSubscription(userId: string | undefined) {
  const { toast } = useToast()

  return useQuery({
    queryKey: ['subscription', userId],
    queryFn: async () => {
      console.log('Buscando assinatura para o usuário:', userId)
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()
        
        if (error) {
          console.error('Erro ao buscar assinatura:', error)
          throw error
        }

        console.log('Dados da assinatura:', data)
        return data as Subscription | null
      } catch (error) {
        console.error('Erro na consulta de assinatura:', error)
        throw error
      }
    },
    enabled: !!userId,
    retry: 1,
    meta: {
      onError: () => {
        console.error('Erro na query de assinatura')
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados da assinatura",
          variant: "destructive",
        })
      }
    }
  })
}
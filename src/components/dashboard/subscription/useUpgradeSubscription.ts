import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"

export const useUpgradeSubscription = () => {
  const { toast } = useToast()

  const handleUpgrade = async (priceId: string) => {
    try {
      console.log('Iniciando processo de checkout para o plano com priceId:', priceId)
      
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { priceId },
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

  return { handleUpgrade }
}
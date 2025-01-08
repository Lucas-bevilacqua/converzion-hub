import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Bot, Loader2 } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"

export function AISettingsCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [prompt, setPrompt] = useState("")

  const { data: settings, isLoading } = useQuery({
    queryKey: ['ai-settings', user?.id],
    queryFn: async () => {
      console.log('Fetching AI settings for user:', user?.id)
      try {
        const { data, error } = await supabase
          .from('ai_settings')
          .select('*')
          .eq('user_id', user?.id)
          .maybeSingle()
        
        if (error) {
          console.error('Error fetching AI settings:', error)
          throw error
        }

        console.log('AI settings found:', data)
        return data
      } catch (error) {
        console.error('Error in AI settings query:', error)
        throw error
      }
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (settings?.system_prompt) {
      setPrompt(settings.system_prompt)
    }
  }, [settings])

  const mutation = useMutation({
    mutationFn: async (newPrompt: string) => {
      console.log('Updating AI settings with new prompt:', newPrompt)
      const { error } = await supabase
        .from('ai_settings')
        .update({ system_prompt: newPrompt })
        .eq('user_id', user?.id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
      toast({
        title: "Configurações salvas",
        description: "As configurações da IA foram atualizadas com sucesso.",
      })
    },
    onError: (error) => {
      console.error('Error updating AI settings:', error)
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações. Tente novamente.",
        variant: "destructive",
      })
    }
  })

  const handleSave = () => {
    mutation.mutate(prompt)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Configurações da IA
        </CardTitle>
        <CardDescription>
          Configure o comportamento do assistente
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea
              placeholder="Digite o prompt do sistema..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
            <Button 
              onClick={handleSave}
              disabled={mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar Configurações
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Bot, Loader2 } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth/AuthContext"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"

interface AISettings {
  settings: {
    delay_minutes: number;
    max_retries: number;
  };
  system_prompt: string | null;
}

type AISettingsResponse = {
  id: string;
  user_id: string | null;
  system_prompt: string | null;
  temperature: number | null;
  created_at: string;
  updated_at: string;
  settings: {
    delay_minutes: number;
    max_retries: number;
  } | null;
}

export function AISettingsCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [prompt, setPrompt] = useState("")
  const [delayMinutes, setDelayMinutes] = useState(5)
  const [maxRetries, setMaxRetries] = useState(3)

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
        const aiSettings: AISettings = {
          system_prompt: data?.system_prompt,
          settings: (data?.settings as { delay_minutes: number; max_retries: number; }) || {
            delay_minutes: 5,
            max_retries: 3
          }
        }
        return aiSettings
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
    if (settings?.settings?.delay_minutes) {
      setDelayMinutes(settings.settings.delay_minutes)
    }
    if (settings?.settings?.max_retries) {
      setMaxRetries(settings.settings.max_retries)
    }
  }, [settings])

  const mutation = useMutation({
    mutationFn: async (values: { prompt: string; delayMinutes: number; maxRetries: number }) => {
      console.log('Updating AI settings:', values)
      const { error } = await supabase
        .from('ai_settings')
        .update({ 
          system_prompt: values.prompt,
          settings: {
            delay_minutes: values.delayMinutes,
            max_retries: values.maxRetries
          }
        })
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
    mutation.mutate({ 
      prompt,
      delayMinutes: Number(delayMinutes),
      maxRetries: Number(maxRetries)
    })
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
            <div className="space-y-2">
              <Label>Prompt do Sistema</Label>
              <Textarea
                placeholder="Digite o prompt do sistema..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Intervalo entre mensagens (minutos)</Label>
                <Input
                  type="number"
                  min={1}
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(Number(e.target.value))}
                  placeholder="Ex: 5"
                />
              </div>

              <div className="space-y-2">
                <Label>Número máximo de tentativas</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(Number(e.target.value))}
                  placeholder="Ex: 3"
                />
              </div>
            </div>

            <Button 
              onClick={handleSave}
              disabled={mutation.isPending}
              className="w-full"
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
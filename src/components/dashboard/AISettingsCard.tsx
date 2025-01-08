import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Bot, Loader2 } from "lucide-react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { useState } from "react"

export function AISettingsCard() {
  const { user } = useAuth()
  const [prompt, setPrompt] = useState("")

  const { data: settings, isLoading } = useQuery({
    queryKey: ['ai-settings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single()
      
      if (error) throw error
      if (data) setPrompt(data.system_prompt || "")
      return data
    },
    enabled: !!user?.id
  })

  const mutation = useMutation({
    mutationFn: async (newPrompt: string) => {
      const { error } = await supabase
        .from('ai_settings')
        .update({ system_prompt: newPrompt })
        .eq('user_id', user?.id)
      
      if (error) throw error
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FollowUpSection } from "./FollowUpSection"
import { InstanceToolsSection } from "./InstanceToolsSection"

interface InstancePromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: string
  currentPrompt?: string | null
}

interface AISettingsResponse {
  settings: {
    delay_minutes: number
    max_retries: number
  } | null
}

export function InstancePromptDialog({
  open,
  onOpenChange,
  instanceId,
  currentPrompt,
}: InstancePromptDialogProps) {
  const { toast } = useToast()
  const [values, setValues] = useState({
    prompt: "",
    objective: "custom" as const,
    delayMinutes: 5,
    maxRetries: 3,
  })

  useEffect(() => {
    if (currentPrompt) {
      console.log('Updating form with current values:', { prompt: currentPrompt, objective: 'custom' })
      setValues(prev => ({ ...prev, prompt: currentPrompt }))
    }

    // Fetch AI settings
    const fetchAISettings = async () => {
      try {
        console.log('Fetching AI settings for instance:', instanceId)
        const { data, error } = await supabase
          .from('ai_settings')
          .select('settings')
          .eq('instance_id', instanceId)
          .maybeSingle()

        if (error) {
          console.error('Error fetching AI settings:', error)
          throw error
        }

        console.log('Received AI settings:', data)
        const aiSettings = data as AISettingsResponse | null
        if (aiSettings?.settings) {
          setValues(prev => ({
            ...prev,
            delayMinutes: aiSettings.settings.delay_minutes || 5,
            maxRetries: aiSettings.settings.max_retries || 3
          }))
        }
      } catch (error) {
        console.error('Error fetching AI settings:', error)
      }
    }

    fetchAISettings()
  }, [currentPrompt, instanceId])

  const handleSave = async () => {
    try {
      console.log('Saving instance settings:', values)
      
      // Update instance prompt
      const { error: instanceError } = await supabase
        .from('evolution_instances')
        .update({ system_prompt: values.prompt })
        .eq('id', instanceId)

      if (instanceError) throw instanceError

      // Update AI settings
      const { error: aiSettingsError } = await supabase
        .from('ai_settings')
        .upsert({
          instance_id: instanceId,
          settings: {
            delay_minutes: values.delayMinutes,
            max_retries: values.maxRetries
          }
        })

      if (aiSettingsError) throw aiSettingsError

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso.",
      })

      onOpenChange(false)
    } catch (error) {
      console.error('Erro ao salvar configurações:', error)
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl mx-auto h-[90vh] md:h-auto">
        <DialogHeader>
          <DialogTitle>Configurar Instância</DialogTitle>
          <DialogDescription>
            Configure o comportamento e objetivo desta instância do WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-full max-h-[calc(90vh-8rem)] pr-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full grid grid-cols-4 mb-4">
              <TabsTrigger value="general">Geral</TabsTrigger>
              <TabsTrigger value="ai">IA</TabsTrigger>
              <TabsTrigger value="follow-up">Follow-up</TabsTrigger>
              <TabsTrigger value="tools">Ferramentas</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="objective">Objetivo</Label>
                  <Select
                    value={values.objective}
                    onValueChange={(value) => setValues((prev) => ({ ...prev, objective: value as typeof prev.objective }))}
                  >
                    <SelectTrigger id="objective">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Vendas</SelectItem>
                      <SelectItem value="support">Suporte</SelectItem>
                      <SelectItem value="scheduling">Agendamento</SelectItem>
                      <SelectItem value="education">Educação</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="prompt">Prompt do Sistema</Label>
                  <Textarea
                    id="prompt"
                    value={values.prompt}
                    onChange={(e) => setValues((prev) => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Digite as instruções para o assistente..."
                    className="min-h-[200px]"
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:space-x-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave}>Salvar</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ai">
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="prompt">Prompt do Sistema</Label>
                  <Textarea
                    id="prompt"
                    value={values.prompt}
                    onChange={(e) => setValues((prev) => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Digite as instruções para o assistente..."
                    className="min-h-[200px]"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="delayMinutes">Intervalo entre mensagens (minutos)</Label>
                    <Input
                      id="delayMinutes"
                      type="number"
                      min={1}
                      value={values.delayMinutes}
                      onChange={(e) => setValues(prev => ({ ...prev, delayMinutes: Number(e.target.value) }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxRetries">Número máximo de tentativas</Label>
                    <Input
                      id="maxRetries"
                      type="number"
                      min={1}
                      max={10}
                      value={values.maxRetries}
                      onChange={(e) => setValues(prev => ({ ...prev, maxRetries: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:space-x-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave}>Salvar</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="follow-up">
              <FollowUpSection instanceId={instanceId} />
            </TabsContent>

            <TabsContent value="tools">
              <InstanceToolsSection instanceId={instanceId} />
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
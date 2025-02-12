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
  })

  useEffect(() => {
    if (currentPrompt) {
      console.log('Updating form with current values:', { prompt: currentPrompt, objective: 'custom' })
      setValues(prev => ({ ...prev, prompt: currentPrompt }))
    }
  }, [currentPrompt])

  const handleSave = async () => {
    try {
      console.log('Saving instance settings:', values)
      
      const { error: instanceError } = await supabase
        .from('evolution_instances')
        .update({ system_prompt: values.prompt })
        .eq('id', instanceId)

      if (instanceError) throw instanceError

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
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="general">Geral</TabsTrigger>
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
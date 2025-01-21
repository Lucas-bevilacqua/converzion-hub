import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Calendar, Users, Check, X, ExternalLink, Key, Webhook, Brain, CreditCard, Settings } from "lucide-react"
import { InstanceTool, ToolType, TOOL_CONFIGS } from "@/types/instance-tools"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface InstanceToolsSectionProps {
  instanceId: string;
}

export function InstanceToolsSection({ instanceId }: InstanceToolsSectionProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedTool, setSelectedTool] = useState<ToolType | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['instance-tools', instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instance_tools')
        .select('*')
        .eq('instance_id', instanceId)

      if (error) throw error
      return data as InstanceTool[]
    },
  })

  const addToolMutation = useMutation({
    mutationFn: async (toolType: ToolType) => {
      const { data, error } = await supabase
        .from('instance_tools')
        .insert({
          instance_id: instanceId,
          tool_type: toolType,
          is_active: true,
          settings: {},
          webhook_url: toolType === ToolType.N8N ? webhookUrl : undefined,
          webhook_secret: toolType === ToolType.N8N ? webhookSecret : undefined,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instance-tools'] })
      toast({
        title: "Ferramenta adicionada",
        description: "A ferramenta foi adicionada com sucesso.",
      })
      setShowAddDialog(false)
      setSelectedTool(null)
      setWebhookUrl("")
      setWebhookSecret("")
    },
    onError: (error) => {
      console.error('Erro ao adicionar ferramenta:', error)
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a ferramenta. Tente novamente.",
        variant: "destructive",
      })
    }
  })

  const toggleToolMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('instance_tools')
        .update({ is_active })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instance-tools'] })
      toast({
        title: "Status atualizado",
        description: "O status da ferramenta foi atualizado com sucesso.",
      })
    },
    onError: (error) => {
      console.error('Erro ao atualizar status:', error)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status. Tente novamente.",
        variant: "destructive",
      })
    }
  })

  const handleAddTool = () => {
    if (!selectedTool) return

    if (selectedTool === ToolType.WEBHOOK && (!webhookUrl || !webhookSecret)) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor preencha a URL e o segredo do webhook.",
        variant: "destructive",
      })
      return
    }

    addToolMutation.mutate(selectedTool)
  }

  const getToolIcon = (toolType: ToolType) => {
    switch (toolType) {
      case ToolType.CALENDAR:
        return <Calendar className="h-4 w-4" />
      case ToolType.CRM:
        return <Users className="h-4 w-4" />
      case ToolType.LANGCHAIN:
        return <Brain className="h-4 w-4" />
      case ToolType.N8N:
        return <Webhook className="h-4 w-4" />
      case ToolType.PAYMENT:
        return <CreditCard className="h-4 w-4" />
      case ToolType.CUSTOM:
        return <Settings className="h-4 w-4" />
      default:
        return null
    }
  }

  const availableTools = Object.values(ToolType).filter(
    toolType => !tools.some(tool => tool.tool_type === toolType)
  )

  if (isLoading) {
    return <div>Carregando...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Ferramentas</h3>
        {availableTools.length > 0 && (
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            Adicionar
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {tools.map((tool) => (
          <Collapsible key={tool.id}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-card rounded-lg hover:bg-accent">
              <div className="flex items-center space-x-4">
                {getToolIcon(tool.tool_type)}
                <div>
                  <h4 className="text-sm font-medium">
                    {TOOL_CONFIGS[tool.tool_type].label}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {TOOL_CONFIGS[tool.tool_type].description}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Badge variant={tool.is_active ? "default" : "secondary"}>
                  {tool.is_active ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    <X className="h-3 w-3 mr-1" />
                  )}
                  {tool.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4 pt-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={tool.is_active}
                    onCheckedChange={(checked) =>
                      toggleToolMutation.mutate({ id: tool.id, is_active: checked })
                    }
                  />
                  <Label>Ativo</Label>
                </div>
                {tool.setup_guide?.documentation_url && (
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={tool.setup_guide.documentation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1"
                    >
                      <span>Documentação</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Ferramenta</DialogTitle>
            <DialogDescription>
              Selecione uma ferramenta para adicionar à sua instância.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ferramenta</Label>
              <Select
                value={selectedTool || ""}
                onValueChange={(value) => setSelectedTool(value as ToolType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma ferramenta" />
                </SelectTrigger>
                <SelectContent>
                  {availableTools.map((toolType) => (
                    <SelectItem key={toolType} value={toolType}>
                      <div className="flex items-center space-x-2">
                        {getToolIcon(toolType)}
                        <span>{TOOL_CONFIGS[toolType].label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTool === ToolType.WEBHOOK && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>URL do Webhook</Label>
                  <Input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Segredo do Webhook</Label>
                  <Input
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    type="password"
                    placeholder="Digite o segredo do webhook"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false)
                  setSelectedTool(null)
                  setWebhookUrl("")
                  setWebhookSecret("")
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddTool}
                disabled={!selectedTool || addToolMutation.isPending}
              >
                {addToolMutation.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
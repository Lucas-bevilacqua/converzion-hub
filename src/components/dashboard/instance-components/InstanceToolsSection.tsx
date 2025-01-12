import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar, CreditCard, Users, Settings2, Loader2 } from "lucide-react";
import { InstanceTool, ToolType } from "@/types/instance-tools";
import { useToast } from "@/components/ui/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface InstanceToolsSectionProps {
  instanceId: string;
}

const TOOL_ICONS = {
  calendar: Calendar,
  payment: CreditCard,
  crm: Users,
  custom: Settings2,
};

const TOOL_LABELS = {
  calendar: "Calendário",
  payment: "Pagamentos",
  crm: "CRM",
  custom: "Personalizado",
};

const TOOL_DESCRIPTIONS = {
  calendar: "Integre com Google Calendar, Calendly ou outros serviços de agenda",
  payment: "Processe pagamentos via Stripe, PayPal ou outros gateways",
  crm: "Conecte com HubSpot, Pipedrive ou outros CRMs",
  custom: "Configure integrações personalizadas",
};

export function InstanceToolsSection({ instanceId }: InstanceToolsSectionProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [webhookUrls, setWebhookUrls] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: tools, isLoading } = useQuery({
    queryKey: ['instance-tools', instanceId],
    queryFn: async () => {
      console.log('Fetching tools for instance:', instanceId);
      const { data, error } = await supabase
        .from('instance_tools')
        .select('*')
        .eq('instance_id', instanceId);

      if (error) {
        console.error('Error fetching tools:', error);
        throw error;
      }

      // Initialize webhook URLs from tools data
      const urls: Record<string, string> = {};
      data?.forEach(tool => {
        urls[tool.tool_type] = tool.settings?.webhook_url || '';
      });
      setWebhookUrls(urls);

      return data as InstanceTool[];
    },
  });

  const updateToolMutation = useMutation({
    mutationFn: async ({ 
      toolType, 
      isActive, 
      webhookUrl 
    }: { 
      toolType: ToolType; 
      isActive: boolean; 
      webhookUrl: string;
    }) => {
      console.log('Updating tool:', { toolType, isActive, webhookUrl });
      
      const existingTool = tools?.find(t => t.tool_type === toolType);
      const settings = { webhook_url: webhookUrl };

      if (existingTool) {
        const { error } = await supabase
          .from('instance_tools')
          .update({ 
            is_active: isActive,
            settings,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTool.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('instance_tools')
          .insert({
            instance_id: instanceId,
            tool_type: toolType,
            is_active: isActive,
            settings
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instance-tools'] });
      toast({
        title: "Sucesso",
        description: "Configurações da ferramenta atualizadas.",
      });
    },
    onError: (error) => {
      console.error('Error updating tool:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar as configurações.",
        variant: "destructive",
      });
    },
  });

  const handleToggleTool = async (toolType: ToolType, currentState: boolean) => {
    try {
      setIsUpdating(true);
      await updateToolMutation.mutateAsync({ 
        toolType, 
        isActive: !currentState,
        webhookUrl: webhookUrls[toolType] || ''
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleWebhookUrlChange = (toolType: ToolType, url: string) => {
    setWebhookUrls(prev => ({ ...prev, [toolType]: url }));
  };

  const handleSaveWebhook = async (toolType: ToolType) => {
    try {
      setIsUpdating(true);
      const tool = tools?.find(t => t.tool_type === toolType);
      await updateToolMutation.mutateAsync({ 
        toolType, 
        isActive: tool?.is_active || false,
        webhookUrl: webhookUrls[toolType] || ''
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getToolState = (toolType: ToolType) => {
    const tool = tools?.find(t => t.tool_type === toolType);
    return tool?.is_active || false;
  };

  const availableTools: ToolType[] = ['calendar', 'payment', 'crm', 'custom'];

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Configure as integrações com n8n para cada ferramenta. Você precisará criar um workflow no n8n e colar a URL do webhook aqui.
      </div>
      <div className="space-y-4">
        {availableTools.map((toolType) => {
          const Icon = TOOL_ICONS[toolType];
          const isActive = getToolState(toolType);

          return (
            <Collapsible key={toolType}>
              <div className="flex items-center justify-between p-2 hover:bg-accent rounded-lg">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor={`tool-${toolType}`} className="text-sm font-medium">
                    {TOOL_LABELS[toolType]}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`tool-${toolType}`}
                    checked={isActive}
                    onCheckedChange={() => handleToggleTool(toolType, isActive)}
                    disabled={isUpdating}
                  />
                  <CollapsibleTrigger className="hover:bg-accent rounded p-1">
                    <Settings2 className="h-4 w-4" />
                  </CollapsibleTrigger>
                </div>
              </div>
              <CollapsibleContent className="px-2 py-4">
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    {TOOL_DESCRIPTIONS[toolType]}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="URL do webhook do n8n"
                      value={webhookUrls[toolType] || ''}
                      onChange={(e) => handleWebhookUrlChange(toolType, e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={() => handleSaveWebhook(toolType)}
                      disabled={isUpdating}
                      size="sm"
                    >
                      {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
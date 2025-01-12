import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  calendar: "Permite que seus clientes agendem horários automaticamente",
  payment: "Permite que seus clientes realizem pagamentos pelo WhatsApp",
  crm: "Registra automaticamente informações dos seus clientes",
  custom: "Integrações personalizadas para seu negócio",
};

export function InstanceToolsSection({ instanceId }: InstanceToolsSectionProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
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

      return data as InstanceTool[];
    },
  });

  const updateToolMutation = useMutation({
    mutationFn: async ({ 
      toolType, 
      isActive
    }: { 
      toolType: ToolType; 
      isActive: boolean;
    }) => {
      console.log('Updating tool:', { toolType, isActive });
      
      const existingTool = tools?.find(t => t.tool_type === toolType);

      if (existingTool) {
        const { error } = await supabase
          .from('instance_tools')
          .update({ 
            is_active: isActive,
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
            is_active: isActive
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instance-tools'] });
      toast({
        title: "Sucesso",
        description: "Status da ferramenta atualizado.",
      });
    },
    onError: (error) => {
      console.error('Error updating tool:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status da ferramenta.",
        variant: "destructive",
      });
    },
  });

  const handleToggleTool = async (toolType: ToolType, currentState: boolean) => {
    try {
      setIsUpdating(true);
      await updateToolMutation.mutateAsync({ 
        toolType, 
        isActive: !currentState
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
        Ative ou desative as ferramentas disponíveis para esta instância do WhatsApp.
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
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
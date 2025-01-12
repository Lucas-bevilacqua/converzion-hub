import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar, CreditCard, Users, Settings2 } from "lucide-react";
import { InstanceTool, ToolType } from "@/types/instance-tools";
import { useToast } from "@/components/ui/use-toast";

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

export function InstanceToolsSection({ instanceId }: InstanceToolsSectionProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: tools, refetch } = useQuery({
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

  const handleToggleTool = async (toolType: ToolType, currentState: boolean) => {
    try {
      setIsUpdating(true);
      console.log('Toggling tool:', { toolType, currentState });

      const existingTool = tools?.find(t => t.tool_type === toolType);

      if (existingTool) {
        // Atualizar ferramenta existente
        const { error } = await supabase
          .from('instance_tools')
          .update({ is_active: !currentState })
          .eq('id', existingTool.id);

        if (error) throw error;
      } else {
        // Criar nova ferramenta
        const { error } = await supabase
          .from('instance_tools')
          .insert({
            instance_id: instanceId,
            tool_type: toolType,
            is_active: true,
          });

        if (error) throw error;
      }

      await refetch();
      toast({
        title: "Sucesso",
        description: `Ferramenta ${currentState ? 'desativada' : 'ativada'} com sucesso.`,
      });
    } catch (error) {
      console.error('Error toggling tool:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a ferramenta.",
        variant: "destructive",
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

  return (
    <div className="space-y-6">
      <div className="text-sm font-medium">Ferramentas Disponíveis</div>
      <div className="space-y-4">
        {availableTools.map((toolType) => {
          const Icon = TOOL_ICONS[toolType];
          const isActive = getToolState(toolType);

          return (
            <div key={toolType} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor={`tool-${toolType}`} className="text-sm">
                  {TOOL_LABELS[toolType]}
                </Label>
              </div>
              <Switch
                id={`tool-${toolType}`}
                checked={isActive}
                onCheckedChange={() => handleToggleTool(toolType, isActive)}
                disabled={isUpdating}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar, CreditCard, Users, Check, X } from "lucide-react";
import { InstanceTool, ToolType } from "@/types/instance-tools";
import { useToast } from "@/components/ui/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge";

interface InstanceToolsSectionProps {
  instanceId: string;
}

const TOOL_ICONS = {
  calendar: Calendar,
  payment: CreditCard,
  crm: Users,
};

const TOOL_LABELS = {
  calendar: "Calendário",
  payment: "Pagamentos",
  crm: "CRM",
};

const TOOL_DESCRIPTIONS = {
  calendar: "Conecte seu sistema de agendamentos para que seus clientes possam marcar horários automaticamente pelo WhatsApp",
  payment: "Integre seu sistema de pagamentos para receber pagamentos diretamente pelo WhatsApp",
  crm: "Conecte seu CRM para registrar automaticamente informações dos seus clientes",
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
        description: "Status da ferramenta atualizado. Nossa equipe entrará em contato para configurar a integração.",
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

  const availableTools: ToolType[] = ['calendar', 'payment', 'crm'];

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Ative as ferramentas que deseja integrar ao seu WhatsApp. Nossa equipe entrará em contato
        para ajudar com a configuração de cada ferramenta ativada.
      </div>
      <div className="space-y-4">
        {availableTools.map((toolType) => {
          const Icon = TOOL_ICONS[toolType];
          const isActive = getToolState(toolType);

          return (
            <Collapsible key={toolType}>
              <div className="flex items-center justify-between p-4 bg-background border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <Label className="text-base font-medium">
                      {TOOL_LABELS[toolType]}
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      {isActive ? (
                        <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800">
                          <Check className="h-3 w-3" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <X className="h-3 w-3" />
                          Inativo
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Switch
                    checked={isActive}
                    onCheckedChange={() => handleToggleTool(toolType, isActive)}
                    disabled={isUpdating}
                  />
                  <CollapsibleTrigger className="hover:bg-accent rounded p-1">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 15 15"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 transition-transform duration-200"
                    >
                      <path
                        d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z"
                        fill="currentColor"
                        fillRule="evenodd"
                        clipRule="evenodd"
                      />
                    </svg>
                  </CollapsibleTrigger>
                </div>
              </div>
              <CollapsibleContent className="px-4 py-3 mt-2 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {TOOL_DESCRIPTIONS[toolType]}
                </p>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
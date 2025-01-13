import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar, Users, Check, X, ExternalLink, Key } from "lucide-react";
import { InstanceTool, ToolType } from "@/types/instance-tools";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InstanceToolsSectionProps {
  instanceId: string;
}

const TOOL_ICONS = {
  calendar: Calendar,
  crm: Users,
};

const TOOL_LABELS = {
  calendar: "Calendário",
  crm: "CRM",
};

const TOOL_DESCRIPTIONS = {
  calendar: "Conecte seu sistema de agendamentos para que seus clientes possam marcar horários automaticamente pelo WhatsApp",
  crm: "Conecte seu CRM para registrar automaticamente informações dos seus clientes",
};

const TOOL_PROVIDERS = {
  calendar: [
    { id: 'google', name: 'Google Calendar', setupUrl: 'https://calendar.google.com/calendar/embedhelper' },
    { id: 'outlook', name: 'Outlook Calendar', setupUrl: 'https://outlook.office.com/calendar/view/month' },
    { id: 'calendly', name: 'Calendly', setupUrl: 'https://calendly.com/app/settings/integrations' },
  ],
  crm: [
    { id: 'hubspot', name: 'HubSpot', setupUrl: 'https://app.hubspot.com/api-key' },
    { id: 'pipedrive', name: 'Pipedrive', setupUrl: 'https://app.pipedrive.com/settings/api' },
  ],
};

const TOOL_SETUP_GUIDES = {
  calendar: {
    title: "Como configurar o Calendário",
    steps: [
      "1. Acesse sua conta do serviço de calendário escolhido",
      "2. Vá em Configurações > Integrações",
      "3. Gere uma chave de API ou token de acesso",
      "4. Cole a chave aqui para ativar a integração"
    ],
    docsUrl: "https://support.google.com/calendar/answer/37083",
    autoSetupAvailable: true,
    setupUrl: "https://calendar.google.com/calendar/embedhelper"
  },
  crm: {
    title: "Como configurar o CRM",
    steps: [
      "1. Acesse seu CRM (HubSpot, Pipedrive, etc)",
      "2. Vá nas configurações de API/Integrações",
      "3. Gere uma nova chave de API",
      "4. Copie a chave de API gerada",
      "5. Configure a chave aqui para sincronizar contatos"
    ],
    docsUrl: "https://knowledge.hubspot.com/pt/integrations/how-do-i-get-my-hubspot-api-key",
    autoSetupAvailable: true,
    setupUrl: "https://app.hubspot.com/api-key"
  },
};

export function InstanceToolsSection({ instanceId }: InstanceToolsSectionProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolType | null>(null);
  const [credentialDialog, setCredentialDialog] = useState(false);
  const [credentials, setCredentials] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
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
      isActive,
      credentials,
      provider
    }: { 
      toolType: ToolType; 
      isActive: boolean;
      credentials?: string;
      provider?: string;
    }) => {
      console.log('Updating tool:', { toolType, isActive, hasCredentials: !!credentials, provider });
      
      const existingTool = tools?.find(t => t.tool_type === toolType);
      const settings = credentials ? { 
        api_key: credentials,
        provider: provider 
      } : {};

      if (existingTool) {
        const { error } = await supabase
          .from('instance_tools')
          .update({ 
            is_active: isActive,
            settings: credentials ? settings : existingTool.settings,
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
            settings: settings,
            setup_guide: TOOL_SETUP_GUIDES[toolType]
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
      setCredentialDialog(false);
      setCredentials("");
      setSelectedProvider("");
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
      if (!currentState) {
        setSelectedTool(toolType);
        setCredentialDialog(true);
      } else {
        await updateToolMutation.mutateAsync({ 
          toolType, 
          isActive: !currentState
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCredentialSubmit = async () => {
    if (!selectedTool) return;
    
    await updateToolMutation.mutateAsync({
      toolType: selectedTool,
      isActive: true,
      credentials,
      provider: selectedProvider
    });
  };

  const getToolState = (toolType: ToolType) => {
    const tool = tools?.find(t => t.tool_type === toolType);
    return tool?.is_active || false;
  };

  const availableTools: ToolType[] = ['calendar', 'crm'];

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
        Ative as ferramentas que deseja integrar ao seu WhatsApp. Para cada ferramenta,
        você precisará fornecer as credenciais necessárias para a integração funcionar.
      </div>
      <div className="space-y-4">
        {availableTools.map((toolType) => {
          const Icon = TOOL_ICONS[toolType];
          const isActive = getToolState(toolType);
          const guide = TOOL_SETUP_GUIDES[toolType];

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
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {TOOL_DESCRIPTIONS[toolType]}
                  </p>
                  <div className="space-y-3">
                    <h4 className="font-medium">{guide.title}</h4>
                    <ul className="list-none space-y-2">
                      {guide.steps.map((step, index) => (
                        <li key={index} className="text-sm text-muted-foreground">
                          {step}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => window.open(guide.docsUrl, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ver documentação completa
                      </Button>
                      {guide.autoSetupAvailable && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            setSelectedTool(toolType);
                            setCredentialDialog(true);
                          }}
                        >
                          <Key className="h-4 w-4 mr-2" />
                          Obter credenciais
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      <Dialog open={credentialDialog} onOpenChange={setCredentialDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar {selectedTool && TOOL_LABELS[selectedTool]}</DialogTitle>
            <DialogDescription>
              Selecione o provedor e configure as credenciais para ativar a integração.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select
                value={selectedProvider}
                onValueChange={setSelectedProvider}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um provedor" />
                </SelectTrigger>
                <SelectContent>
                  {selectedTool && TOOL_PROVIDERS[selectedTool].map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProvider && (
              <div className="space-y-2">
                <Label>Chave de API</Label>
                <Input
                  type="password"
                  placeholder="Cole sua chave de API aqui"
                  value={credentials}
                  onChange={(e) => setCredentials(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => {
                    const provider = selectedTool && TOOL_PROVIDERS[selectedTool].find(p => p.id === selectedProvider);
                    if (provider) {
                      window.open(provider.setupUrl, '_blank');
                    }
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Obter chave de API
                </Button>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCredentialDialog(false);
                  setCredentials("");
                  setSelectedProvider("");
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCredentialSubmit} 
                disabled={!credentials || !selectedProvider}
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

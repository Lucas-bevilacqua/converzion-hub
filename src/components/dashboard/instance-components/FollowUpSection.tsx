import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth/AuthContext"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Trash2, Users, Play, AlertCircle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ContactsTable } from "./ContactsTable"

interface FollowUpSectionProps {
  instanceId: string
}

type FollowUpType = "manual" | "ai";

interface ManualMessage {
  message: string;
  delay_minutes: number;
}

interface FollowUpData {
  id: string;
  instance_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  type: FollowUpType;
  created_at: string;
  updated_at: string;
  scheduled_for: string;
  completed_at?: string;
  settings: {
    is_active?: boolean;
    stop_on_reply?: boolean;
    stop_on_keyword?: string[];
    system_prompt?: string;
  };
  metadata: Record<string, any>;
  instance?: {
    id: string;
    connection_status?: string;
  }
}

interface FormData {
  is_active: boolean;
  type: FollowUpType;
  stop_on_reply: boolean;
  stop_on_keyword: string[];
  manual_messages: ManualMessage[];
  system_prompt?: string;
}

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = INITIAL_DELAY
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      console.log(`🔄 [DEBUG] Retrying operation, ${retries} attempts remaining, waiting ${delay}ms`);
      await sleep(delay);
      return retryWithBackoff(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

export function FollowUpSection({ instanceId }: FollowUpSectionProps) {
  console.log('🔄 [DEBUG] FollowUpSection - Mounting component with instanceId:', instanceId);
  
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: followUp, isLoading } = useQuery({
    queryKey: ['follow-up', instanceId],
    queryFn: async () => {
      console.log('🔄 [DEBUG] Fetching follow-up data for instance:', instanceId);
      const { data, error } = await supabase
        .from('follow_ups')
        .select(`
          *,
          instance:evolution_instances (
            id,
            connection_status
          )
        `)
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('❌ [ERROR] Error fetching follow-up:', error);
        throw error;
      }

      console.log('✅ [DEBUG] Follow-up data retrieved:', data);
      return data as FollowUpData | null;
    },
    enabled: !!instanceId
  });

  const [formData, setFormData] = useState<FormData>({
    is_active: followUp?.settings?.is_active || false,
    type: followUp?.type || "manual",
    stop_on_reply: followUp?.settings?.stop_on_reply ?? true,
    stop_on_keyword: followUp?.settings?.stop_on_keyword || ['comprou', 'agendou', 'agendado', 'comprado'],
    manual_messages: [],
    system_prompt: followUp?.settings?.system_prompt || ''
  });

  useEffect(() => {
    console.log('🔄 [DEBUG] useEffect triggered - followUp changed:', followUp);
    if (followUp) {
      setFormData({
        is_active: followUp.settings?.is_active || false,
        type: followUp.type || "manual",
        stop_on_reply: followUp.settings?.stop_on_reply ?? true,
        stop_on_keyword: followUp.settings?.stop_on_keyword || ['comprou', 'agendou', 'agendado', 'comprado'],
        manual_messages: [],
        system_prompt: followUp.settings?.system_prompt || ''
      });
    }
  }, [followUp]);

  const { data: followUpMessages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ['follow-up-messages', followUp?.id],
    queryFn: async () => {
      if (!followUp?.id) return [];
      
      console.log('🔄 [DEBUG] Fetching messages for follow-up:', followUp.id);
      const { data, error } = await supabase
        .from('follow_up_messages')
        .select('*')
        .eq('follow_up_id', followUp.id)
        .order('delay_minutes', { ascending: true });

      if (error) {
        console.error('❌ [ERROR] Error fetching follow-up messages:', error);
        throw error;
      }

      console.log('✅ [DEBUG] Follow-up messages loaded:', data);
      return data;
    },
    enabled: !!followUp?.id
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('follow_up_messages')
        .delete()
        .eq('id', messageId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-messages'] })
      toast({
        title: "Sucesso",
        description: "Mensagem removida com sucesso.",
      })
    },
    onError: (error) => {
      console.error('❌ [ERROR] Error deleting message:', error)
      toast({
        title: "Erro",
        description: "Não foi possível remover a mensagem.",
        variant: "destructive",
      })
    }
  });

  const processFollowUpMutation = useMutation({
    mutationFn: async () => {
      if (!followUp?.settings?.is_active || !user?.id) {
        console.log('⏸️ [DEBUG] Follow-up not active or user not logged in');
        return null;
      }

      console.log('🔄 [DEBUG] Processing follow-up:', {
        followUpId: followUp.id,
        userId: user.id,
        instanceId: instanceId
      });

      return await retryWithBackoff(async () => {
        const { data, error } = await supabase.functions.invoke('get-follow-up-contacts', {
          body: { 
            followUpId: followUp.id,
            userId: user.id,
            source: 'manual-trigger',
            instanceId: instanceId
          }
        });

        if (error) {
          console.error('❌ [ERROR] Error processing follow-up:', error);
          throw error;
        }

        console.log('✅ [DEBUG] Follow-up processed successfully:', data);
        return data;
      });
    },
    onSuccess: (data) => {
      console.log('✅ [DEBUG] Follow-up mutation succeeded:', data);
      queryClient.invalidateQueries({ queryKey: ['follow-up'] });
      toast({
        title: "Sucesso",
        description: "Follow-up processado com sucesso.",
      });
    },
    onError: (error) => {
      console.error('❌ [ERROR] Error in follow-up mutation:', error);
      toast({
        title: "Erro",
        description: "Não foi possível processar o follow-up.",
        variant: "destructive",
      });
    }
  });

  const isInstanceConnected = (instance?: { connection_status?: string | null }) => {
    if (!instance?.connection_status) return false
    return instance.connection_status.toLowerCase() === 'connected'
  }

  const FollowUpStatus = () => {
    if (!followUp) {
      console.log('❌ No follow-up data available')
      return null
    }

    const isDisconnected = !isInstanceConnected(followUp.instance)

    if (!followUp.settings?.is_active) {
      return (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Follow-up Inativo</AlertTitle>
          <AlertDescription>
            Ative o follow-up para começar a enviar mensagens.
          </AlertDescription>
        </Alert>
      )
    }

    if (isDisconnected) {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Instância Desconectada</AlertTitle>
          <AlertDescription>
            Conecte a instância para que os follow-ups possam ser enviados.
          </AlertDescription>
        </Alert>
      )
    }

    return (
      <Alert variant="default" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Follow-up Ativo</AlertTitle>
        <AlertDescription>
          Próxima execução: {followUp.scheduled_for ? new Date(followUp.scheduled_for).toLocaleString() : '-'}
          <br />
          Status: {followUp.status}
        </AlertDescription>
      </Alert>
    )
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!followUp?.id) throw new Error("No follow-up to delete")
      
      const { error: messagesError } = await supabase
        .from('follow_up_messages')
        .delete()
        .eq('follow_up_id', followUp.id)

      if (messagesError) throw messagesError

      const { error: followUpError } = await supabase
        .from('follow_ups')
        .delete()
        .eq('id', followUp.id)

      if (followUpError) throw followUpError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up'] })
      toast({
        title: "Sucesso",
        description: "Follow-up excluído com sucesso.",
      })
    },
    onError: (error) => {
      console.error('❌ [ERROR] Error deleting follow-up:', error)
      toast({
        title: "Erro",
        description: "Não foi possível excluir o follow-up.",
        variant: "destructive",
      })
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">Configurações de Follow-up</h3>
          <p className="text-sm text-muted-foreground">
            Configure como e quando os follow-ups serão enviados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => processFollowUpMutation.mutate()}
            disabled={!followUp?.settings?.is_active}
          >
            <Play className="h-4 w-4 mr-2" />
            Testar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={!followUp}
                onClick={() => deleteMutation.mutate()}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Follow-up</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir todas as configurações de follow-up desta instância?
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
          />
        </div>
      </div>

      <FollowUpStatus />

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contatos
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="settings">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Tipo de Follow-up</Label>
              <Select
                value={formData.type}
                onValueChange={(value: FollowUpType) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="ai">Gerado por IA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'ai' && (
              <div className="grid gap-2">
                <Label>Prompt do Sistema (Instruções para a IA)</Label>
                <Textarea
                  value={formData.system_prompt}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    system_prompt: e.target.value 
                  }))}
                  placeholder="Instruções para a IA sobre como gerar as mensagens de follow-up"
                  className="min-h-[100px]"
                />
                <p className="text-sm text-muted-foreground">
                  Este prompt ajuda a IA a entender como deve gerar as mensagens de follow-up
                </p>
              </div>
            )}

            {formData.type === 'manual' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Sequência de Mensagens</Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      manual_messages: [...prev.manual_messages, { message: '', delay_minutes: 1 }]
                    }))}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Mensagem
                  </Button>
                </div>
                
                {formData.manual_messages.map((msg, index) => (
                  <div key={index} className="space-y-2 p-4 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <Label>Mensagem {index + 1}</Label>
                      <div className="flex gap-2">
                        {followUpMessages[index]?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMessageMutation.mutate(followUpMessages[index].id)}
                            disabled={deleteMessageMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <Textarea
                      value={msg.message}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        manual_messages: prev.manual_messages.map((m, i) => 
                          i === index ? { ...m, message: e.target.value } : m
                        )
                      }))}
                      placeholder="Digite a mensagem que será enviada"
                    />
                    <div className="grid gap-2">
                      <Label>Atraso após mensagem anterior (minutos)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={msg.delay_minutes}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          manual_messages: prev.manual_messages.map((m, i) => 
                            i === index ? { ...m, delay_minutes: parseInt(e.target.value) } : m
                          )
                        }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (followUp) {
                    setFormData({
                      is_active: followUp.settings?.is_active || false,
                      type: followUp.type || "manual",
                      stop_on_reply: followUp.settings?.stop_on_reply ?? true,
                      stop_on_keyword: followUp.settings?.stop_on_keyword || ['comprou', 'agendou', 'agendado', 'comprado'],
                      manual_messages: followUpMessages.map(msg => ({
                        message: msg.message,
                        delay_minutes: msg.delay_minutes
                      })),
                      system_prompt: followUp.settings?.system_prompt || ''
                    })
                  }
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => saveMutation.mutate(formData)}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsTable instanceId={instanceId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

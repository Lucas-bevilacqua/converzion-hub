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
import { format } from "date-fns"

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
  const [displayDate, setDisplayDate] = useState<Date | null>(null)
  const [testPhoneNumber, setTestPhoneNumber] = useState("")
  const [showTestDialog, setShowTestDialog] = useState(false)

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
    enabled: !!instanceId,
    refetchInterval: 5000
  });

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
      setFormData(prev => ({
        ...prev,
        is_active: followUp.settings?.is_active || false,
        type: followUp.type || "manual",
        stop_on_reply: followUp.settings?.stop_on_reply ?? true,
        stop_on_keyword: followUp.settings?.stop_on_keyword || ['comprou', 'agendou', 'agendado', 'comprado'],
        manual_messages: followUpMessages.map(msg => ({
          message: msg.message,
          delay_minutes: msg.delay_minutes
        })),
        system_prompt: followUp.settings?.system_prompt || ''
      }));
    }
  }, [followUp, followUpMessages]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!followUp?.id) throw new Error("No follow-up to delete")
      
      console.log('🔄 [DEBUG] Deleting follow-up:', followUp.id)
      
      const { error: messagesError } = await supabase
        .from('follow_up_messages')
        .delete()
        .eq('follow_up_id', followUp.id)

      if (messagesError) {
        console.error('❌ [ERROR] Error deleting follow-up messages:', messagesError)
        throw messagesError
      }

      const { error: followUpError } = await supabase
        .from('follow_ups')
        .delete()
        .eq('id', followUp.id)

      if (followUpError) {
        console.error('❌ [ERROR] Error deleting follow-up:', followUpError)
        throw followUpError
      }
      
      console.log('✅ [DEBUG] Follow-up deleted successfully')
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

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      console.log('🔄 [DEBUG] Deleting message:', messageId)
      
      const { error } = await supabase
        .from('follow_up_messages')
        .delete()
        .eq('id', messageId)

      if (error) {
        console.error('❌ [ERROR] Error deleting message:', error)
        throw error
      }
      
      console.log('✅ [DEBUG] Message deleted successfully')
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

  const testMutation = useMutation({
    mutationFn: async () => {
      console.log('🔄 [DEBUG] Testing follow-up for instance:', instanceId)
      
      if (!followUp?.id) throw new Error("No follow-up to test")
      if (!followUp.instance?.connection_status?.toLowerCase().includes('connected')) {
        throw new Error("A instância precisa estar conectada para testar o follow-up")
      }
      if (!testPhoneNumber) {
        throw new Error("Digite o número que receberá o teste")
      }

      const { data, error } = await supabase.functions.invoke('test-follow-up-system', {
        body: { 
          followUpId: followUp.id,
          instanceId,
          testPhoneNumber,
          executeFullSequence: true // Add this flag to indicate we want to execute the full sequence
        }
      })

      if (error) {
        console.error('❌ [ERROR] Error testing follow-up:', error)
        throw error
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Unknown error occurred')
      }

      console.log('✅ [DEBUG] Follow-up test response:', data)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up', instanceId] })
      toast({
        title: "Sucesso",
        description: "Sequência de follow-up iniciada. As mensagens serão enviadas com os intervalos configurados.",
      })
      setTestPhoneNumber("") // Clear the phone number after successful test
      setShowTestDialog(false) // Close the dialog
    },
    onError: (error) => {
      console.error('❌ [ERROR] Error testing follow-up:', error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível testar o follow-up.",
        variant: "destructive",
      })
    }
  })

  const isInstanceConnected = (instance?: { connection_status?: string | null }) => {
    if (!instance?.connection_status) {
      console.log('❌ [DEBUG] No connection status found:', instance);
      return false;
    }
    
    const status = instance.connection_status.toLowerCase();
    
    const isConnected = status === 'connected' || 
                       status === 'open' || 
                       status.includes('open') ||
                       status.includes('connected');
    
    console.log('🔄 [DEBUG] Connection status check:', {
      rawStatus: instance.connection_status,
      normalizedStatus: status,
      isConnected: isConnected
    });
    
    return isConnected;
  }

  const isDisconnected = !isInstanceConnected(followUp?.instance);
  console.log('🔄 [DEBUG] Instance connection status:', followUp?.instance?.connection_status, 'Is disconnected:', isDisconnected);

  useEffect(() => {
    if (!followUp) return;

    const updateDisplayDate = () => {
      const now = new Date()
      const nextExecution = followUp.scheduled_for ? new Date(followUp.scheduled_for) : null
      
      if (followUp.settings?.is_active) {
        if (nextExecution && nextExecution > now) {
          setDisplayDate(nextExecution)
        } else {
          const firstMessageDelay = followUpMessages[0]?.delay_minutes || 1
          setDisplayDate(new Date(now.getTime() + (firstMessageDelay * 60 * 1000)))
        }
      } else {
        setDisplayDate(null)
      }
    }

    updateDisplayDate()
  }, [followUp, followUpMessages])

  const FollowUpStatus = () => {
    if (!followUp) {
      console.log('❌ No follow-up data available')
      return null
    }

    const isDisconnected = !isInstanceConnected(followUp.instance)
    console.log('🔄 [DEBUG] Follow-up status check:', {
      instanceStatus: followUp.instance?.connection_status,
      isDisconnected: isDisconnected,
      instance: followUp.instance
    });
    
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
          Próxima execução: {displayDate ? format(displayDate, "dd/MM/yyyy, HH:mm:ss") : '-'}
          <br />
          Status: {followUp.status}
        </AlertDescription>
      </Alert>
    )
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      console.log('🔄 [DEBUG] Saving follow-up data:', data);
      
      if (!followUp?.id) {
        // Create new follow-up
        const { data: newFollowUp, error: createError } = await supabase
          .from('follow_ups')
          .insert([{
            instance_id: instanceId,
            type: data.type,
            settings: {
              is_active: data.is_active,
              stop_on_reply: data.stop_on_reply,
              stop_on_keyword: data.stop_on_keyword,
              system_prompt: data.system_prompt
            }
          }])
          .select()
          .single();

        if (createError) {
          console.error('❌ [ERROR] Error creating follow-up:', createError);
          throw createError;
        }

        // Create messages for manual follow-up
        if (data.type === 'manual' && data.manual_messages.length > 0) {
          const { error: messagesError } = await supabase
            .from('follow_up_messages')
            .insert(
              data.manual_messages.map(msg => ({
                follow_up_id: newFollowUp.id,
                message: msg.message,
                delay_minutes: msg.delay_minutes
              }))
            );

          if (messagesError) {
            console.error('❌ [ERROR] Error creating follow-up messages:', messagesError);
            throw messagesError;
          }
        }
      } else {
        // Update existing follow-up
        const { error: updateError } = await supabase
          .from('follow_ups')
          .update({
            type: data.type,
            settings: {
              is_active: data.is_active,
              stop_on_reply: data.stop_on_reply,
              stop_on_keyword: data.stop_on_keyword,
              system_prompt: data.system_prompt
            }
          })
          .eq('id', followUp.id);

        if (updateError) {
          console.error('❌ [ERROR] Error updating follow-up:', updateError);
          throw updateError;
        }

        // Update messages for manual follow-up
        if (data.type === 'manual') {
          // First delete existing messages
          const { error: deleteError } = await supabase
            .from('follow_up_messages')
            .delete()
            .eq('follow_up_id', followUp.id);

          if (deleteError) {
            console.error('❌ [ERROR] Error deleting existing messages:', deleteError);
            throw deleteError;
          }

          // Then insert new messages
          if (data.manual_messages.length > 0) {
            const { error: messagesError } = await supabase
              .from('follow_up_messages')
              .insert(
                data.manual_messages.map(msg => ({
                  follow_up_id: followUp.id,
                  message: msg.message,
                  delay_minutes: msg.delay_minutes
                }))
              );

            if (messagesError) {
              console.error('❌ [ERROR] Error creating new messages:', messagesError);
              throw messagesError;
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up'] })
      queryClient.invalidateQueries({ queryKey: ['follow-up-messages'] })
      toast({
        title: "Sucesso",
        description: "Follow-up salvo com sucesso.",
      })
    },
    onError: (error) => {
      console.error('❌ [ERROR] Error saving follow-up:', error)
      toast({
        title: "Erro",
        description: "Não foi possível salvar o follow-up.",
        variant: "destructive",
      })
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">Configurações de Follow-up</h3>
          <p className="text-sm text-muted-foreground">
            Configure como e quando os follow-ups serão enviados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog open={showTestDialog} onOpenChange={setShowTestDialog}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowTestDialog(true)
                }}
                disabled={
                  !followUp?.settings?.is_active || 
                  testMutation.isPending || 
                  !isInstanceConnected(followUp?.instance)
                }
              >
                <Play className="h-4 w-4 mr-2" />
                {testMutation.isPending ? "Testando..." : "Testar"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Testar Follow-up</AlertDialogTitle>
                <AlertDialogDescription>
                  Digite o número que receberá o teste do follow-up.
                  <div className="mt-4">
                    <Input
                      type="tel"
                      placeholder="Ex: 5511999999999"
                      value={testPhoneNumber}
                      onChange={(e) => setTestPhoneNumber(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      A sequência completa de mensagens será enviada para este número, respeitando os intervalos configurados.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending || !testPhoneNumber}
                >
                  Iniciar Sequência
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

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="settings" className="flex-1 sm:flex-none">Configurações</TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2 flex-1 sm:flex-none">
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
                <SelectTrigger className="w-full sm:w-[200px]">
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newMessages = [...formData.manual_messages];
                          newMessages.splice(index, 1);
                          setFormData(prev => ({
                            ...prev,
                            manual_messages: newMessages
                          }));
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
                      className="min-h-[100px]"
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
                        className="w-full sm:w-[200px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
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
                    });
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

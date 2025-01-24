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
import { Json } from "@/integrations/supabase/types"
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
import { ContactsTable } from "./ContactsTable"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface FollowUpSectionProps {
  instanceId: string
}

type FollowUpType = "ai_generated" | "manual" | "automatic";

interface ManualMessage {
  message: string;
  delay_minutes: number;
}

interface FormData {
  is_active: boolean
  follow_up_type: FollowUpType
  delay_minutes: number
  template_message: string
  max_attempts: number
  stop_on_reply: boolean
  stop_on_keyword: string[]
  manual_messages: ManualMessage[]
  system_prompt?: string
}

interface FollowUpData {
  id: string;
  instance_id: string;
  is_active: boolean;
  follow_up_type: FollowUpType;
  delay_minutes: number;
  template_message: string;
  max_attempts: number;
  stop_on_reply: boolean;
  stop_on_keyword: string[];
  manual_messages: ManualMessage[];
  system_prompt?: string;
  created_at?: string;
  updated_at?: string;
  last_execution_time?: string;
  next_execution_time?: string;
  execution_count?: number;
}

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second

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
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  console.log('🔄 [DEBUG] FollowUpSection - Iniciando com instanceId:', instanceId)

  // Query to fetch follow-up configuration
  const { data: followUp, isLoading } = useQuery({
    queryKey: ['follow-up', instanceId],
    queryFn: async () => {
      console.log('🔄 [DEBUG] Buscando configuração de follow-up para instância:', instanceId)
      const { data, error } = await supabase
        .from('instance_follow_ups')
        .select('*')
        .eq('instance_id', instanceId)
        .maybeSingle()

      if (error) {
        console.error('❌ [ERROR] Erro ao buscar follow-up:', error)
        throw error
      }

      console.log('✅ [DEBUG] Dados do follow-up:', data)
      console.log('⏰ [DEBUG] Última execução:', data?.last_execution_time)
      console.log('⏰ [DEBUG] Próxima execução:', data?.next_execution_time)
      console.log('📊 [DEBUG] Contagem de execuções:', data?.execution_count)

      const parsedData = {
        ...data,
        manual_messages: Array.isArray(data?.manual_messages) 
          ? (data.manual_messages as Record<string, any>[]).map(msg => {
              if (typeof msg === 'object' && msg !== null) {
                return {
                  message: String(msg.message || ''),
                  delay_minutes: Number(msg.delay_minutes || 1)
                }
              }
              return { message: '', delay_minutes: 1 }
            })
          : []
      } as FollowUpData

      return parsedData
    }
  })

  // Mutation to process follow-ups manually
  const processFollowUpMutation = useMutation({
    mutationFn: async () => {
      if (!followUp?.is_active || !user?.id) {
        console.log('⏸️ [DEBUG] Follow-up não está ativo ou usuário não está logado')
        return null
      }

      console.log('🔄 [DEBUG] Processando follow-up manualmente', {
        instanceId,
        userId: user.id,
        followUpId: followUp.id,
        currentLastExecution: followUp.last_execution_time
      });

      return await retryWithBackoff(async () => {
        const { data, error } = await supabase.functions.invoke('get-follow-up-contacts', {
          body: { 
            instanceId,
            userId: user.id,
            followUpId: followUp.id,
            source: 'manual-trigger'
          }
        });

        if (error) {
          console.error('❌ [ERROR] Erro ao processar follow-up:', error);
          throw error;
        }

        console.log('✅ [DEBUG] Follow-up processado com sucesso:', data);
        return data;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up'] });
      toast({
        title: "Sucesso",
        description: "Follow-up processado com sucesso.",
      });
    },
    onError: (error) => {
      console.error('❌ [ERROR] Erro ao processar follow-up:', error);
      toast({
        title: "Erro",
        description: "Não foi possível processar o follow-up. Tentativas esgotadas.",
        variant: "destructive",
      });
    }
  })

  const [formData, setFormData] = useState<FormData>({
    is_active: followUp?.is_active || false,
    follow_up_type: followUp?.follow_up_type || "manual",
    delay_minutes: followUp?.delay_minutes || 1,
    template_message: followUp?.template_message || '',
    max_attempts: followUp?.max_attempts || 3,
    stop_on_reply: followUp?.stop_on_reply ?? true,
    stop_on_keyword: followUp?.stop_on_keyword || ['comprou', 'agendou', 'agendado', 'comprado'],
    manual_messages: followUp?.manual_messages || [],
    system_prompt: followUp?.system_prompt || ''
  })

  useEffect(() => {
    if (followUp) {
      console.log('🔄 [DEBUG] Updating form data with follow-up:', followUp)
      setFormData({
        is_active: followUp.is_active || false,
        follow_up_type: followUp.follow_up_type || "manual",
        delay_minutes: followUp.delay_minutes || 1,
        template_message: followUp.template_message || '',
        max_attempts: followUp.max_attempts || 3,
        stop_on_reply: followUp.stop_on_reply ?? true,
        stop_on_keyword: followUp.stop_on_keyword || ['comprou', 'agendou', 'agendado', 'comprado'],
        manual_messages: followUp.manual_messages || [],
        system_prompt: followUp.system_prompt || ''
      })
    }
  }, [followUp])

  const saveMutation = useMutation({
    mutationFn: async (values: FormData) => {
      console.log('💾 [DEBUG] Saving follow-up with values:', values)
      
      const dataToSave = {
        instance_id: instanceId,
        is_active: values.is_active,
        follow_up_type: values.follow_up_type,
        delay_minutes: Math.max(1, values.delay_minutes),
        template_message: values.template_message,
        max_attempts: values.max_attempts,
        stop_on_reply: values.stop_on_reply,
        stop_on_keyword: values.stop_on_keyword,
        manual_messages: values.manual_messages.map(msg => ({
          message: msg.message,
          delay_minutes: msg.delay_minutes
        })) as unknown as Json,
        system_prompt: values.system_prompt,
        updated_at: new Date().toISOString()
      }

      const operation = followUp
        ? supabase
            .from('instance_follow_ups')
            .update(dataToSave)
            .eq('id', followUp.id)
        : supabase
            .from('instance_follow_ups')
            .insert(dataToSave)

      const { error } = await operation
      if (error) {
        console.error('❌ [ERROR] Error saving follow-up:', error)
        throw error
      }

      console.log('✅ [DEBUG] Follow-up saved successfully')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up'] })
      toast({
        title: "Sucesso",
        description: "Configurações de follow-up salvas com sucesso.",
      })
    },
    onError: (error) => {
      console.error('❌ [ERROR] Error in save mutation:', error)
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações. Por favor, tente novamente.",
        variant: "destructive",
      })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('instance_follow_ups')
        .delete()
        .eq('instance_id', instanceId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up'] })
      toast({
        title: "Sucesso",
        description: "Configurações de follow-up excluídas com sucesso.",
      })
      setFormData({
        is_active: false,
        follow_up_type: "manual",
        delay_minutes: 1,
        template_message: '',
        max_attempts: 3,
        stop_on_reply: true,
        stop_on_keyword: ['comprou', 'agendou', 'agendado', 'comprado'],
        manual_messages: []
      })
    },
    onError: (error) => {
      console.error('❌ [ERROR] Erro ao excluir follow-up:', error)
      toast({
        title: "Erro",
        description: "Não foi possível excluir as configurações.",
        variant: "destructive",
      })
    }
  })

  // Add mutation to reset execution count
  const resetExecutionMutation = useMutation({
    mutationFn: async () => {
      console.log('🔄 Resetting execution count for follow-up')
      const { error } = await supabase
        .from('instance_follow_ups')
        .update({ 
          execution_count: 0,
          next_execution_time: new Date().toISOString()
        })
        .eq('id', followUp?.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up'] })
      toast({
        title: "Sucesso",
        description: "Contador de execuções reiniciado.",
      })
    },
    onError: (error) => {
      console.error('Error resetting execution count:', error)
      toast({
        title: "Erro",
        description: "Não foi possível reiniciar o contador.",
        variant: "destructive",
      })
    }
  })

  // Add status alert component
  const FollowUpStatus = () => {
    if (!followUp) return null

    const instance = followUp.evolution_instances
    const hasReachedMaxAttempts = followUp.execution_count >= followUp.max_attempts
    const isDisconnected = instance?.connection_status?.toLowerCase() !== 'connected'

    if (!followUp.is_active) {
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

    if (hasReachedMaxAttempts) {
      return (
        <Alert variant="warning" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Máximo de Tentativas Atingido</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            O follow-up atingiu o número máximo de tentativas.
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => resetExecutionMutation.mutate()}
              disabled={resetExecutionMutation.isPending}
            >
              Reiniciar Contador
            </Button>
          </AlertDescription>
        </Alert>
      )
    }

    return (
      <Alert variant="default" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Follow-up Ativo</AlertTitle>
        <AlertDescription>
          Próxima execução: {new Date(followUp.next_execution_time).toLocaleString()}
          <br />
          Execuções: {followUp.execution_count}/{followUp.max_attempts}
        </AlertDescription>
      </Alert>
    )
  }

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
            disabled={!followUp?.is_active}
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
                value={formData.follow_up_type}
                onValueChange={(value: FollowUpType) => setFormData(prev => ({ ...prev, follow_up_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="ai_generated">Gerado por IA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.follow_up_type === 'ai_generated' && (
              <>
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
                <div className="grid gap-2">
                  <Label>Intervalo entre mensagens (minutos)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.delay_minutes}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      delay_minutes: parseInt(e.target.value) 
                    }))}
                  />
                </div>
              </>
            )}

            {formData.follow_up_type === 'manual' && (
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          manual_messages: prev.manual_messages.filter((_, i) => i !== index)
                        }))}
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

            <div className="grid gap-2">
              <Label>Número Máximo de Tentativas</Label>
              <Input
                type="number"
                min="1"
                value={formData.max_attempts}
                onChange={(e) => setFormData(prev => ({ ...prev, max_attempts: parseInt(e.target.value) }))}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.stop_on_reply}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, stop_on_reply: checked }))}
                />
                <Label>Parar ao receber resposta</Label>
              </div>
              
              <div className="grid gap-2">
                <Label>Palavras-chave para parar o follow-up</Label>
                <Input
                  placeholder="Ex: comprou, agendou (separadas por vírgula)"
                  value={formData.stop_on_keyword.join(', ')}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    stop_on_keyword: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                  }))}
                />
                <p className="text-sm text-muted-foreground">
                  O follow-up será interrompido se alguma dessas palavras for detectada na resposta
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (followUp) {
                    setFormData({
                      is_active: followUp.is_active || false,
                      follow_up_type: followUp.follow_up_type || "manual",
                      delay_minutes: followUp.delay_minutes || 1,
                      template_message: followUp.template_message || '',
                      max_attempts: followUp.max_attempts || 3,
                      stop_on_reply: followUp.stop_on_reply ?? true,
                      stop_on_keyword: followUp.stop_on_keyword || ['comprou', 'agendou', 'agendado', 'comprado'],
                      manual_messages: followUp.manual_messages || [],
                      system_prompt: followUp.system_prompt || ''
                    })
                  }
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => saveMutation.mutate(formData)}
              >
                Salvar
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

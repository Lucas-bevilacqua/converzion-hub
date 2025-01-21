import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Trash2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { useAuth } from "@/contexts/auth/AuthContext"

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
  schedule_start_time: string
  schedule_end_time: string
  schedule_days: number[]
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
  schedule_start_time: string;
  schedule_end_time: string;
  schedule_days: number[];
  max_attempts: number;
  stop_on_reply: boolean;
  stop_on_keyword: string[];
  manual_messages: ManualMessage[];
  system_prompt?: string;
}

interface PostgrestError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
  response?: {
    status?: number;
  }
}

export function FollowUpSection({ instanceId }: FollowUpSectionProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Add rate limiting state
  const [isRateLimited, setIsRateLimited] = useState(false)
  const rateLimitTimeout = useRef<NodeJS.Timeout>()

  console.log('🔄 [DEBUG] Iniciando FollowUpSection para instância:', instanceId)

  const { data: followUp, isLoading, error } = useQuery({
    queryKey: ['follow-up', instanceId],
    queryFn: async () => {
      console.log('🔍 [DEBUG] Buscando configurações de follow-up para instância:', instanceId)
      
      if (isRateLimited) {
        throw new Error('Rate limit reached. Please wait before making more requests.')
      }

      try {
        const { data, error } = await supabase
          .from('instance_follow_ups')
          .select('*')
          .eq('instance_id', instanceId)
          .maybeSingle()

        if (error && error.code !== 'PGRST116') {
          console.error('❌ [ERROR] Erro ao buscar follow-up:', error)
          throw error
        }

        if (data?.manual_messages) {
          try {          
            let parsedMessages = data.manual_messages
            
            if (typeof parsedMessages === 'string') {
              try {
                parsedMessages = JSON.parse(parsedMessages)
              } catch (e) {
                parsedMessages = []
              }
            }
            
            if (!Array.isArray(parsedMessages)) {
              parsedMessages = []
            }
            
            const typedMessages = parsedMessages.map((msg: any) => ({
              message: String(msg?.message || ''),
              delay_minutes: Number(msg?.delay_minutes || 1)
            }))

            data.manual_messages = typedMessages
          } catch (e) {
            console.error('❌ [ERROR] Erro ao processar mensagens:', e)
            data.manual_messages = []
          }
        }

        console.log('✅ [DEBUG] Configurações de follow-up carregadas:', data)
        return data as unknown as FollowUpData
      } catch (error) {
        // Handle rate limiting error
        const postgrestError = error as unknown as PostgrestError;
        if (postgrestError?.message?.includes('ThrottlerException') || 
            postgrestError?.response?.status === 429) {
          console.log('⚠️ [RATE LIMIT] Follow-up rate limit reached')
          setIsRateLimited(true)
          
          // Clear any existing timeout
          if (rateLimitTimeout.current) {
            clearTimeout(rateLimitTimeout.current)
          }
          
          // Reset rate limit after 1 minute
          rateLimitTimeout.current = setTimeout(() => {
            console.log('✅ [RATE LIMIT] Resetting rate limit')
            setIsRateLimited(false)
          }, 60000)
          
          throw new Error('Rate limit reached. Please wait a minute before trying again.')
        }
        throw error
      }
    },
    retry: (failureCount, error: any) => {
      // Don't retry on rate limit errors
      if (error?.message?.includes('Rate limit reached')) {
        return false
      }
      return failureCount < 3
    }
  })

  const [formData, setFormData] = useState<FormData>({
    is_active: followUp?.is_active || false,
    follow_up_type: followUp?.follow_up_type || "manual",
    delay_minutes: followUp?.delay_minutes || 1,
    template_message: followUp?.template_message || '',
    schedule_start_time: followUp?.schedule_start_time || '09:00',
    schedule_end_time: followUp?.schedule_end_time || '18:00',
    schedule_days: followUp?.schedule_days || [1,2,3,4,5],
    max_attempts: followUp?.max_attempts || 3,
    stop_on_reply: followUp?.stop_on_reply ?? true,
    stop_on_keyword: followUp?.stop_on_keyword || ['comprou', 'agendou', 'agendado', 'comprado'],
    manual_messages: followUp?.manual_messages || [],
    system_prompt: followUp?.system_prompt || ''
  })

  useEffect(() => {
    if (followUp) {
      console.log('📝 [DEBUG] Atualizando formulário com dados do follow-up:', followUp)
      setFormData({
        is_active: followUp.is_active || false,
        follow_up_type: followUp.follow_up_type || "manual",
        delay_minutes: followUp.delay_minutes || 1,
        template_message: followUp.template_message || '',
        schedule_start_time: followUp.schedule_start_time || '09:00',
        schedule_end_time: followUp.schedule_end_time || '18:00',
        schedule_days: followUp.schedule_days || [1,2,3,4,5],
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
      if (isRateLimited) {
        throw new Error('Rate limit reached. Please wait before making more requests.')
      }

      console.log('💾 [DEBUG] Salvando configurações de follow-up:', values)
      
      const manualMessages = Array.isArray(values.manual_messages) 
        ? values.manual_messages.map(msg => ({
            message: msg.message || '',
            delay_minutes: Math.max(1, Number(msg.delay_minutes) || 1)
          }))
        : []

      const dataToSave = {
        instance_id: instanceId,
        is_active: values.is_active,
        follow_up_type: values.follow_up_type,
        delay_minutes: Math.max(1, values.delay_minutes),
        template_message: values.template_message,
        schedule_start_time: values.schedule_start_time,
        schedule_end_time: values.schedule_end_time,
        schedule_days: values.schedule_days,
        max_attempts: values.max_attempts,
        stop_on_reply: values.stop_on_reply,
        stop_on_keyword: values.stop_on_keyword,
        manual_messages: manualMessages,
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
        console.error('❌ [ERROR] Erro ao salvar follow-up:', error)
        throw error
      }

      if (values.follow_up_type === 'ai_generated') {
        console.log('🤖 [DEBUG] Configurando follow-up com IA')
        const { data: instance, error: instanceError } = await supabase
          .from('evolution_instances')
          .select('name, phone_number')
          .eq('id', instanceId)
          .single()

        if (instanceError) {
          console.error('❌ [ERROR] Erro ao buscar dados da instância:', instanceError)
          throw instanceError
        }
        
        const { error: aiError } = await supabase.functions.invoke('process-ai-follow-up', {
          body: {
            instanceId,
            instanceName: instance.name,
            userId: user?.id,
            phoneNumber: instance.phone_number,
            delayMinutes: values.delay_minutes,
            maxAttempts: values.max_attempts,
            stopOnReply: values.stop_on_reply,
            stopKeywords: values.stop_on_keyword,
            systemPrompt: values.system_prompt
          }
        })

        if (aiError) {
          console.error('❌ [ERROR] Erro ao processar follow-up com IA:', aiError)
          throw aiError
        }
      }

      console.log('✅ [DEBUG] Follow-up salvo com sucesso')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up'] })
      toast({
        title: "Sucesso",
        description: "Configurações de follow-up salvas com sucesso.",
      })
    },
    onError: (error) => {
      console.error('❌ [ERROR] Erro na mutação de salvamento:', error)
      
      // Handle rate limiting error
      const postgrestError = error as unknown as PostgrestError;
      if (postgrestError?.message?.includes('ThrottlerException') || 
          postgrestError?.response?.status === 429) {
        setIsRateLimited(true)
        
        // Reset rate limit after 1 minute
        setTimeout(() => {
          setIsRateLimited(false)
        }, 60000)
        
        toast({
          title: "Rate Limit Reached",
          description: "Too many requests. Please wait a minute before trying again.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações. Por favor, tente novamente.",
        variant: "destructive",
      })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      console.log('🗑️ [DEBUG] Deletando configuração de follow-up para instância:', instanceId)
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
        schedule_start_time: '09:00',
        schedule_end_time: '18:00',
        schedule_days: [1,2,3,4,5],
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

  const addMessage = () => {
    console.log('➕ [DEBUG] Adicionando nova mensagem ao follow-up')
    setFormData(prev => ({
      ...prev,
      manual_messages: [...prev.manual_messages, { message: '', delay_minutes: 1 }]
    }))
  }

  const removeMessage = (index: number) => {
    console.log('➖ [DEBUG] Removendo mensagem do índice:', index)
    setFormData(prev => ({
      ...prev,
      manual_messages: prev.manual_messages.filter((_, i) => i !== index)
    }))
  }

  const updateMessage = (index: number, field: keyof ManualMessage, value: string | number) => {
    console.log('📝 [DEBUG] Atualizando mensagem:', { index, field, value })
    setFormData(prev => ({
      ...prev,
      manual_messages: prev.manual_messages.map((msg, i) => 
        i === index ? { ...msg, [field]: value } : msg
      )
    }))
  }

  const handleSave = async () => {
    console.log('💾 [DEBUG] Iniciando salvamento do follow-up:', {
      formData,
      instanceId,
      userId: user?.id
    })

    try {
      await saveMutation.mutateAsync(formData)
      console.log('✅ [DEBUG] Follow-up salvo com sucesso')
      
      toast({
        title: "Sucesso",
        description: "Configurações de follow-up salvas.",
      })
    } catch (error) {
      console.error('❌ [ERROR] Erro ao salvar follow-up:', error)
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isRateLimited) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="text-destructive text-lg font-medium">Rate Limit Reached</div>
        <p className="text-muted-foreground text-center">
          Too many requests. Please wait a minute before trying again.
        </p>
      </div>
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
                onClick={addMessage}
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
                    onClick={() => removeMessage(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Textarea
                  value={msg.message}
                  onChange={(e) => updateMessage(index, 'message', e.target.value)}
                  placeholder="Digite a mensagem que será enviada"
                />
                <div className="grid gap-2">
                  <Label>Atraso após mensagem anterior (minutos)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={msg.delay_minutes}
                    onChange={(e) => updateMessage(index, 'delay_minutes', parseInt(e.target.value))}
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
              console.log('Cancelando alterações, restaurando estado anterior:', followUp)
              if (followUp) {
                setFormData({
                  is_active: followUp.is_active || false,
                  follow_up_type: followUp.follow_up_type || "manual",
                  delay_minutes: followUp.delay_minutes || 1,
                  template_message: followUp.template_message || '',
                  schedule_start_time: followUp.schedule_start_time || '09:00',
                  schedule_end_time: followUp.schedule_end_time || '18:00',
                  schedule_days: followUp.schedule_days || [1,2,3,4,5],
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
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              "Salvar"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
import { useState, useEffect } from "react"
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
}

interface JsonManualMessage {
  message?: string;
  delay_minutes?: number;
}

export function FollowUpSection({ instanceId }: FollowUpSectionProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: followUp, isLoading } = useQuery({
    queryKey: ['follow-up', instanceId],
    queryFn: async () => {
      console.log('Buscando configuração de follow-up para instância:', instanceId)
      const { data, error } = await supabase
        .from('instance_follow_ups')
        .select('*')
        .eq('instance_id', instanceId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar follow-up:', error)
        throw error
      }

      // Parse manual_messages from JSON if it exists
      if (data?.manual_messages) {
        try {
          console.log('Raw manual_messages:', data.manual_messages)
          // Handle double-encoded JSON string
          const messages = typeof data.manual_messages === 'string' 
            ? JSON.parse(typeof JSON.parse(data.manual_messages) === 'string' 
                ? JSON.parse(data.manual_messages) 
                : data.manual_messages)
            : data.manual_messages

          console.log('Parsed messages:', messages)

          data.manual_messages = Array.isArray(messages) 
            ? messages.map(msg => ({
                message: msg.message || '',
                delay_minutes: Number(msg.delay_minutes) || 60
              }))
            : []
            
          console.log('Formatted messages:', data.manual_messages)
        } catch (e) {
          console.error('Error parsing manual_messages:', e)
          data.manual_messages = []
        }
      }

      return data
    }
  })

  const [formData, setFormData] = useState<FormData>({
    is_active: followUp?.is_active || false,
    follow_up_type: (followUp?.follow_up_type as FollowUpType) || "manual",
    delay_minutes: followUp?.delay_minutes || 60,
    template_message: followUp?.template_message || '',
    schedule_start_time: followUp?.schedule_start_time || '09:00',
    schedule_end_time: followUp?.schedule_end_time || '18:00',
    schedule_days: followUp?.schedule_days || [1,2,3,4,5],
    max_attempts: followUp?.max_attempts || 3,
    stop_on_reply: followUp?.stop_on_reply ?? true,
    stop_on_keyword: followUp?.stop_on_keyword || ['comprou', 'agendou', 'agendado', 'comprado'],
    manual_messages: Array.isArray(followUp?.manual_messages) 
      ? (followUp.manual_messages as JsonManualMessage[]).map(msg => ({
          message: msg.message || '',
          delay_minutes: Number(msg.delay_minutes) || 60
        }))
      : []
  })

  useEffect(() => {
    if (followUp) {
      const messages = Array.isArray(followUp.manual_messages)
        ? (followUp.manual_messages as JsonManualMessage[]).map(msg => ({
            message: msg.message || '',
            delay_minutes: Number(msg.delay_minutes) || 60
          }))
        : []

      setFormData({
        is_active: followUp.is_active || false,
        follow_up_type: (followUp.follow_up_type as FollowUpType) || "manual",
        delay_minutes: followUp.delay_minutes || 60,
        template_message: followUp.template_message || '',
        schedule_start_time: followUp.schedule_start_time || '09:00',
        schedule_end_time: followUp.schedule_end_time || '18:00',
        schedule_days: followUp.schedule_days || [1,2,3,4,5],
        max_attempts: followUp.max_attempts || 3,
        stop_on_reply: followUp.stop_on_reply ?? true,
        stop_on_keyword: followUp.stop_on_keyword || ['comprou', 'agendou', 'agendado', 'comprado'],
        manual_messages: messages
      })
    }
  }, [followUp])

  const saveMutation = useMutation({
    mutationFn: async (values: FormData) => {
      console.log('Salvando configuração de follow-up:', values)
      
      const dataToSave = {
        instance_id: instanceId,
        is_active: values.is_active,
        follow_up_type: values.follow_up_type,
        delay_minutes: values.delay_minutes,
        template_message: values.template_message,
        schedule_start_time: values.schedule_start_time,
        schedule_end_time: values.schedule_end_time,
        schedule_days: values.schedule_days,
        max_attempts: values.max_attempts,
        stop_on_reply: values.stop_on_reply,
        stop_on_keyword: values.stop_on_keyword,
        manual_messages: JSON.stringify(values.manual_messages), // Single JSON.stringify
        updated_at: new Date().toISOString()
      }

      console.log('Data being saved:', dataToSave)
      
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
        console.error('Erro ao salvar follow-up:', error)
        throw error
      }

      // Registra as mensagens no histórico
      if (user && values.manual_messages.length > 0) {
        const { error: chatError } = await supabase
          .from('chat_messages')
          .insert(values.manual_messages.map(msg => ({
            instance_id: instanceId,
            user_id: user.id,
            sender_type: 'assistant',
            content: msg.message
          })))

        if (chatError) {
          console.error('Erro ao registrar mensagens:', chatError)
          throw chatError
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up'] })
      toast({
        title: "Sucesso",
        description: "Configurações de follow-up salvas com sucesso.",
      })
    },
    onError: (error) => {
      console.error('Erro ao salvar follow-up:', error)
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      console.log('Deletando configuração de follow-up para instância:', instanceId)
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
      // Reset form to default values
      setFormData({
        is_active: false,
        follow_up_type: "manual",
        delay_minutes: 60,
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
      console.error('Erro ao excluir follow-up:', error)
      toast({
        title: "Erro",
        description: "Não foi possível excluir as configurações.",
        variant: "destructive",
      })
    }
  })

  const addMessage = () => {
    setFormData(prev => ({
      ...prev,
      manual_messages: [...prev.manual_messages, { message: '', delay_minutes: 60 }]
    }))
  }

  const removeMessage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      manual_messages: prev.manual_messages.filter((_, i) => i !== index)
    }))
  }

  const updateMessage = (index: number, field: keyof ManualMessage, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      manual_messages: prev.manual_messages.map((msg, i) => 
        i === index ? { ...msg, [field]: value } : msg
      )
    }))
  }

  const handleSave = () => {
    console.log('Salvando follow-up com dados:', formData)
    saveMutation.mutateAsync(formData)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
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
              if (followUp) {
                const messages = Array.isArray(followUp.manual_messages)
                  ? (followUp.manual_messages as JsonManualMessage[]).map(msg => ({
                      message: msg.message || '',
                      delay_minutes: Number(msg.delay_minutes) || 60
                    }))
                  : []

                setFormData({
                  is_active: followUp.is_active || false,
                  follow_up_type: (followUp.follow_up_type as FollowUpType) || "manual",
                  delay_minutes: followUp.delay_minutes || 60,
                  template_message: followUp.template_message || '',
                  schedule_start_time: followUp.schedule_start_time || '09:00',
                  schedule_end_time: followUp.schedule_end_time || '18:00',
                  schedule_days: followUp.schedule_days || [1,2,3,4,5],
                  max_attempts: followUp.max_attempts || 3,
                  stop_on_reply: followUp.stop_on_reply ?? true,
                  stop_on_keyword: followUp.stop_on_keyword || ['comprou', 'agendou', 'agendado', 'comprado'],
                  manual_messages: messages
                })
              }
            }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
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

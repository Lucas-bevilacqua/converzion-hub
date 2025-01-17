import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface FollowUpSectionProps {
  instanceId: string
}

type FollowUpType = "automatic" | "ai_generated" | "manual";

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
  manual_messages: any[]
}

export function FollowUpSection({ instanceId }: FollowUpSectionProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)

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

      return data
    }
  })

  const [formData, setFormData] = useState<FormData>({
    is_active: followUp?.is_active || false,
    follow_up_type: (followUp?.follow_up_type as FollowUpType) || "automatic",
    delay_minutes: followUp?.delay_minutes || 60,
    template_message: followUp?.template_message || '',
    schedule_start_time: followUp?.schedule_start_time || '09:00',
    schedule_end_time: followUp?.schedule_end_time || '18:00',
    schedule_days: followUp?.schedule_days || [1,2,3,4,5],
    max_attempts: followUp?.max_attempts || 3,
    stop_on_reply: followUp?.stop_on_reply ?? true,
    stop_on_keyword: followUp?.stop_on_keyword || [],
    manual_messages: followUp?.manual_messages || []
  })

  const saveMutation = useMutation({
    mutationFn: async (values: FormData) => {
      console.log('Salvando configuração de follow-up:', values)
      const operation = followUp
        ? supabase
            .from('instance_follow_ups')
            .update(values)
            .eq('id', followUp.id)
        : supabase
            .from('instance_follow_ups')
            .insert({ ...values, instance_id: instanceId })

      const { error } = await operation
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up'] })
      toast({
        title: "Sucesso",
        description: "Configurações de follow-up salvas com sucesso.",
      })
      setIsEditing(false)
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

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const handleSave = () => {
    saveMutation.mutateAsync(formData)
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
        <Switch
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
        />
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
              <SelectItem value="automatic">Automático</SelectItem>
              <SelectItem value="ai_generated">Gerado por IA</SelectItem>
              <SelectItem value="manual">Template</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Atraso (minutos)</Label>
          <Input
            type="number"
            min="1"
            value={formData.delay_minutes}
            onChange={(e) => setFormData(prev => ({ ...prev, delay_minutes: parseInt(e.target.value) }))}
          />
        </div>

        {formData.follow_up_type === 'manual' && (
          <div className="grid gap-2">
            <Label>Mensagem Template</Label>
            <Textarea
              value={formData.template_message}
              onChange={(e) => setFormData(prev => ({ ...prev, template_message: e.target.value }))}
              placeholder="Digite a mensagem que será enviada"
            />
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

        <div className="flex items-center gap-2">
          <Switch
            checked={formData.stop_on_reply}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, stop_on_reply: checked }))}
          />
          <Label>Parar ao receber resposta</Label>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setFormData({
              is_active: followUp?.is_active || false,
              follow_up_type: (followUp?.follow_up_type as FollowUpType) || "automatic",
              delay_minutes: followUp?.delay_minutes || 60,
              template_message: followUp?.template_message || '',
              schedule_start_time: followUp?.schedule_start_time || '09:00',
              schedule_end_time: followUp?.schedule_end_time || '18:00',
              schedule_days: followUp?.schedule_days || [1,2,3,4,5],
              max_attempts: followUp?.max_attempts || 3,
              stop_on_reply: followUp?.stop_on_reply ?? true,
              stop_on_keyword: followUp?.stop_on_keyword || [],
              manual_messages: followUp?.manual_messages || []
            })}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
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
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Calendar, Clock, MessageSquare } from "lucide-react"
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

export function FollowUpSection({ instanceId }: FollowUpSectionProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)

  const { data: followUp, isLoading } = useQuery({
    queryKey: ['follow-up', instanceId],
    queryFn: async () => {
      console.log('Fetching follow-up config for instance:', instanceId)
      const { data, error } = await supabase
        .from('instance_follow_ups')
        .select('*')
        .eq('instance_id', instanceId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error fetching follow-up:', error)
        throw error
      }

      return data
    }
  })

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      console.log('Saving follow-up config:', values)
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
      console.error('Error saving follow-up:', error)
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      })
    }
  })

  const [formData, setFormData] = useState({
    is_active: followUp?.is_active || false,
    follow_up_type: followUp?.follow_up_type || 'automatic',
    delay_minutes: followUp?.delay_minutes || 60,
    template_message: followUp?.template_message || '',
    schedule_start_time: followUp?.schedule_start_time || '09:00',
    schedule_end_time: followUp?.schedule_end_time || '18:00',
    schedule_days: followUp?.schedule_days || [1,2,3,4,5]
  })

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const handleSave = () => {
    mutation.mutateAsync(formData)
  }

  const weekDays = [
    { value: 0, label: "Domingo" },
    { value: 1, label: "Segunda" },
    { value: 2, label: "Terça" },
    { value: 3, label: "Quarta" },
    { value: 4, label: "Quinta" },
    { value: 5, label: "Sexta" },
    { value: 6, label: "Sábado" }
  ]

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
            onValueChange={(value) => setFormData(prev => ({ ...prev, follow_up_type: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="automatic">Automático</SelectItem>
              <SelectItem value="ai_generated">Gerado por IA</SelectItem>
              <SelectItem value="template">Template</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Tempo de espera (minutos)</Label>
          <Input
            type="number"
            value={formData.delay_minutes}
            onChange={(e) => setFormData(prev => ({ ...prev, delay_minutes: parseInt(e.target.value) }))}
          />
        </div>

        <div className="grid gap-2">
          <Label>Horário de início</Label>
          <Input
            type="time"
            value={formData.schedule_start_time}
            onChange={(e) => setFormData(prev => ({ ...prev, schedule_start_time: e.target.value }))}
          />
        </div>

        <div className="grid gap-2">
          <Label>Horário de término</Label>
          <Input
            type="time"
            value={formData.schedule_end_time}
            onChange={(e) => setFormData(prev => ({ ...prev, schedule_end_time: e.target.value }))}
          />
        </div>

        {formData.follow_up_type === 'template' && (
          <div className="grid gap-2">
            <Label>Mensagem Template</Label>
            <Textarea
              value={formData.template_message}
              onChange={(e) => setFormData(prev => ({ ...prev, template_message: e.target.value }))}
              placeholder="Digite a mensagem que será enviada..."
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setFormData({
              is_active: followUp?.is_active || false,
              follow_up_type: followUp?.follow_up_type || 'automatic',
              delay_minutes: followUp?.delay_minutes || 60,
              template_message: followUp?.template_message || '',
              schedule_start_time: followUp?.schedule_start_time || '09:00',
              schedule_end_time: followUp?.schedule_end_time || '18:00',
              schedule_days: followUp?.schedule_days || [1,2,3,4,5]
            })}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? (
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

const formSchema = z.object({
  objective: z.enum(['sales', 'support', 'scheduling', 'education', 'custom'], {
    required_error: "Por favor selecione um objetivo",
  }),
  prompt: z.string().min(1, "O prompt é obrigatório"),
})

interface InstancePromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: string | undefined
  currentPrompt?: string | null
}

export function InstancePromptDialog({
  open,
  onOpenChange,
  instanceId,
  currentPrompt
}: InstancePromptDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      objective: 'custom',
      prompt: currentPrompt || "",
    },
  })

  // Buscar configuração atual
  const { data: currentConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['instanceConfig', instanceId],
    queryFn: async () => {
      if (!instanceId) return null
      
      console.log('Fetching instance configuration:', instanceId)
      const { data, error } = await supabase
        .from('instance_configurations')
        .select('*')
        .eq('instance_id', instanceId)
        .maybeSingle()
      
      if (error) {
        console.error('Error fetching instance configuration:', error)
        throw error
      }
      
      console.log('Instance configuration found:', data)
      return data
    },
    enabled: !!instanceId,
  })

  // Update form when dialog opens or currentPrompt/config changes
  useEffect(() => {
    if (open) {
      console.log('Updating form with current values:', {
        prompt: currentPrompt,
        objective: currentConfig?.objective
      })
      
      form.reset({
        objective: currentConfig?.objective || 'custom',
        prompt: currentPrompt || "",
      })
    }
  }, [open, currentPrompt, currentConfig, form])

  const promptMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!instanceId) throw new Error('Instance ID is required')
      
      console.log('Updating prompt for instance:', instanceId)
      const { error } = await supabase
        .from('evolution_instances')
        .update({ system_prompt: values.prompt })
        .eq('id', instanceId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] })
      toast({
        title: "Prompt atualizado",
        description: "O prompt do sistema foi atualizado com sucesso.",
      })
    },
    onError: (error) => {
      console.error('Error updating prompt:', error)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o prompt. Tente novamente.",
        variant: "destructive",
      })
    }
  })

  const configMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!instanceId) throw new Error('Instance ID is required')

      console.log('Updating instance configuration:', {
        instanceId,
        objective: values.objective,
        currentConfig
      })

      // Se já existe uma configuração, atualiza. Se não, cria uma nova.
      const operation = currentConfig 
        ? supabase
            .from('instance_configurations')
            .update({ objective: values.objective })
            .eq('instance_id', instanceId)
        : supabase
            .from('instance_configurations')
            .insert({
              instance_id: instanceId,
              objective: values.objective,
            });

      const { data, error } = await operation.select().single();

      if (error) {
        console.error('Error in config mutation:', error)
        throw error
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instanceConfig'] })
      toast({
        title: "Configuração salva",
        description: "As configurações da instância foram atualizadas com sucesso.",
      })
    },
    onError: (error) => {
      console.error('Error saving config:', error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar as configurações.",
        variant: "destructive",
      })
    }
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSaving(true)
      console.log('Submitting form with values:', values)
      
      // Salvar prompt e configurações em paralelo
      await Promise.all([
        promptMutation.mutateAsync(values),
        configMutation.mutateAsync(values)
      ])
      
      // Fechar diálogo apenas se ambas as operações forem bem-sucedidas
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoadingConfig) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configurar Instância</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="objective"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Objetivo</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    disabled={isSaving}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um objetivo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sales">Vendas</SelectItem>
                      <SelectItem value="support">Suporte</SelectItem>
                      <SelectItem value="scheduling">Agendamentos</SelectItem>
                      <SelectItem value="education">Educação</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    O objetivo principal desta instância do WhatsApp.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt do Sistema</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Digite o prompt do sistema..."
                      {...field}
                      rows={6}
                      disabled={isSaving}
                    />
                  </FormControl>
                  <FormDescription>
                    Configure como o assistente deve se comportar nesta instância.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={isSaving}
              >
                {isSaving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
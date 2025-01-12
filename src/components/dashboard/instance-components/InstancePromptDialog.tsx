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
  const [prompt, setPrompt] = useState("")
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      objective: 'custom',
    },
  })

  // Buscar configuração atual
  const { data: currentConfig } = useQuery({
    queryKey: ['instanceConfig', instanceId],
    queryFn: async () => {
      if (!instanceId) return null
      
      const { data, error } = await supabase
        .from('instance_configurations')
        .select('*')
        .eq('instance_id', instanceId)
        .maybeSingle()
      
      if (error) throw error
      return data
    },
    enabled: !!instanceId,
    meta: {
      onSuccess: (data: any) => {
        if (data) {
          form.reset({
            objective: data.objective,
          })
        }
      }
    }
  })

  // Update prompt state when dialog opens or currentPrompt changes
  useEffect(() => {
    if (open && currentPrompt !== undefined) {
      setPrompt(currentPrompt || "")
    }
  }, [open, currentPrompt])

  const promptMutation = useMutation({
    mutationFn: async () => {
      console.log('Updating prompt for instance:', instanceId)
      const { error } = await supabase
        .from('evolution_instances')
        .update({ system_prompt: prompt })
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

      const { data, error } = await supabase
        .from('instance_configurations')
        .upsert({
          instance_id: instanceId,
          objective: values.objective,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast({
        title: "Configuração salva",
        description: "As configurações da instância foram atualizadas com sucesso.",
      })
      queryClient.invalidateQueries({ queryKey: ['instanceConfig'] })
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

  const handleSave = async () => {
    try {
      // Salvar prompt
      await promptMutation.mutateAsync()
      
      // Salvar configurações
      await configMutation.mutateAsync(form.getValues())
      
      // Fechar diálogo apenas se ambas as operações forem bem-sucedidas
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configurar Instância</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <Form {...form}>
            <form className="space-y-4">
              <FormField
                control={form.control}
                name="objective"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objetivo</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
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
            </form>
          </Form>

          <div className="space-y-2">
            <FormLabel>Prompt do Sistema</FormLabel>
            <Textarea
              placeholder="Digite o prompt do sistema..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
            />
            <FormDescription>
              Configure como o assistente deve se comportar nesta instância.
            </FormDescription>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={promptMutation.isPending || configMutation.isPending}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={promptMutation.isPending || configMutation.isPending}
            >
              {(promptMutation.isPending || configMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
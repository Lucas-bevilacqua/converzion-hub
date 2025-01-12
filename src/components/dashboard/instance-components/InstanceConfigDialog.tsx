import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useToast } from "@/components/ui/use-toast"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

const formSchema = z.object({
  objective: z.enum(['sales', 'support', 'scheduling', 'education', 'custom'], {
    required_error: "Por favor selecione um objetivo",
  }),
})

interface InstanceConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: string | undefined
}

export function InstanceConfigDialog({
  open,
  onOpenChange,
  instanceId
}: InstanceConfigDialogProps) {
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
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!instanceId,
    onSuccess: (data) => {
      if (data) {
        form.reset({
          objective: data.objective,
        })
      }
    }
  })

  // Mutation para salvar configuração
  const mutation = useMutation({
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
      onOpenChange(false)
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

  function onSubmit(values: z.infer<typeof formSchema>) {
    mutation.mutate(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configurar Instância</DialogTitle>
          <DialogDescription>
            Configure o objetivo e as ferramentas desta instância do WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={mutation.isPending}
              >
                Salvar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
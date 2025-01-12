import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"

interface InstancePromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: string
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

  // Update prompt state when dialog opens or currentPrompt changes
  useEffect(() => {
    if (open && currentPrompt !== undefined) {
      setPrompt(currentPrompt || "")
    }
  }, [open, currentPrompt])

  const mutation = useMutation({
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
      onOpenChange(false)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configurar Prompt da Instância</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Digite o prompt do sistema..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar Prompt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
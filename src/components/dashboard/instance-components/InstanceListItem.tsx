import { Button } from "@/components/ui/button"
import { QrCode, MessageSquare, LogOut, Settings } from "lucide-react"
import { Database } from "@/integrations/supabase/types"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { useState } from "react"
import { InstancePromptDialog } from "./InstancePromptDialog"

type Instance = Database['public']['Tables']['evolution_instances']['Row']

interface InstanceListItemProps {
  instance: Instance
  onConnect: (instanceId: string) => void
}

export function InstanceListItem({ instance, onConnect }: InstanceListItemProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showPromptDialog, setShowPromptDialog] = useState(false)

  const { data: stateData } = useQuery({
    queryKey: ['instanceState', instance.id],
    queryFn: async () => {
      console.log('Verificando estado da instância:', instance.id)
      try {
        const { data, error } = await supabase.functions.invoke('check-instance-state', {
          body: { instanceId: instance.id }
        })
        
        if (error) {
          console.error('Erro ao verificar estado da instância:', error)
          toast({
            title: "Erro",
            description: "Falha ao verificar estado da instância. Tente novamente.",
            variant: "destructive",
          })
          throw error
        }
        
        console.log('Estado da instância recebido:', data)
        return data
      } catch (error) {
        console.error('Erro na verificação de estado:', error)
        return null
      }
    },
    refetchInterval: 5000,
    enabled: !!instance.id,
    retry: false
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      console.log('Desconectando instância:', instance.id)
      const { data, error } = await supabase.functions.invoke('disconnect-evolution-instance', {
        body: { instanceId: instance.id }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      console.log('Instância desconectada com sucesso:', instance.id)
      queryClient.invalidateQueries({ queryKey: ['instances'] })
      toast({
        title: "Sucesso",
        description: "Instância desconectada com sucesso",
      })
    },
    onError: (error) => {
      console.error('Erro ao desconectar instância:', error)
      toast({
        title: "Erro",
        description: "Falha ao desconectar instância. Tente novamente.",
        variant: "destructive",
      })
    }
  })

  const connectionStatus = stateData?.state || instance.connection_status
  console.log('Status atual da conexão:', connectionStatus)

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">{instance.name}</p>
          <p className="text-sm text-muted-foreground">{instance.phone_number}</p>
          <p className="text-sm text-muted-foreground">
            Status: {connectionStatus || 'Desconhecido'}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowPromptDialog(true)}
          title="Configurar Prompt"
        >
          <Settings className="h-4 w-4" />
        </Button>
        {connectionStatus === 'connected' ? (
          <Button
            variant="destructive"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Desconectar
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => onConnect(instance.id)}
            className="min-w-[120px]"
          >
            <QrCode className="mr-2 h-4 w-4" />
            Conectar
          </Button>
        )}
      </div>

      <InstancePromptDialog
        open={showPromptDialog}
        onOpenChange={setShowPromptDialog}
        instanceId={instance.id}
        currentPrompt={instance.system_prompt}
      />
    </div>
  )
}
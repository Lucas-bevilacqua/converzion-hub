import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { QRCodeDialog } from "./QRCodeDialog"
import { InstancePromptDialog } from "./InstancePromptDialog"
import { useToast } from "@/hooks/use-toast"
import type { EvolutionInstance } from "@/integrations/supabase/database-types/evolution-instances"
import { useAuth } from "@/contexts/auth/AuthContext"
import { InstanceConnectionStatus } from "./InstanceConnectionStatus"
import { InstanceActions } from "./InstanceActions"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Trash2 } from "lucide-react"
import { useInstanceMutations } from "./InstanceMutations"

interface InstanceSlotCardProps {
  instance: EvolutionInstance | null
  isUsed?: boolean
  onClick?: () => void
  onDisconnect?: () => void
}

export function InstanceSlotCard({ 
  instance, 
  isUsed, 
  onClick, 
  onDisconnect 
}: InstanceSlotCardProps) {
  const [showQRCode, setShowQRCode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isGeneratingQR, setIsGeneratingQR] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()
  const { deleteMutation } = useInstanceMutations()
  const queryClient = useQueryClient()

  console.log('InstanceSlotCard - Renderizando com instância:', instance?.id ?? 'nenhuma')

  const { data: instanceData, isLoading: isLoadingInstance, refetch: refetchInstance } = useQuery({
    queryKey: ['instance-data', instance?.id],
    queryFn: async () => {
      if (!instance?.id || !user) {
        console.log('Nenhuma instância ou usuário encontrado')
        return null
      }

      try {
        console.log('Buscando dados da instância:', instance.id)
        const { data: instanceData, error: instanceError } = await supabase
          .from('evolution_instances')
          .select('*')
          .eq('id', instance.id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (instanceError) {
          console.error('Erro ao buscar instância:', instanceError)
          throw instanceError
        }

        console.log('Dados da instância obtidos:', instanceData)
        return instanceData
      } catch (error) {
        console.error('Erro na consulta da instância:', error)
        throw error
      }
    },
    enabled: !!instance?.id && !!user?.id,
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  })

  const handleDelete = async () => {
    if (!instance?.id) {
      console.log('Tentativa de exclusão sem ID de instância')
      return
    }

    try {
      console.log('Excluindo instância:', instance.id)
      await deleteMutation.mutateAsync(instance.id)
      
      toast({
        title: "Sucesso",
        description: "Instância excluída com sucesso.",
      })

      await queryClient.invalidateQueries({ queryKey: ['instances'] })
    } catch (error) {
      console.error('Erro ao excluir instância:', error)
      toast({
        title: "Erro",
        description: "Falha ao excluir instância. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  const handleConnect = async () => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para conectar uma instância",
        variant: "destructive",
      })
      return
    }

    if (!instance?.id) {
      console.error('Tentativa de conexão sem ID de instância')
      return
    }

    try {
      setIsGeneratingQR(true)
      console.log('Iniciando conexão para instância:', instance.id)
      
      const { data, error } = await supabase.functions.invoke('connect-evolution-instance', {
        body: { instanceId: instance.id }
      })

      if (error) {
        console.error('Erro ao conectar:', error)
        throw error
      }

      if (!data?.qrCode) {
        throw new Error('QR Code não gerado')
      }

      console.log('QR Code gerado com sucesso')
      
      // Atualizar os dados da instância antes de mostrar o QR code
      await refetchInstance()
      
      // Só mostrar o QR code depois de ter certeza que foi gerado
      if (instanceData?.qr_code) {
        setShowQRCode(true)
        toast({
          title: "Sucesso",
          description: "QR Code gerado com sucesso. Escaneie para conectar.",
        })
      } else {
        throw new Error('QR Code não encontrado após geração')
      }
    } catch (error) {
      console.error('Erro ao conectar:', error)
      const errorMessage = error instanceof Error ? error.message : "Erro ao conectar instância"
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingQR(false)
    }
  }

  const isConnected = instance?.connection_status === 'connected'

  // Empty slot
  if (!isUsed) {
    return (
      <div className="relative p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="space-y-1">
            <h3 className="font-medium leading-none">Nova Instância</h3>
            <p className="text-sm text-muted-foreground">Número não conectado</p>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={onClick}
          >
            Adicionar Número
          </Button>
        </div>
      </div>
    )
  }

  if (!instance) {
    console.log('Renderizando slot sem dados de instância')
    return null
  }

  return (
    <>
      <div className="relative p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-medium leading-none">
                {instance.name || "Nova Instância"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {instance.phone_number || "Número não conectado"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <InstanceConnectionStatus 
                instance={instance}
                stateData={null}
                isLoading={isLoadingInstance}
              />
              {isUsed && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive/90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir Instância</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir esta instância? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          <InstanceActions
            instance={instance}
            isConnected={isConnected}
            isLoading={isLoadingInstance || isGeneratingQR}
            onConnect={handleConnect}
            onDisconnect={onDisconnect}
            onSettings={() => setShowSettings(true)}
            onQRCode={() => handleConnect()}
          />
        </div>
      </div>

      <QRCodeDialog
        open={showQRCode}
        onOpenChange={setShowQRCode}
        qrCode={instanceData?.qr_code || null}
      />

      <InstancePromptDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        instanceId={instance.id}
        currentPrompt={instance.system_prompt}
      />
    </>
  )
}
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
import { Trash2, AlertCircle } from "lucide-react"
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
  const { toast } = useToast()
  const { user } = useAuth()
  const { deleteMutation } = useInstanceMutations()
  const queryClient = useQueryClient()

  console.log('InstanceSlotCard - Renderizando com instância:', instance?.id)

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
          toast({
            title: "Erro ao carregar instância",
            description: "Não foi possível carregar os dados da instância. Tente novamente.",
            variant: "destructive",
          })
          return null
        }

        console.log('Dados da instância obtidos:', instanceData)
        return instanceData
      } catch (error) {
        console.error('Erro na consulta da instância:', error)
        toast({
          title: "Erro de conexão",
          description: "Não foi possível conectar ao servidor. Tente novamente em alguns segundos.",
          variant: "destructive",
        })
        return null
      }
    },
    enabled: !!instance?.id && !!user?.id,
    refetchInterval: 30000,
    retry: 5,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    retryOnMount: true,
    staleTime: 1000 * 60 * 5,
    meta: {
      onError: (error: Error) => {
        console.error('Erro na query da instância:', error)
        toast({
          title: "Erro de conexão",
          description: "Não foi possível conectar ao servidor. Tentando novamente em alguns segundos...",
          variant: "destructive",
        })
      }
    }
  })

  const handleDelete = async () => {
    if (!instance?.id) return

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

    try {
      console.log('Iniciando conexão para instância:', instance?.id)
      
      const { data, error } = await supabase.functions.invoke('connect-evolution-instance', {
        body: { instanceId: instance?.id }
      })

      if (error) {
        console.error('Erro ao conectar:', error)
        throw error
      }

      if (!data?.qrCode) {
        throw new Error('QR Code não gerado')
      }

      console.log('QR Code gerado com sucesso')
      
      setShowQRCode(true)
      await refetchInstance()

      toast({
        title: "Sucesso",
        description: "QR Code gerado com sucesso. Escaneie para conectar.",
      })
    } catch (error) {
      console.error('Erro ao conectar:', error)
      const errorMessage = error instanceof Error ? error.message : "Erro ao conectar instância"
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const isConnected = instance?.connection_status === 'connected'

  if (isLoadingInstance) {
    return (
      <div className="relative p-6 rounded-lg border bg-card text-card-foreground shadow-sm animate-pulse">
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (!instanceData && instance) {
    return (
      <div className="relative p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">Erro ao carregar dados da instância</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetchInstance()}
          className="mt-4"
        >
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="relative p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-medium leading-none">
                {instance?.name || "Nova Instância"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {instance?.phone_number || "Número não conectado"}
              </p>
            </div>
            {instance && (
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
            )}
          </div>

          {isUsed ? (
            <InstanceActions
              instance={instance!}
              isConnected={isConnected}
              isLoading={isLoadingInstance}
              onConnect={handleConnect}
              onDisconnect={onDisconnect}
              onSettings={() => setShowSettings(true)}
              onQRCode={() => setShowQRCode(true)}
            />
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={onClick}
            >
              Adicionar Número
            </Button>
          )}
        </div>
      </div>

      {instance && (
        <>
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
      )}
    </>
  )
}
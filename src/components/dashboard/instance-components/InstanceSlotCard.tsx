import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { QRCodeDialog } from "./QRCodeDialog"
import { InstancePromptDialog } from "./InstancePromptDialog"
import { useToast } from "@/hooks/use-toast"
import type { EvolutionInstance } from "@/integrations/supabase/database-types/evolution-instances"
import { useAuth } from "@/contexts/auth/AuthContext"
import { InstanceStatus } from "./InstanceStatus"
import { InstanceActions } from "./InstanceActions"

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

  const { data: stateData, isLoading: isLoadingState } = useQuery({
    queryKey: ['instance-state', instance?.id],
    queryFn: async () => {
      if (!instance?.id || !user) {
        console.log('Usuário não autenticado ou instância não encontrada')
        return null
      }
      
      console.log('Verificando estado do número:', instance.id)
      
      try {
        const { data: instanceData, error: instanceError } = await supabase
          .from('evolution_instances')
          .select('*')
          .eq('id', instance.id)
          .eq('user_id', user.id)
          .single()

        if (instanceError) {
          console.error('Erro ao verificar instância:', instanceError)
          return null
        }

        console.log('Instância encontrada:', instanceData)

        const { data, error } = await supabase.functions.invoke('check-instance-state', {
          body: { instanceId: instance.id }
        })

        if (error) {
          console.error('Erro ao verificar estado:', error)
          throw error
        }

        console.log('Estado recebido da API:', data)
        return data
      } catch (error) {
        console.error('Erro ao verificar estado:', error)
        toast({
          title: "Erro",
          description: "Falha ao verificar estado da instância. Tente novamente.",
          variant: "destructive",
        })
        throw error
      }
    },
    enabled: !!instance?.id && !!user?.id,
    refetchInterval: 2000,
    retry: true,
    retryDelay: 1000,
    gcTime: 0,
    staleTime: 0
  })

  const isConnected = instance?.connection_status === 'connected' || 
                     stateData?.state === 'connected' || 
                     stateData?.instance?.instance?.state === 'open'

  console.log('Status atual da conexão:', {
    stateData,
    isConnected,
    instanceStatus: instance?.connection_status,
    instanceState: instance?.status,
    apiState: stateData?.state,
    apiInstanceState: stateData?.instance?.instance?.state
  })

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
      
      const { data, error } = await supabase.functions.invoke('connect-instance', {
        body: { instanceId: instance?.id }
      })

      if (error) throw error

      if (!data.success) {
        throw new Error(data.error || 'Erro ao conectar instância')
      }

      console.log('QR Code gerado com sucesso:', data)

      toast({
        title: "Sucesso",
        description: "QR Code gerado com sucesso. Escaneie para conectar.",
      })

      setShowQRCode(true)
    } catch (error) {
      console.error('Erro ao conectar:', error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao conectar instância",
        variant: "destructive",
      })
    }
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
            <InstanceStatus 
              isConnected={isConnected} 
              isLoading={isLoadingState} 
            />
          </div>

          {isUsed ? (
            <InstanceActions
              instance={instance!}
              isConnected={isConnected}
              isLoading={isLoadingState}
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
          <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
            <QRCodeDialog
              open={showQRCode}
              onOpenChange={setShowQRCode}
              qrCode={instance.qr_code || null}
            />
          </Dialog>

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
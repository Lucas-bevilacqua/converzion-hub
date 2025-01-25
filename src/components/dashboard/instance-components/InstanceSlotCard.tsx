import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { QRCodeDialog } from "./QRCodeDialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, QrCode, Power } from "lucide-react"
import type { EvolutionInstance } from "@/integrations/supabase/database-types/evolution-instances"

interface InstanceSlotCardProps {
  instance: EvolutionInstance | null
  isUsed?: boolean
  onClick?: () => void
  onDisconnect?: () => void
}

export function InstanceSlotCard({ instance, isUsed, onClick, onDisconnect }: InstanceSlotCardProps) {
  const [showQRCode, setShowQRCode] = useState(false)
  const { toast } = useToast()

  const { data: stateData, isLoading: isLoadingState } = useQuery({
    queryKey: ['instance-state', instance?.id],
    queryFn: async () => {
      if (!instance?.id) return null
      console.log('Verificando estado do número:', instance.id)
      
      const { data, error } = await supabase.functions.invoke('check-instance-state', {
        body: { instanceId: instance.id }
      })

      if (error) {
        console.error('Erro ao verificar estado:', error)
        throw error
      }

      console.log('Estado recebido da API:', data)
      return data
    },
    enabled: !!instance?.id,
    refetchInterval: 5000
  })

  // Updated connection status logic to properly handle the 'open' state
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
    try {
      const { data, error } = await supabase.functions.invoke('connect-instance', {
        body: { instanceId: instance?.id }
      })

      if (error) throw error

      if (!data.success) {
        throw new Error(data.error || 'Erro ao conectar instância')
      }

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
            <div className="flex items-center gap-2">
              {isLoadingState ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isUsed ? (
              <>
                <Button
                  variant={isConnected ? "destructive" : "default"}
                  size="sm"
                  onClick={isConnected ? onDisconnect : handleConnect}
                  disabled={isLoadingState}
                >
                  <Power className="h-4 w-4 mr-2" />
                  {isConnected ? "Desconectar" : "Conectar"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQRCode(true)}
                  disabled={!instance}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  QR Code
                </Button>
              </>
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
      </div>

      {instance && (
        <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
          <QRCodeDialog
            open={showQRCode}
            onOpenChange={setShowQRCode}
            qrCode={instance.qr_code || null}
          />
        </Dialog>
      )}
    </>
  )
}
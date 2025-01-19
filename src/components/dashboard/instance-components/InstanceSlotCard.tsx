import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MessageSquare, QrCode, Settings, LogOut, Trash2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { useState } from "react"
import { QRCodeDialog } from "./QRCodeDialog"
import { InstancePromptDialog } from "./InstancePromptDialog"

interface InstanceSlotCardProps {
  isUsed: boolean
  instance?: any
  onClick?: () => void
  onDisconnect?: () => void
  onConfigurePrompt?: () => void
}

export function InstanceSlotCard({ 
  isUsed, 
  instance, 
  onClick, 
  onDisconnect,
  onConfigurePrompt 
}: InstanceSlotCardProps) {
  const { toast } = useToast()
  const [showQRCode, setShowQRCode] = useState(false)
  const [showPromptDialog, setShowPromptDialog] = useState(false)
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)

  // Query para verificar o estado do número
  const { data: stateData, error: stateError } = useQuery({
    queryKey: ['instanceState', instance?.id],
    queryFn: async () => {
      if (!instance?.id) return null
      
      console.log('Verificando estado do número:', instance.id)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          console.log('Nenhuma sessão ativa encontrada')
          return { state: 'disconnected' }
        }

        const { data, error } = await supabase.functions.invoke('check-instance-state', {
          body: { 
            instanceId: instance.id,
            instanceName: instance.name
          }
        })
        
        if (error) {
          console.error('Erro ao verificar estado do número:', error)
          throw error
        }

        const isConnected = data?.instance?.state === 'open'
        return { state: isConnected ? 'connected' : 'disconnected' }
      } catch (error) {
        console.error('Erro na verificação de estado:', error)
        // Retorna o último estado conhecido em caso de erro de conexão
        return { 
          state: instance?.connection_status || 'disconnected',
          error: true
        }
      }
    },
    enabled: !!instance?.id,
    refetchInterval: 5000,
    retry: 2,
    retryDelay: 1000
  })

  // Se houver erro na verificação de estado, mostra toast apenas uma vez
  React.useEffect(() => {
    if (stateError) {
      console.error('Erro ao verificar estado:', stateError)
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível verificar o estado do número. Tentando novamente...",
        variant: "destructive",
      })
    }
  }, [stateError])

  const handleDelete = async () => {
    if (!instance?.id) return
    
    try {
      console.log('Deletando configurações da instância:', instance.id)
      
      // Primeiro deleta as configurações
      const { error: configError } = await supabase
        .from('instance_configurations')
        .delete()
        .eq('instance_id', instance.id)

      if (configError) {
        console.error('Erro ao deletar configurações:', configError)
        throw configError
      }

      console.log('Configurações deletadas, agora deletando a instância')
      
      // Depois deleta a instância
      const { error: instanceError } = await supabase
        .from('evolution_instances')
        .delete()
        .eq('id', instance.id)

      if (instanceError) throw instanceError

      toast({
        title: "Sucesso",
        description: "Número excluído com sucesso",
      })

      window.location.reload()
    } catch (error) {
      console.error('Erro ao excluir número:', error)
      toast({
        title: "Erro",
        description: "Falha ao excluir número. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  const isConnected = stateData?.state === 'connected' || instance?.connection_status === 'connected'

  const handleConnect = async () => {
    if (!instance?.id) return
    
    try {
      console.log('Conectando número:', instance.id)
      const { data, error } = await supabase.functions.invoke('connect-evolution-instance', {
        body: { instanceId: instance.id }
      })

      if (error) {
        console.error('Erro ao conectar número:', error)
        toast({
          title: "Erro",
          description: "Falha ao conectar número. Tente novamente.",
          variant: "destructive",
        })
        return
      }

      if (data?.qrCode) {
        console.log('QR Code recebido:', data.qrCode)
        setQrCodeData(data.qrCode)
        setShowQRCode(true)
      }
    } catch (error) {
      console.error('Erro ao conectar:', error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  if (!isUsed) {
    return (
      <Card className="flex items-center justify-center p-6 cursor-pointer hover:bg-accent/50 transition-colors" onClick={onClick}>
        <CardContent className="flex flex-col items-center gap-2 p-0">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium">Adicionar Número</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="p-6">
        <CardContent className="space-y-4 p-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{instance.name}</p>
                <p className="text-sm text-muted-foreground">{instance.phone_number}</p>
                <p className="text-sm text-muted-foreground">
                  Status: {isConnected ? 'Conectado' : 'Desconectado'}
                  {stateData?.error && ' (Verificando...)'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPromptDialog(true)}
                title="Configurar Instância"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                title="Excluir Número"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={onDisconnect}
              >
                <LogOut className="h-4 w-4" />
                Desconectar
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleConnect}
              >
                <QrCode className="h-4 w-4" />
                Conectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!isConnected && (
        <QRCodeDialog
          open={showQRCode}
          onOpenChange={setShowQRCode}
          qrCode={qrCodeData}
        />
      )}

      <InstancePromptDialog
        open={showPromptDialog}
        onOpenChange={setShowPromptDialog}
        instanceId={instance?.id}
        currentPrompt={instance?.system_prompt}
      />
    </>
  )
}
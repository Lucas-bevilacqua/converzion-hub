import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MessageSquare, QrCode, Settings, LogOut } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { useState } from "react"
import { QRCodeDialog } from "./QRCodeDialog"

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
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)

  // Query para verificar o estado da instância
  const { data: stateData } = useQuery({
    queryKey: ['instanceState', instance?.id],
    queryFn: async () => {
      if (!instance?.id) return null
      
      console.log('Checking state for instance:', instance.id)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          console.log('No active session found')
          return { state: 'disconnected' }
        }

        const { data, error } = await supabase.functions.invoke('check-instance-state', {
          body: { instanceId: instance.id }
        })
        
        if (error) {
          console.error('Error checking instance state:', error)
          // Check if it's a subscription error
          if (error.message && error.message.includes('subscription_required')) {
            toast({
              title: "Subscription Required",
              description: "You need an active subscription to use this feature.",
              variant: "destructive",
            })
            return { state: 'disconnected' }
          }
          
          toast({
            title: "Error",
            description: "Failed to check instance state. Please try again.",
            variant: "destructive",
          })
          return { state: 'error' }
        }
        return data
      } catch (error) {
        console.error('Error in state check:', error)
        return { state: 'error' }
      }
    },
    enabled: !!instance?.id,
    refetchInterval: 5000,
    retry: false
  })

  const isConnected = stateData?.state === 'connected'

  const handleConnect = async () => {
    if (!instance?.id) return
    
    try {
      console.log('Connecting instance:', instance.id)
      const { data, error } = await supabase.functions.invoke('connect-evolution-instance', {
        body: { instanceId: instance.id }
      })

      if (error) {
        console.error('Error connecting instance:', error)
        toast({
          title: "Error",
          description: "Failed to connect instance. Please try again.",
          variant: "destructive",
        })
        return
      }

      if (data?.qrCode) {
        console.log('QR Code received:', data.qrCode)
        setQrCodeData(data.qrCode)
        setShowQRCode(true)
      }
    } catch (error) {
      console.error('Error in connect handler:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
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
          <p className="text-sm font-medium">Adicionar Instância</p>
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
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onConfigurePrompt}
              title="Configurar Prompt"
            >
              <Settings className="h-4 w-4" />
            </Button>
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

      <QRCodeDialog
        open={showQRCode}
        onOpenChange={setShowQRCode}
        qrCode={qrCodeData}
      />
    </>
  )
}
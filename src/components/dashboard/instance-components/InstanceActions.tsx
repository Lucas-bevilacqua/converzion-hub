import { Button } from "@/components/ui/button"
import { Power, QrCode, Settings } from "lucide-react"
import type { InstanceActionsProps } from "@/types/instance-types"

export function InstanceActions({ 
  instance,
  isConnected,
  isLoading,
  onConnect,
  onDisconnect,
  onSettings,
  onQRCode
}: InstanceActionsProps) {
  if (!instance) return null

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={isConnected ? "destructive" : "default"}
        size="sm"
        onClick={isConnected ? onDisconnect : onConnect}
        disabled={isLoading}
      >
        <Power className="h-4 w-4 mr-2" />
        {isConnected ? "Desconectar" : "Conectar"}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onQRCode}
      >
        <QrCode className="h-4 w-4 mr-2" />
        QR Code
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onSettings}
      >
        <Settings className="h-4 w-4 mr-2" />
        Configurações
      </Button>
    </div>
  )
}
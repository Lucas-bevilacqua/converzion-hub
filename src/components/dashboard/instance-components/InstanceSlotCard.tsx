import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquare, Plus, QrCode, Settings } from "lucide-react"

interface InstanceSlotCardProps {
  isUsed: boolean
  instance?: any
  onClick?: () => void
  onConfigurePrompt?: () => void
}

export function InstanceSlotCard({ isUsed, instance, onClick, onConfigurePrompt }: InstanceSlotCardProps) {
  if (!isUsed) {
    return (
      <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={onClick}>
        <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[200px]">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Clique para adicionar uma nova instância
          </p>
        </CardContent>
      </Card>
    )
  }

  const isConnected = instance?.connection_status === 'connected'
  const hasQrCode = !!instance?.qr_code
  const shouldShowQrCode = !isConnected && hasQrCode

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
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
        </div>

        {shouldShowQrCode && (
          <div className="flex flex-col items-center justify-center space-y-4">
            <img 
              src={instance.qr_code.startsWith('data:image') ? instance.qr_code : `data:image/png;base64,${instance.qr_code}`}
              alt="QR Code" 
              className="w-48 h-48"
            />
            <p className="text-sm text-muted-foreground text-center">
              Abra o WhatsApp no seu celular<br/>
              Toque em Menu ou Configurações e selecione Aparelhos Conectados<br/>
              Toque em Conectar um Aparelho<br/>
              Aponte seu celular para esta tela para capturar o código QR
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              onConfigurePrompt?.()
            }}
            title="Configurar Prompt"
          >
            <Settings className="h-4 w-4" />
          </Button>
          
          {!isConnected && !hasQrCode && (
            <Button variant="outline" onClick={onClick} className="gap-2">
              <QrCode className="h-4 w-4" />
              Conectar
            </Button>
          )}
          
          {isConnected && (
            <Button variant="outline" className="gap-2" disabled>
              <MessageSquare className="h-4 w-4" />
              Conectado
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, QrCode } from "lucide-react"

export interface QRCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qrCode: string | null
}

export function QRCodeDialog({ open, onOpenChange, qrCode }: QRCodeDialogProps) {
  console.log('QRCodeDialog - Renderizando com QR code:', qrCode ? 'presente' : 'null')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conecte seu WhatsApp</DialogTitle>
          <DialogDescription>
            Escaneie o código QR abaixo para conectar seu WhatsApp
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center space-y-4">
          {qrCode ? (
            <>
              <div className="relative w-64 h-64 bg-white rounded-lg shadow-sm overflow-hidden">
                <img 
                  src={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    console.error('Erro ao carregar imagem do QR code:', e)
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                1. Abra o WhatsApp no seu celular<br/>
                2. Toque em Menu ou Configurações e selecione Aparelhos Conectados<br/>
                3. Toque em Conectar um Aparelho<br/>
                4. Aponte seu celular para esta tela para capturar o código QR
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center w-64 h-64 gap-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <QrCode className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Gerando QR Code...<br/>
                Aguarde um momento
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
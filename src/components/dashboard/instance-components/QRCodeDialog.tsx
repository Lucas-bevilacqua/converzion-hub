import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

export interface QRCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qrCode: string | null
}

export function QRCodeDialog({ open, onOpenChange, qrCode }: QRCodeDialogProps) {
  console.log('QRCodeDialog - Rendering with QR code:', qrCode ? 'present' : 'null')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
                    console.error('Error loading QR code image:', e)
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Abra o WhatsApp no seu celular<br/>
                Toque em Menu ou Configurações e selecione Aparelhos Conectados<br/>
                Toque em Conectar um Aparelho<br/>
                Aponte seu celular para esta tela para capturar o código QR
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center w-64 h-64 gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm text-muted-foreground text-center">
                Gerando QR Code...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
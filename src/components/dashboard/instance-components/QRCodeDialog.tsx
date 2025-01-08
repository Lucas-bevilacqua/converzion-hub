import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

interface QRCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qrCode: string | null
}

export function QRCodeDialog({ open, onOpenChange, qrCode }: QRCodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conecte seu WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center space-y-4">
          {qrCode ? (
            <>
              <img 
                src={`data:image/png;base64,${qrCode}`} 
                alt="QR Code" 
                className="w-64 h-64"
              />
              <p className="text-sm text-muted-foreground text-center">
                Abra o WhatsApp no seu celular<br/>
                Toque em Menu ou Configurações e selecione Aparelhos Conectados<br/>
                Toque em Conectar um Aparelho<br/>
                Aponte seu celular para esta tela para capturar o código QR
              </p>
            </>
          ) : (
            <div className="flex items-center justify-center w-64 h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface EnterpriseContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EnterpriseContactDialog({ open, onOpenChange }: EnterpriseContactDialogProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Enviar para o HubSpot via Edge Function
      const { error } = await supabase.functions.invoke('create-hubspot-contact', {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          source: "Enterprise Plan Contact"
        }
      })

      if (error) throw error

      toast({
        title: "Sucesso!",
        description: "Suas informações foram enviadas. Você será redirecionado para o WhatsApp.",
      })

      // Redirecionar para o WhatsApp
      const message = encodeURIComponent("Olá! Gostaria de saber mais sobre o plano Enterprise.")
      window.open(`https://wa.me/551151941651?text=${message}`, '_blank')
      
      onOpenChange(false)
    } catch (error) {
      console.error('Error submitting form:', error)
      toast({
        title: "Erro",
        description: "Não foi possível enviar suas informações. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Fale com um Especialista</DialogTitle>
          <DialogDescription>
            Descubra como nossa IA pode revolucionar o atendimento da sua empresa. 
            Nossa assistente virtual irá te atender e demonstrar na prática como 
            podemos automatizar suas conversas mantendo um toque humano e personalizado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              required
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : "Falar com Especialista"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
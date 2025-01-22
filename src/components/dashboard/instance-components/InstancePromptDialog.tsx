import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useState, useEffect } from "react"

interface InstancePromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: { prompt: string; objective: string }) => void
  currentValues?: {
    prompt: string
    objective: string
  }
}

export function InstancePromptDialog({
  open,
  onOpenChange,
  onSave,
  currentValues,
}: InstancePromptDialogProps) {
  const [values, setValues] = useState({
    prompt: "",
    objective: "custom",
  })

  useEffect(() => {
    if (currentValues) {
      console.log('Updating form with current values:', currentValues)
      setValues(currentValues)
    }
  }, [currentValues])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configurar Instância</DialogTitle>
          <DialogDescription>
            Configure o comportamento e objetivo desta instância do WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="objective">Objetivo</Label>
            <Select
              value={values.objective}
              onValueChange={(value) => setValues((prev) => ({ ...prev, objective: value }))}
            >
              <SelectTrigger id="objective">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Vendas</SelectItem>
                <SelectItem value="support">Suporte</SelectItem>
                <SelectItem value="scheduling">Agendamento</SelectItem>
                <SelectItem value="education">Educação</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prompt">Prompt do Sistema</Label>
            <Textarea
              id="prompt"
              value={values.prompt}
              onChange={(e) => setValues((prev) => ({ ...prev, prompt: e.target.value }))}
              placeholder="Digite as instruções para o assistente..."
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(values)}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
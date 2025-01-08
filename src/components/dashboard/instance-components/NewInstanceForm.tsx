import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, X } from "lucide-react"

interface NewInstanceFormProps {
  newInstance: {
    name: string
    phone_number: string
  }
  onChange: (field: string, value: string) => void
  onAdd: () => void
  onCancel: () => void
  isLoading: boolean
}

export function NewInstanceForm({ 
  newInstance, 
  onChange, 
  onAdd, 
  onCancel,
  isLoading 
}: NewInstanceFormProps) {
  return (
    <div className="space-y-4 border rounded-lg p-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Nova Instância</h4>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-2">
        <Input
          placeholder="Nome da Instância"
          value={newInstance.name}
          onChange={(e) => onChange('name', e.target.value)}
        />
        <Input
          placeholder="Número do WhatsApp (com DDD do país)"
          value={newInstance.phone_number}
          onChange={(e) => onChange('phone_number', e.target.value)}
        />
        <div className="flex gap-2">
          <Button 
            onClick={onAdd}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Instância
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
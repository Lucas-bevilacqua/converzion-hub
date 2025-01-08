import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Plus } from "lucide-react"

interface NewInstanceFormProps {
  newInstance: {
    name: string
    phone_number: string
  }
  onChange: (field: string, value: string) => void
  onAdd: () => void
  isLoading: boolean
}

export function NewInstanceForm({ newInstance, onChange, onAdd, isLoading }: NewInstanceFormProps) {
  return (
    <div className="space-y-4 border-t pt-4">
      <h4 className="font-medium">Adicionar Nova Instância</h4>
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
        <Button 
          onClick={onAdd}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Instância
        </Button>
      </div>
    </div>
  )
}
import { Card, CardContent } from "@/components/ui/card"
import { Plus, MessageSquare } from "lucide-react"

interface InstanceSlotCardProps {
  onClick: () => void
  isUsed: boolean
}

export function InstanceSlotCard({ onClick, isUsed }: InstanceSlotCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all duration-300 hover:scale-105 ${
        isUsed ? 'bg-gray-50 border-gray-200' : 'hover:border-primary hover:shadow-md'
      }`}
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center justify-center h-40 p-6">
        {isUsed ? (
          <>
            <MessageSquare className="h-8 w-8 text-gray-400 mb-3" />
            <p className="text-sm text-muted-foreground text-center">
              Slot em uso
            </p>
          </>
        ) : (
          <>
            <Plus className="h-8 w-8 text-primary mb-3" />
            <p className="text-sm text-primary text-center font-medium">
              Adicionar nova instância
            </p>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Clique para configurar
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
import { Card, CardContent } from "@/components/ui/card"
import { Plus } from "lucide-react"

interface InstanceSlotCardProps {
  onClick: () => void
  isUsed: boolean
}

export function InstanceSlotCard({ onClick, isUsed }: InstanceSlotCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:scale-105 ${
        isUsed ? 'bg-gray-100' : 'hover:border-primary'
      }`}
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center justify-center h-32 p-4">
        {isUsed ? (
          <p className="text-sm text-muted-foreground text-center">
            Slot em uso
          </p>
        ) : (
          <>
            <Plus className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground text-center">
              Adicionar nova instância
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
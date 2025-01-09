import { Card, CardContent } from "@/components/ui/card"
import { Plus, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

interface InstanceSlotCardProps {
  onClick: () => void
  isUsed: boolean
  instance?: any
  onConfigurePrompt?: () => void
}

export function InstanceSlotCard({ onClick, isUsed, instance, onConfigurePrompt }: InstanceSlotCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all duration-300 ${
        isUsed ? 'bg-gray-50 border-gray-200' : 'hover:border-primary hover:shadow-md'
      }`}
    >
      <CardContent className="flex flex-col items-center justify-center h-40 p-6">
        {isUsed ? (
          <>
            <MessageSquare className="h-8 w-8 text-gray-400 mb-3" />
            <p className="text-sm text-muted-foreground text-center mb-2">
              {instance?.name || 'Slot em uso'}
            </p>
            {onConfigurePrompt && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onConfigurePrompt()
                }}
              >
                Configurar Prompt
              </Button>
            )}
          </>
        ) : (
          <div onClick={onClick} className="flex flex-col items-center">
            <Plus className="h-8 w-8 text-primary mb-3" />
            <p className="text-sm text-primary text-center font-medium">
              Adicionar nova instância
            </p>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Clique para configurar
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
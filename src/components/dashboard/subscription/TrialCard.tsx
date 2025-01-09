import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface TrialCardProps {
  onUpgrade: () => void;
}

export const TrialCard = ({ onUpgrade }: TrialCardProps) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-purple-50 border-purple-200">
            <h3 className="text-lg font-semibold text-purple-600 mb-2">
              Plano Professional
            </h3>
            <p className="text-sm text-muted-foreground">
              Acesso completo a todas as funcionalidades
            </p>
          </div>

          <Button 
            onClick={onUpgrade} 
            className="w-full"
          >
            Assinar Agora
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
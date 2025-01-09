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
          <div className="p-4 rounded-lg bg-purple-50">
            <h3 className="text-lg font-semibold text-purple-600 mb-2">
              Plano Professional
            </h3>
            <p className="text-sm text-purple-600">
              Acesso completo a todas as funcionalidades
            </p>
          </div>

          <Button 
            onClick={onUpgrade} 
            className="w-full bg-emerald-500 hover:bg-emerald-600"
          >
            Assinar Agora
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
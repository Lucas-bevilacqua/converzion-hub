import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Crown } from "lucide-react"
import { TrialBadge } from "./TrialBadge"
import { differenceInDays } from "date-fns"

interface TrialCardProps {
  trialEndsAt: string;
  onUpgrade: () => void;
}

export const TrialCard = ({ trialEndsAt, onUpgrade }: TrialCardProps) => {
  const getDaysRemaining = () => {
    const daysRemaining = differenceInDays(new Date(trialEndsAt), new Date())
    return Math.max(0, daysRemaining)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-purple-500" />
          Trial Professional Ativo
        </CardTitle>
        <CardDescription>
          Aproveite todos os recursos do plano Professional
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <TrialBadge daysRemaining={getDaysRemaining()} />
          
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
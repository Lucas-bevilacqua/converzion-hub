import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Crown } from "lucide-react"
import { differenceInDays } from "date-fns"

interface TrialAlertProps {
  trialEndsAt: string;
}

export const TrialAlert = ({ trialEndsAt }: TrialAlertProps) => {
  const daysRemaining = differenceInDays(new Date(trialEndsAt), new Date())
  
  return (
    <Alert variant="default" className="bg-purple-50 border-purple-200">
      <Crown className="h-5 w-5 text-purple-500" />
      <AlertTitle className="text-purple-700">Período Trial Ativo</AlertTitle>
      <AlertDescription className="text-purple-600">
        Você está no período trial do plano Professional. 
        Expira em {new Date(trialEndsAt).toLocaleDateString()} 
        ({daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'} restantes).
      </AlertDescription>
    </Alert>
  )
}
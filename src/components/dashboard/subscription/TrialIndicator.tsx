import { Crown } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export const TrialIndicator = ({ daysRemaining }: { daysRemaining: number }) => {
  return (
    <Alert variant="default" className="bg-purple-50 border-purple-200">
      <Crown className="h-5 w-5 text-purple-500" />
      <AlertTitle className="text-purple-700">Período Trial Ativo</AlertTitle>
      <AlertDescription className="text-purple-600">
        Você está no período trial do plano Professional. 
        Restam {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'} para aproveitar todos os recursos.
      </AlertDescription>
    </Alert>
  )
}
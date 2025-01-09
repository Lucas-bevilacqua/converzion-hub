import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Crown, CheckCircle2 } from "lucide-react"

interface ActiveSubscriptionCardProps {
  planName: string;
  instances: number;
  currentPeriodEnd: string;
  onUpgrade: () => void;
}

export const ActiveSubscriptionCard = ({ 
  planName, 
  instances, 
  currentPeriodEnd,
  onUpgrade 
}: ActiveSubscriptionCardProps) => {
  const planDetails = planName === 'Profissional'
    ? {
        color: 'text-purple-500',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200'
      }
    : {
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className={`h-5 w-5 ${planDetails.color}`} />
          Plano Atual
        </CardTitle>
        <CardDescription>
          Gerencie sua assinatura
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className={`p-4 border rounded-lg ${planDetails.bgColor} ${planDetails.borderColor}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-lg font-semibold ${planDetails.color}`}>
                Plano {planName}
              </h3>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              {instances} instância{instances !== 1 ? 's' : ''} disponíve{instances !== 1 ? 'is' : 'l'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Válido até: {new Date(currentPeriodEnd).toLocaleDateString()}
            </p>
          </div>

          {planName !== 'Profissional' && (
            <Button 
              onClick={onUpgrade} 
              className="w-full"
              variant="outline"
            >
              Fazer Upgrade
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
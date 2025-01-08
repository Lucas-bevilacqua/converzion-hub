import { CheckCircle2 } from "lucide-react"
import { type Subscription } from "@/integrations/supabase/database-types/subscriptions"

interface PlanDetailsSectionProps {
  subscription: Subscription | null
  planDetails: {
    name: string
    instances: number
    color: string
    bgColor: string
    borderColor: string
  }
}

export function PlanDetailsSection({ subscription, planDetails }: PlanDetailsSectionProps) {
  return (
    <div className={`p-4 border rounded-lg ${planDetails.bgColor} ${planDetails.borderColor}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-lg font-semibold ${planDetails.color}`}>
          Plano {planDetails.name}
        </h3>
        {subscription?.status === 'active' && (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {planDetails.instances} instância{planDetails.instances !== 1 ? 's' : ''} disponíve{planDetails.instances !== 1 ? 'is' : 'l'}
      </p>
      {subscription?.status === 'active' && subscription.current_period_end && (
        <p className="text-sm text-muted-foreground mt-1">
          Válido até: {new Date(subscription.current_period_end).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}
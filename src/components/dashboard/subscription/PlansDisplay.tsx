import { Card, CardContent } from "@/components/ui/card"
import { PlanCard } from "./PlanCard"

interface Plan {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  priceId: string;
}

interface PlansDisplayProps {
  plans: Plan[];
  onUpgrade: (plan: Plan) => void;
  currentPlanId?: string;
  trialPlanName?: string;
}

export const PlansDisplay = ({ 
  plans, 
  onUpgrade, 
  currentPlanId,
  trialPlanName 
}: PlansDisplayProps) => {
  return (
    <Card>
      <CardContent className="py-6">
        <div className="grid gap-6">
          {plans.map((plan) => (
            <PlanCard
              key={plan.name}
              {...plan}
              onSelect={() => onUpgrade(plan)}
              buttonText={plan.name === currentPlanId ? 'Plano Atual' : 'Assinar Agora'}
              isTrial={plan.name === trialPlanName}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
import { Card } from "@/components/ui/card"
import { CalendarDays, Laptop2, Power } from "lucide-react"
import type { Subscription } from "@/integrations/supabase/database-types/subscriptions"
import type { EvolutionInstance } from "@/integrations/supabase/database-types/evolution-instances"
import { MetricsOverview } from "./MetricsOverview"

interface DashboardOverviewProps {
  subscription: Subscription | null;
  instances: EvolutionInstance[];
}

const getPlanDisplayName = (planId: string | null) => {
  if (!planId) return 'Sem plano'
  return planId.includes('professional') ? 'Profissional' : 'Inicial'
}

export function DashboardOverview({ subscription, instances }: DashboardOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Power className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Plano Atual</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold">
              {subscription ? getPlanDisplayName(subscription.plan_id) : 'Sem plano'}
            </div>
            <p className="text-xs text-muted-foreground">
              {subscription?.status === 'active' ? 'Ativo' : 'Inativo'}
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Renovação</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold">
              {subscription?.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString('pt-BR')
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              Próxima renovação
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Laptop2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">WhatsApp</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold">
              {instances.length}/{subscription?.plan_id?.includes('professional') ? '3' : '1'}
            </div>
            <p className="text-xs text-muted-foreground">
              Números conectados
            </p>
          </div>
        </Card>
      </div>

      <MetricsOverview />
    </div>
  )
}
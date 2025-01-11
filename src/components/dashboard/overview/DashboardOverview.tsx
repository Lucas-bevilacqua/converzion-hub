import { Card } from "@/components/ui/card"
import { CalendarDays, Laptop2, Power } from "lucide-react"
import { ChartContainer } from "@/components/ui/chart"
import type { Subscription } from "@/integrations/supabase/database-types/subscriptions"
import type { EvolutionInstance } from "@/integrations/supabase/database-types/evolution-instances"
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis, Tooltip } from "recharts"

interface DashboardOverviewProps {
  subscription: Subscription | null;
  instances: EvolutionInstance[];
}

const getPlanDisplayName = (planId: string | null) => {
  switch (planId) {
    case 'starter':
      return 'Starter'
    case 'professional':
      return 'Professional'
    default:
      return 'Plano Atual'
  }
}

export function DashboardOverview({ subscription, instances }: DashboardOverviewProps) {
  const connectedInstances = instances.filter(instance => instance.connection_status === 'connected')
  const disconnectedInstances = instances.filter(instance => instance.connection_status === 'disconnected')
  const availableInstances = instances.length > 0 ? 1 - instances.length : 1

  const chartData = [
    {
      name: 'Conectadas',
      total: connectedInstances.length,
    },
    {
      name: 'Desconectadas',
      total: disconnectedInstances.length,
    },
    {
      name: 'Disponíveis',
      total: Math.max(0, availableInstances),
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          <span className="text-sm font-medium">Instâncias</span>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold">
            {instances.length}/{subscription?.plan_id === 'professional' ? '3' : '1'}
          </div>
          <p className="text-xs text-muted-foreground">
            Instâncias em uso
          </p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Power className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Conexões</span>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold">
            {connectedInstances.length}/{instances.length}
          </div>
          <p className="text-xs text-muted-foreground">
            Instâncias conectadas
          </p>
        </div>
      </Card>

      <Card className="col-span-full p-4">
        <h3 className="text-lg font-semibold mb-4">Visão Geral das Instâncias</h3>
        <div className="h-[200px] w-full">
          <ChartContainer config={{}}>
            <RechartsBarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="var(--primary)" />
            </RechartsBarChart>
          </ChartContainer>
        </div>
      </Card>
    </div>
  )
}
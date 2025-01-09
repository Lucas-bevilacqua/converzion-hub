import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartBar, Calendar, Server, CheckCircle, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChartContainer } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

interface DashboardOverviewProps {
  subscription: any
  instances: any[]
}

export function DashboardOverview({ subscription, instances }: DashboardOverviewProps) {
  // Calcula o limite de instâncias baseado no plano
  const getInstanceLimit = () => {
    if (!subscription) return 0
    return subscription.plan_id === 'professional' ? 3 : 1
  }

  // Calcula estatísticas das instâncias
  const instanceStats = {
    total: instances?.length || 0,
    connected: instances?.filter(i => i.connection_status === 'connected').length || 0,
    disconnected: instances?.filter(i => i.connection_status === 'disconnected').length || 0,
    limit: getInstanceLimit()
  }

  // Dados para o gráfico (exemplo simples)
  const chartData = [
    { name: 'Conectadas', value: instanceStats.connected },
    { name: 'Desconectadas', value: instanceStats.disconnected },
    { name: 'Disponíveis', value: Math.max(0, instanceStats.limit - instanceStats.total) }
  ]

  const chartConfig = {
    connected: { color: "#22c55e" },
    disconnected: { color: "#ef4444" },
    available: { color: "#94a3b8" }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Status da Assinatura */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Plano Atual
          </CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold capitalize">
            {subscription?.plan_id || 'Nenhum'}
          </div>
          <p className="text-xs text-muted-foreground">
            {subscription?.status === 'trial' ? 'Período Trial' : 'Ativo'}
          </p>
        </CardContent>
      </Card>

      {/* Data de Renovação */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Renovação
          </CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {subscription?.current_period_end ? 
              format(new Date(subscription.current_period_end), 'dd/MM/yyyy', { locale: ptBR }) :
              'N/A'
            }
          </div>
          <p className="text-xs text-muted-foreground">
            Próxima renovação
          </p>
        </CardContent>
      </Card>

      {/* Uso de Instâncias */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Instâncias
          </CardTitle>
          <Server className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {instanceStats.total}/{instanceStats.limit}
          </div>
          <p className="text-xs text-muted-foreground">
            Instâncias em uso
          </p>
        </CardContent>
      </Card>

      {/* Status das Conexões */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Conexões
          </CardTitle>
          {instanceStats.connected === instanceStats.total ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {instanceStats.connected}/{instanceStats.total}
          </div>
          <p className="text-xs text-muted-foreground">
            Instâncias conectadas
          </p>
        </CardContent>
      </Card>

      {/* Gráfico de Uso */}
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Visão Geral das Instâncias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ChartContainer
              config={chartConfig}
            >
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#22c55e" />
              </BarChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
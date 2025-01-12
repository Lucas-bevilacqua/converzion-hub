import { Card } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth/AuthContext"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
import { Loader2 } from "lucide-react"

export function MetricsOverview() {
  const { user } = useAuth()

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['instance-metrics', user?.id],
    queryFn: async () => {
      console.log('Fetching metrics for user:', user?.id)
      const { data, error } = await supabase
        .from('instance_metrics')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(7)

      if (error) {
        console.error('Error fetching metrics:', error)
        throw error
      }

      return data.map(metric => ({
        ...metric,
        date: new Date(metric.created_at).toLocaleDateString('pt-BR'),
      }))
    },
    enabled: !!user?.id
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Métricas dos Últimos 7 Dias</h3>
      
      <div className="space-y-8">
        <div className="h-[200px]">
          <ChartContainer
            className="w-full"
            config={{
              messages: {
                theme: {
                  light: "#0056D2",
                  dark: "#60A5FA",
                },
                label: "Mensagens Enviadas",
              },
              time: {
                theme: {
                  light: "#00C896",
                  dark: "#34D399",
                },
                label: "Tempo de Conexão (min)",
              },
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics}>
                <XAxis 
                  dataKey="date" 
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="messages_sent"
                  name="messages"
                  fill="var(--color-messages)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="connection_time_minutes"
                  name="time"
                  fill="var(--color-time)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total de Mensagens</p>
            <p className="text-2xl font-bold">
              {metrics?.reduce((acc, curr) => acc + (curr.messages_sent || 0), 0)}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Tempo Total Conectado</p>
            <p className="text-2xl font-bold">
              {Math.round(metrics?.reduce((acc, curr) => acc + (curr.connection_time_minutes || 0), 0) / 60)}h
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
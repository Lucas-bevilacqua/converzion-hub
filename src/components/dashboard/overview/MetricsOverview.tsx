import { Card } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth/AuthContext"
import { ChartContainer } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts"
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
        date: new Date(metric.created_at).toLocaleDateString('pt-BR', { 
          weekday: 'short',
          day: '2-digit',
          month: '2-digit'
        }),
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
        <div className="h-[300px]">
          <ChartContainer
            className="w-full"
            config={{
              messages_sent: {
                theme: {
                  light: "#0056D2",
                  dark: "#60A5FA",
                },
                label: "Mensagens Enviadas",
              },
              messages_received: {
                theme: {
                  light: "#00C896",
                  dark: "#34D399",
                },
                label: "Mensagens Recebidas",
              },
              response_time: {
                theme: {
                  light: "#F59E0B",
                  dark: "#FBBF24",
                },
                label: "Tempo de Resposta (s)",
              }
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="date" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={true}
                />
                <YAxis 
                  fontSize={12}
                  tickLine={false}
                  axisLine={true}
                  yAxisId="messages"
                />
                <YAxis 
                  fontSize={12}
                  tickLine={false}
                  axisLine={true}
                  yAxisId="time"
                  orientation="right"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px'
                  }}
                  labelStyle={{
                    color: 'var(--foreground)'
                  }}
                />
                <Legend />
                <Bar
                  dataKey="messages_sent"
                  name="Mensagens Enviadas"
                  fill="var(--color-messages_sent)"
                  radius={[4, 4, 0, 0]}
                  yAxisId="messages"
                />
                <Bar
                  dataKey="messages_received"
                  name="Mensagens Recebidas"
                  fill="var(--color-messages_received)"
                  radius={[4, 4, 0, 0]}
                  yAxisId="messages"
                />
                <Bar
                  dataKey="average_response_time_seconds"
                  name="Tempo de Resposta"
                  fill="var(--color-response_time)"
                  radius={[4, 4, 0, 0]}
                  yAxisId="time"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total de Mensagens Enviadas</p>
            <p className="text-2xl font-bold">
              {metrics?.reduce((acc, curr) => acc + (curr.messages_sent || 0), 0)}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total de Mensagens Recebidas</p>
            <p className="text-2xl font-bold">
              {metrics?.reduce((acc, curr) => acc + (curr.messages_received || 0), 0)}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Tempo Médio de Resposta</p>
            <p className="text-2xl font-bold">
              {Math.round(metrics?.reduce((acc, curr) => acc + (curr.average_response_time_seconds || 0), 0) / (metrics?.length || 1))}s
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
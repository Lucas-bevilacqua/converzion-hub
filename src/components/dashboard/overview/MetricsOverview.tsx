import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { useAuth } from "@/contexts/auth/AuthContext"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export function MetricsOverview() {
  const { user } = useAuth()

  const { data: metrics } = useQuery({
    queryKey: ['instance-metrics', user?.id],
    queryFn: async () => {
      console.log('Fetching metrics for user:', user?.id)
      const { data, error } = await supabase
        .from('instance_metrics')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true })
        .limit(7)

      if (error) {
        console.error('Error fetching metrics:', error)
        throw error
      }

      return data?.map(metric => ({
        ...metric,
        date: format(new Date(metric.created_at), 'dd/MM', { locale: ptBR }),
      }))
    },
    enabled: !!user?.id,
    refetchInterval: 30000 // Atualiza a cada 30 segundos
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Métricas dos Últimos 7 Dias</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
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
              <BarChart data={metrics}>
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
                  cursor={{ fill: 'transparent' }}
                  formatter={(value: number, name: string) => [
                    value,
                    name === "Tempo de Resposta" ? `${value}s` : value
                  ]}
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

        <div className="grid grid-cols-3 gap-4 mt-6">
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
      </CardContent>
    </Card>
  )
}
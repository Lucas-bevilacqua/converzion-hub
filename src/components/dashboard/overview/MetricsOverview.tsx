import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { useAuth } from "@/contexts/auth/AuthContext"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export function MetricsOverview() {
  const { user } = useAuth()

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['instance-metrics', user?.id],
    queryFn: async () => {
      console.log('Fetching metrics for user:', user?.id)
      if (!user?.id) throw new Error('No user ID available')

      // Calculate date range (last 7 days)
      const endDate = endOfDay(new Date())
      const startDate = startOfDay(subDays(endDate, 6)) // 6 days ago to include today

      console.log('Fetching metrics from', startDate, 'to', endDate)

      const { data, error } = await supabase
        .from('instance_metrics')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching metrics:', error)
        throw error
      }

      console.log('Metrics data received:', data)
      
      // Format dates and ensure we have data for all 7 days
      const formattedData = []
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i)
        const dayData = data?.find(m => 
          format(new Date(m.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        )
        
        formattedData.push({
          date: format(date, 'dd/MM/yyyy', { locale: ptBR }),
          messages_sent: dayData?.messages_sent || 0,
          messages_received: dayData?.messages_received || 0,
          average_response_time_seconds: dayData?.average_response_time_seconds || 0,
          created_at: date.toISOString(),
        })
      }

      console.log('Formatted data:', formattedData)
      return formattedData
    },
    enabled: !!user?.id,
    retry: 3,
    retryDelay: 1000,
    staleTime: 30000
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Métricas dos Últimos 7 Dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <Skeleton className="w-full h-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Métricas dos Últimos 7 Dias</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar métricas. Por favor, tente novamente mais tarde.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const totalMessagesSent = metrics?.reduce((acc, curr) => acc + (curr.messages_sent || 0), 0) || 0
  const totalMessagesReceived = metrics?.reduce((acc, curr) => acc + (curr.messages_received || 0), 0) || 0
  
  // Calcular tempo médio de resposta do bot apenas dos dias que tiveram mensagens
  const daysWithMessages = metrics?.filter(day => 
    day.messages_received > 0 && 
    day.average_response_time_seconds > 0
  ) || []
  
  console.log('Dias com mensagens:', daysWithMessages)
  
  const averageResponseTime = daysWithMessages.length > 0
    ? Math.round(daysWithMessages.reduce((acc, curr) => acc + curr.average_response_time_seconds, 0) / daysWithMessages.length)
    : 0

  console.log('Tempo médio de resposta do bot (segundos):', averageResponseTime)

  const formatResponseTime = (seconds: number) => {
    if (!seconds) return '0s'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}min ${remainingSeconds}s`
  }

  return (
    <Card className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <CardHeader className="border-b border-gray-200 dark:border-gray-700">
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Métricas dos Últimos 7 Dias
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="min-h-[300px] w-full">
          <ChartContainer
            className="w-full h-full"
            config={{
              messages_sent: {
                theme: {
                  light: "#F97316",
                  dark: "#FB923C",
                },
                label: "Mensagens Enviadas",
              },
              messages_received: {
                theme: {
                  light: "#10B981",
                  dark: "#34D399",
                },
                label: "Mensagens Recebidas",
              }
            }}
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={metrics}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <XAxis
                  dataKey="date"
                  fontSize={12}
                  tickLine={false}
                  axisLine={true}
                  stroke="#94A3B8"
                  dy={10}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  fontSize={12}
                  tickLine={false}
                  axisLine={true}
                  stroke="#94A3B8"
                  dx={-10}
                  label={{ 
                    value: 'Quantidade de Mensagens', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                />
                <Tooltip 
                  cursor={{ stroke: 'rgba(0,0,0,0.05)', strokeWidth: 2 }}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    padding: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value: number, name: string) => {
                    const formattedName = name === "messages_sent" ? "Mensagens Enviadas" : "Mensagens Recebidas"
                    return [value, formattedName]
                  }}
                  labelFormatter={(label) => `Data: ${label}`}
                />
                <Legend 
                  wrapperStyle={{
                    paddingTop: '20px'
                  }}
                  formatter={(value) => {
                    return value === "messages_sent" ? "Mensagens Enviadas" : "Mensagens Recebidas"
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="messages_sent"
                  name="messages_sent"
                  stroke="var(--color-messages_sent)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-messages_sent)" }}
                />
                <Line
                  type="monotone"
                  dataKey="messages_received"
                  name="messages_received"
                  stroke="var(--color-messages_received)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-messages_received)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="space-y-2 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total de Mensagens Enviadas</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {totalMessagesSent.toLocaleString()}
            </p>
          </div>
          <div className="space-y-2 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total de Mensagens Recebidas</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {totalMessagesReceived.toLocaleString()}
            </p>
          </div>
          <div className="space-y-2 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Tempo Médio de Resposta</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatResponseTime(averageResponseTime)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
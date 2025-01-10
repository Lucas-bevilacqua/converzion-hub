import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartBar, Calendar, Server, CheckCircle, AlertCircle, LogOut } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChartContainer } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

interface DashboardOverviewProps {
  subscription: any
  instances: any[]
}

export function DashboardOverview({ subscription, instances }: DashboardOverviewProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const getInstanceLimit = () => {
    if (!subscription) return 0
    return subscription.plan_id === 'professional' ? 3 : 1
  }

  // Query para verificar o estado atual de todas as instâncias
  const { data: instanceStates } = useQuery({
    queryKey: ['instanceStates', instances?.map(i => i.id)],
    queryFn: async () => {
      const states: Record<string, string> = {}
      
      if (!instances?.length) return states
      
      await Promise.all(instances.map(async (instance) => {
        try {
          const response = await supabase.functions.invoke('check-instance-state', {
            body: { instanceId: instance.id }
          })
          states[instance.id] = response.data?.state || 'disconnected'
        } catch (error) {
          console.error(`Error checking state for instance ${instance.id}:`, error)
          states[instance.id] = 'disconnected'
        }
      }))
      
      return states
    },
    enabled: !!instances?.length,
    refetchInterval: 5000 // Atualiza a cada 5 segundos
  })

  // Mutation para desconectar instância
  const disconnectMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      console.log('Desconectando instância:', instanceId)
      const { data, error } = await supabase.functions.invoke('disconnect-evolution-instance', {
        body: { instanceId }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instanceStates'] })
      queryClient.invalidateQueries({ queryKey: ['instances'] })
      toast({
        title: "Sucesso",
        description: "Instância desconectada com sucesso",
      })
    },
    onError: (error) => {
      console.error('Erro ao desconectar instância:', error)
      toast({
        title: "Erro",
        description: "Não foi possível desconectar a instância. Tente novamente.",
        variant: "destructive",
      })
    }
  })

  const instanceStats = {
    total: instances?.length || 0,
    connected: instances?.filter(i => instanceStates?.[i.id] === 'connected').length || 0,
    disconnected: instances?.filter(i => instanceStates?.[i.id] !== 'connected').length || 0,
    limit: getInstanceLimit()
  }

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
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Status da Assinatura */}
      <Card className="bg-white hover:shadow-md transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Plano Atual
          </CardTitle>
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900 capitalize">
            {subscription?.plan_id || 'Nenhum'}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {subscription?.status === 'trial' ? 'Período Trial' : 'Ativo'}
          </p>
        </CardContent>
      </Card>

      {/* Data de Renovação */}
      <Card className="bg-white hover:shadow-md transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Renovação
          </CardTitle>
          <Calendar className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            {subscription?.current_period_end ? 
              format(new Date(subscription.current_period_end), 'dd/MM/yyyy', { locale: ptBR }) :
              'N/A'
            }
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Próxima renovação
          </p>
        </CardContent>
      </Card>

      {/* Uso de Instâncias */}
      <Card className="bg-white hover:shadow-md transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Instâncias
          </CardTitle>
          <Server className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            {instanceStats.total}/{instanceStats.limit}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Instâncias em uso
          </p>
        </CardContent>
      </Card>

      {/* Status das Conexões */}
      <Card className="bg-white hover:shadow-md transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Conexões
          </CardTitle>
          {instanceStats.connected === instanceStats.total ? (
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {instanceStats.connected}/{instanceStats.total}
              </div>
              <p className="text-xs text-gray-500">
                Instâncias conectadas
              </p>
            </div>
            
            {/* Lista de instâncias com botão de desconectar */}
            {instances?.map((instance) => (
              <div key={instance.id} className="flex items-center justify-between text-sm">
                <span>{instance.name}</span>
                {instanceStates?.[instance.id] === 'connected' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => disconnectMutation.mutate(instance.id)}
                    disabled={disconnectMutation.isPending}
                  >
                    <LogOut className="h-4 w-4" />
                    Desconectar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Uso */}
      <Card className="col-span-full bg-white hover:shadow-md transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-gray-900">Visão Geral das Instâncias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
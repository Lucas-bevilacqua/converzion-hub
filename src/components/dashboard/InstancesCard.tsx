import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageSquare, Loader2, Plus, QrCode } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function InstancesCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showQRCode, setShowQRCode] = useState(false)
  const [selectedInstance, setSelectedInstance] = useState<any>(null)
  const [newInstance, setNewInstance] = useState({
    name: "",
    phone_number: ""
  })

  // Fetch subscription status
  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle()
      
      if (error) throw error
      return data
    },
    enabled: !!user?.id
  })

  // Fetch instances
  const { data: instances, isLoading } = useQuery({
    queryKey: ['instances', user?.id],
    queryFn: async () => {
      console.log('Fetching instances for user:', user?.id)
      const { data, error } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('user_id', user?.id)
      
      if (error) {
        console.error('Error fetching instances:', error)
        throw error
      }
      return data
    },
    enabled: !!user?.id
  })

  // Create instance mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      console.log('Creating new instance:', newInstance)
      const { data: response, error } = await supabase.functions.invoke('create-evolution-instance', {
        body: { 
          instanceName: newInstance.name,
          phoneNumber: newInstance.phone_number
        }
      })
      
      if (error) throw error
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] })
      setNewInstance({ name: "", phone_number: "" })
      toast({
        title: "Sucesso",
        description: "Instância criada com sucesso",
      })
    },
    onError: (error) => {
      console.error('Error creating instance:', error)
      toast({
        title: "Erro",
        description: "Não foi possível criar a instância. Tente novamente.",
        variant: "destructive",
      })
    }
  })

  // Connect instance mutation
  const connectMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      console.log('Connecting instance:', instanceId)
      const { data: response, error } = await supabase.functions.invoke('connect-evolution-instance', {
        body: { instanceId }
      })
      
      if (error) throw error
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['instances'] })
      if (data.qrCode) {
        setSelectedInstance(data)
        setShowQRCode(true)
      }
    },
    onError: (error) => {
      console.error('Error connecting instance:', error)
      toast({
        title: "Erro",
        description: "Não foi possível conectar a instância. Tente novamente.",
        variant: "destructive",
      })
    }
  })

  const handleAdd = () => {
    if (!subscription?.status === 'active') {
      toast({
        title: "Erro",
        description: "Você precisa ter uma assinatura ativa para criar instâncias.",
        variant: "destructive",
      })
      return
    }

    if (!newInstance.name || !newInstance.phone_number) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      })
      return
    }
    createMutation.mutate()
  }

  const handleConnect = (instanceId: string) => {
    if (!subscription?.status === 'active') {
      toast({
        title: "Erro",
        description: "Você precisa ter uma assinatura ativa para conectar instâncias.",
        variant: "destructive",
      })
      return
    }
    connectMutation.mutate(instanceId)
  }

  // Auto-refresh QR code every 30 seconds when dialog is open
  useQuery({
    queryKey: ['qrCode', selectedInstance?.id],
    queryFn: async () => {
      if (!selectedInstance?.id) return null
      const { data: response, error } = await supabase.functions.invoke('connect-evolution-instance', {
        body: { instanceId: selectedInstance.id }
      })
      if (error) throw error
      setSelectedInstance(response)
      return response
    },
    enabled: !!selectedInstance?.id && showQRCode,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Instâncias WhatsApp
        </CardTitle>
        <CardDescription>
          Gerencie suas instâncias do WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              {instances?.map((instance) => (
                <div 
                  key={instance.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{instance.name}</p>
                    <p className="text-sm text-muted-foreground">{instance.phone_number}</p>
                    <p className="text-sm text-muted-foreground">Status: {instance.connection_status}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleConnect(instance.id)}
                    disabled={instance.connection_status === 'connected'}
                  >
                    {instance.connection_status === 'connected' ? (
                      'Conectado'
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Conectar
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">Adicionar Nova Instância</h4>
              <div className="space-y-2">
                <Input
                  placeholder="Nome da Instância"
                  value={newInstance.name}
                  onChange={(e) => setNewInstance(prev => ({ ...prev, name: e.target.value }))}
                />
                <Input
                  placeholder="Número do WhatsApp (com DDD do país)"
                  value={newInstance.phone_number}
                  onChange={(e) => setNewInstance(prev => ({ ...prev, phone_number: e.target.value }))}
                />
                <Button 
                  onClick={handleAdd}
                  disabled={createMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Instância
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conecte seu WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4">
            {selectedInstance?.qrCode ? (
              <>
                <img 
                  src={`data:image/png;base64,${selectedInstance.qrCode}`} 
                  alt="QR Code" 
                  className="w-64 h-64"
                />
                <p className="text-sm text-muted-foreground text-center">
                  Escaneie o QR Code com seu WhatsApp para conectar.<br/>
                  O código será atualizado automaticamente a cada 30 segundos.
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center w-64 h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
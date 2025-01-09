import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Loader2 } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth/AuthContext"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { InstanceListItem } from "./instance-components/InstanceListItem"
import { NewInstanceForm } from "./instance-components/NewInstanceForm"
import { QRCodeDialog } from "./instance-components/QRCodeDialog"
import { InstanceSlotCard } from "./instance-components/InstanceSlotCard"
import { InstancePromptDialog } from "./instance-components/InstancePromptDialog"

export function InstancesCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showQRCode, setShowQRCode] = useState(false)
  const [selectedInstance, setSelectedInstance] = useState<any>(null)
  const [showNewInstanceForm, setShowNewInstanceForm] = useState(false)
  const [showPromptDialog, setShowPromptDialog] = useState(false)
  const [newInstance, setNewInstance] = useState({
    name: "",
    phone_number: ""
  })

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
      return data || []
    },
    enabled: !!user?.id
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      console.log('Creating new instance:', newInstance)
      const { data: response, error } = await supabase.functions.invoke('create-evolution-instance', {
        body: { 
          instanceName: newInstance.name
        }
      })
      
      if (error) throw error
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] })
      setNewInstance({ name: "", phone_number: "" })
      setShowNewInstanceForm(false)
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
      console.log('Connect response:', response)
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
    if (!subscription || subscription.status !== 'active') {
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
    if (!subscription || subscription.status !== 'active') {
      toast({
        title: "Erro",
        description: "Você precisa ter uma assinatura ativa para conectar instâncias.",
        variant: "destructive",
      })
      return
    }
    connectMutation.mutate(instanceId)
  }

  const getInstanceLimit = () => {
    if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trial')) return 0
    return subscription.plan_id?.includes('professional') ? 3 : 1
  }

  const instanceLimit = getInstanceLimit()
  const usedSlots = instances?.length || 0
  const availableSlots = Math.max(0, instanceLimit - usedSlots)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Instâncias WhatsApp
        </CardTitle>
        <CardDescription>
          Gerencie suas instâncias do WhatsApp ({usedSlots}/{instanceLimit} em uso)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {(subscription?.status === 'active' || subscription?.status === 'trial') && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {instances?.map((instance) => (
                  <InstanceSlotCard
                    key={instance.id}
                    isUsed={true}
                    instance={instance}
                    onClick={() => {}}
                    onConfigurePrompt={() => {
                      setSelectedInstance(instance)
                      setShowPromptDialog(true)
                    }}
                  />
                ))}
                {Array.from({ length: availableSlots }).map((_, index) => (
                  <InstanceSlotCard
                    key={`empty-${index}`}
                    isUsed={false}
                    onClick={() => setShowNewInstanceForm(true)}
                  />
                ))}
              </div>
            )}
            
            {showNewInstanceForm && (
              <NewInstanceForm
                newInstance={newInstance}
                onChange={(field, value) => setNewInstance(prev => ({ ...prev, [field]: value }))}
                onAdd={handleAdd}
                isLoading={createMutation.isPending}
                onCancel={() => setShowNewInstanceForm(false)}
              />
            )}
          </div>
        )}
      </CardContent>

      <QRCodeDialog
        open={showQRCode}
        onOpenChange={setShowQRCode}
        qrCode={selectedInstance?.qrCode}
      />

      <InstancePromptDialog
        open={showPromptDialog}
        onOpenChange={setShowPromptDialog}
        instanceId={selectedInstance?.id}
        currentPrompt={selectedInstance?.system_prompt}
      />
    </Card>
  )
}

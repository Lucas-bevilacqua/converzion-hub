import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth/AuthContext"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { InstanceSlotCard } from "./instance-components/InstanceSlotCard"
import { NewInstanceForm } from "./instance-components/NewInstanceForm"
import { InstancePromptDialog } from "./instance-components/InstancePromptDialog"
import { useInstanceQueries } from "./instance-components/useInstanceQueries"
import { useInstanceMutations } from "./instance-components/InstanceMutations"

export function InstancesCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [selectedInstance, setSelectedInstance] = useState<any>(null)
  const [showNewInstanceForm, setShowNewInstanceForm] = useState(false)
  const [showPromptDialog, setShowPromptDialog] = useState(false)
  const [newInstance, setNewInstance] = useState({
    name: "",
    phone_number: ""
  })

  const { subscription, instances, isLoading } = useInstanceQueries(user?.id)
  const { createMutation, connectMutation, disconnectMutation } = useInstanceMutations()

  const handleAdd = () => {
    if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trial')) {
      toast({
        title: "Erro",
        description: "Você precisa ter uma assinatura ativa ou trial para criar instâncias.",
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
    
    console.log('Criando nova instância:', newInstance)
    createMutation.mutate(newInstance)
    setShowNewInstanceForm(false)
    setNewInstance({ name: "", phone_number: "" })
  }

  const handleConnect = (instanceId: string) => {
    if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trial')) {
      toast({
        title: "Erro",
        description: "Você precisa ter uma assinatura ativa ou trial para conectar instâncias.",
        variant: "destructive",
      })
      return
    }
    console.log('Conectando instância:', instanceId)
    connectMutation.mutate(instanceId)
  }

  const handleDisconnect = (instanceId: string) => {
    if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trial')) {
      toast({
        title: "Erro",
        description: "Você precisa ter uma assinatura ativa ou trial para desconectar instâncias.",
        variant: "destructive",
      })
      return
    }
    console.log('Desconectando instância:', instanceId)
    disconnectMutation.mutate(instanceId)
  }

  const getInstanceLimit = () => {
    console.log('Verificando limite de instâncias:', {
      status: subscription?.status,
      plano: subscription?.plan_id,
      planoCompleto: subscription
    })
    
    if (!subscription) {
      console.log('Nenhuma assinatura encontrada')
      return 0
    }
    
    if (subscription.status === 'trial' || subscription.status === 'active') {
      // Verifica se o plano é starter (price_1QbuUvKkjJ7tububiklS9tAc)
      const starterPriceId = 'price_1QbuUvKkjJ7tububiklS9tAc'
      const isStarter = subscription.plan_id === starterPriceId
      const limit = isStarter ? 1 : 3
      console.log(`Limite de instâncias:`, {
        planId: subscription.plan_id,
        isStarter,
        starterPriceId,
        limit
      })
      return limit
    }
    
    console.log('Assinatura inativa')
    return 0
  }

  const instanceLimit = getInstanceLimit()
  const usedSlots = instances?.length || 0
  const availableSlots = Math.max(0, instanceLimit - usedSlots)
  const connectedInstances = instances?.filter(instance => instance.connection_status === 'connected').length || 0

  console.log('Estado atual das instâncias:', {
    limite: instanceLimit,
    usadas: usedSlots,
    disponíveis: availableSlots,
    conectadas: connectedInstances,
    subscription: subscription
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Números do WhatsApp
        </CardTitle>
        <CardDescription>
          Gerencie seus números do WhatsApp ({connectedInstances}/{usedSlots} em uso)
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
                    onClick={() => handleConnect(instance.id)}
                    onDisconnect={() => handleDisconnect(instance.id)}
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

      <InstancePromptDialog
        open={showPromptDialog}
        onOpenChange={setShowPromptDialog}
        instanceId={selectedInstance?.id}
        currentPrompt={selectedInstance?.system_prompt}
      />
    </Card>
  )
}
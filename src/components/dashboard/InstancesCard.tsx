import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth/AuthContext"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { InstanceSlotCard } from "./instance-components/InstanceSlotCard"
import { NewInstanceForm } from "./instance-components/NewInstanceForm"
import { QRCodeDialog } from "./instance-components/QRCodeDialog"
import { InstancePromptDialog } from "./instance-components/InstancePromptDialog"
import { useInstanceQueries } from "./instance-components/useInstanceQueries"
import { useInstanceMutations } from "./instance-components/InstanceMutations"

export function InstancesCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [showQRCode, setShowQRCode] = useState(false)
  const [selectedInstance, setSelectedInstance] = useState<any>(null)
  const [showNewInstanceForm, setShowNewInstanceForm] = useState(false)
  const [showPromptDialog, setShowPromptDialog] = useState(false)
  const [newInstance, setNewInstance] = useState({
    name: "",
    phone_number: ""
  })

  const { subscription, instances, isLoading } = useInstanceQueries(user?.id)
  const { createMutation, connectMutation } = useInstanceMutations()

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
                    onClick={() => handleConnect(instance.id)}
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
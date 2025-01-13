import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth/AuthContext"
import { useState } from "react"
import { InstanceSlotCard } from "./instance-components/InstanceSlotCard"
import { NewInstanceForm } from "./instance-components/NewInstanceForm"
import { useToast } from "@/components/ui/use-toast"
import type { EvolutionInstance } from "@/integrations/supabase/database-types/evolution-instances"

export function InstancesCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [showNewInstanceForm, setShowNewInstanceForm] = useState(false)
  const [newInstance, setNewInstance] = useState({
    name: "",
    phone_number: "",
  })
  const [isCreating, setIsCreating] = useState(false)

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!user?.id
  })

  const { data: instances = [], refetch: refetchInstances } = useQuery({
    queryKey: ['instances', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('user_id', user?.id)

      if (error) throw error
      return data as EvolutionInstance[]
    },
    enabled: !!user?.id
  })

  const handleNewInstance = () => {
    console.log('Abrindo formulário de nova instância')
    setShowNewInstanceForm(true)
  }

  const handleInstanceFormChange = (field: string, value: string) => {
    setNewInstance(prev => ({ ...prev, [field]: value }))
  }

  const handleAddInstance = async () => {
    if (!user) return

    try {
      setIsCreating(true)
      console.log('Criando nova instância:', newInstance)

      const { data: instanceData, error: instanceError } = await supabase.functions.invoke(
        'create-evolution-instance',
        {
          body: {
            name: newInstance.name,
            phone_number: newInstance.phone_number,
            userId: user.id
          }
        }
      )

      if (instanceError) throw instanceError

      console.log('Instância criada com sucesso:', instanceData)
      
      await refetchInstances()
      setShowNewInstanceForm(false)
      setNewInstance({ name: "", phone_number: "" })
      
      toast({
        title: "Sucesso",
        description: "Número adicionado com sucesso.",
      })
    } catch (error) {
      console.error('Erro ao criar instância:', error)
      toast({
        title: "Erro",
        description: "Falha ao adicionar número. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDisconnectInstance = async (instanceId: string) => {
    try {
      console.log('Desconectando instância:', instanceId)
      const { error } = await supabase.functions.invoke('disconnect-evolution-instance', {
        body: { instanceId }
      })

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Número desconectado com sucesso.",
      })

      refetchInstances()
    } catch (error) {
      console.error('Erro ao desconectar instância:', error)
      toast({
        title: "Erro",
        description: "Falha ao desconectar número. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  const instanceLimit = subscription?.plan_id?.includes('professional') ? 3 : 1
  const availableSlots = Array(instanceLimit).fill(null)
  
  console.log('Estado atual das instâncias:', {
    limite: instanceLimit,
    usadas: instances.length,
    disponíveis: instanceLimit - instances.length,
    conectadas: instances.filter(i => i.connection_status === 'connected').length,
    subscription
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          Números do WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showNewInstanceForm ? (
          <NewInstanceForm
            newInstance={newInstance}
            onChange={handleInstanceFormChange}
            onAdd={handleAddInstance}
            onCancel={() => {
              setShowNewInstanceForm(false)
              setNewInstance({ name: "", phone_number: "" })
            }}
            isLoading={isCreating}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableSlots.map((_, index) => {
              const instance = instances[index]
              return (
                <InstanceSlotCard
                  key={instance?.id || index}
                  isUsed={!!instance}
                  instance={instance}
                  onClick={handleNewInstance}
                  onDisconnect={instance ? () => handleDisconnectInstance(instance.id) : undefined}
                />
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
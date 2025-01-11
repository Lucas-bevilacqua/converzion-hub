import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MessageSquare, QrCode, Settings, LogOut } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"

interface InstanceSlotCardProps {
  isUsed: boolean
  instance?: any
  onClick?: () => void
  onDisconnect?: () => void
  onConfigurePrompt?: () => void
}

export function InstanceSlotCard({ 
  isUsed, 
  instance, 
  onClick, 
  onDisconnect,
  onConfigurePrompt 
}: InstanceSlotCardProps) {
  const { toast } = useToast()

  // Query para verificar o estado da instância
  const { data: stateData } = useQuery({
    queryKey: ['instanceState', instance?.id],
    queryFn: async () => {
      if (!instance?.id) return null
      
      console.log('Checking state for instance:', instance.id)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          console.log('No active session found')
          return { state: 'disconnected' }
        }

        const { data, error } = await supabase.functions.invoke('check-instance-state', {
          body: { instanceId: instance.id }
        })
        
        if (error) {
          // Check if it's a subscription error
          const errorBody = error.message && JSON.parse(error.message)
          if (errorBody?.code === 'subscription_required') {
            console.log('No active subscription found')
            toast({
              title: "Subscription Required",
              description: "You need an active subscription to use this feature.",
              variant: "destructive",
            })
            return { state: 'disconnected' }
          }
          
          console.error('Error checking instance state:', error)
          toast({
            title: "Error",
            description: "Failed to check instance state. Please try again.",
            variant: "destructive",
          })
          return { state: 'error' }
        }
        return data
      } catch (error) {
        console.error('Error in state check:', error)
        return { state: 'error' }
      }
    },
    enabled: !!instance?.id,
    refetchInterval: 5000,
    retry: false
  })

  const isConnected = stateData?.state === 'connected'

  if (!isUsed) {
    return (
      <Card className="flex items-center justify-center p-6 cursor-pointer hover:bg-accent/50 transition-colors" onClick={onClick}>
        <CardContent className="flex flex-col items-center gap-2 p-0">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium">Adicionar Instância</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <CardContent className="space-y-4 p-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{instance.name}</p>
              <p className="text-sm text-muted-foreground">{instance.phone_number}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onConfigurePrompt}
            title="Configurar Prompt"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={onDisconnect}
            >
              <LogOut className="h-4 w-4" />
              Desconectar
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={onClick}
            >
              <QrCode className="h-4 w-4" />
              Conectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
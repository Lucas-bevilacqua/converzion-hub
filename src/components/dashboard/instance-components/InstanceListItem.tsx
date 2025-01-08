import { Button } from "@/components/ui/button"
import { QrCode, MessageSquare, LogOut } from "lucide-react"
import { Database } from "@/integrations/supabase/types"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"

type Instance = Database['public']['Tables']['evolution_instances']['Row']

interface InstanceListItemProps {
  instance: Instance
  onConnect: (instanceId: string) => void
}

export function InstanceListItem({ instance, onConnect }: InstanceListItemProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Poll for instance state every 5 seconds
  const { data: stateData } = useQuery({
    queryKey: ['instanceState', instance.id],
    queryFn: async () => {
      console.log('Checking state for instance:', instance.id)
      try {
        const { data, error } = await supabase.functions.invoke('check-instance-state', {
          body: { instanceId: instance.id }
        })
        
        if (error) {
          console.error('Error checking instance state:', error)
          toast({
            title: "Error",
            description: "Failed to check instance state. Please try again.",
            variant: "destructive",
          })
          throw error
        }
        return data
      } catch (error) {
        console.error('Error in state check:', error)
        return null
      }
    },
    refetchInterval: 5000,
    enabled: !!instance.id,
    retry: false
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      console.log('Disconnecting instance:', instance.id)
      const { data, error } = await supabase.functions.invoke('disconnect-evolution-instance', {
        body: { instanceId: instance.id }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] })
      toast({
        title: "Success",
        description: "Instance disconnected successfully",
      })
    },
    onError: (error) => {
      console.error('Error disconnecting instance:', error)
      toast({
        title: "Error",
        description: "Failed to disconnect instance. Please try again.",
        variant: "destructive",
      })
    }
  })

  const connectionStatus = stateData?.state || instance.connection_status

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">{instance.name}</p>
          <p className="text-sm text-muted-foreground">{instance.phone_number}</p>
          <p className="text-sm text-muted-foreground">
            Status: {connectionStatus || 'Unknown'}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {connectionStatus === 'connected' ? (
          <Button
            variant="destructive"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => onConnect(instance.id)}
            className="min-w-[120px]"
          >
            <QrCode className="mr-2 h-4 w-4" />
            Connect
          </Button>
        )}
      </div>
    </div>
  )
}
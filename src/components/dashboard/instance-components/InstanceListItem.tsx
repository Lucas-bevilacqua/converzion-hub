import { Button } from "@/components/ui/button"
import { QrCode, MessageSquare } from "lucide-react"
import { Database } from "@/integrations/supabase/types"
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

type Instance = Database['public']['Tables']['evolution_instances']['Row']

interface InstanceListItemProps {
  instance: Instance
  onConnect: (instanceId: string) => void
}

export function InstanceListItem({ instance, onConnect }: InstanceListItemProps) {
  // Poll for instance state every 5 seconds
  const { data: stateData } = useQuery({
    queryKey: ['instanceState', instance.id],
    queryFn: async () => {
      console.log('Checking state for instance:', instance.id)
      const { data, error } = await supabase.functions.invoke('check-instance-state', {
        body: { instanceId: instance.id }
      })
      
      if (error) throw error
      return data
    },
    refetchInterval: 5000,
    enabled: !!instance.id
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
      <Button
        variant="outline"
        onClick={() => onConnect(instance.id)}
        disabled={connectionStatus === 'connected'}
        className="min-w-[120px]"
      >
        {connectionStatus === 'connected' ? (
          'Connected'
        ) : (
          <>
            <QrCode className="mr-2 h-4 w-4" />
            Connect
          </>
        )}
      </Button>
    </div>
  )
}
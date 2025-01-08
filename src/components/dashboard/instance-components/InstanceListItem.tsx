import { Button } from "@/components/ui/button"
import { QrCode } from "lucide-react"
import { Database } from "@/integrations/supabase/types"

type Instance = Database['public']['Tables']['evolution_instances']['Row']

interface InstanceListItemProps {
  instance: Instance
  onConnect: (instanceId: string) => void
}

export function InstanceListItem({ instance, onConnect }: InstanceListItemProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div>
        <p className="font-medium">{instance.name}</p>
        <p className="text-sm text-muted-foreground">{instance.phone_number}</p>
        <p className="text-sm text-muted-foreground">
          Status: {instance.connection_status}
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => onConnect(instance.id)}
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
  )
}
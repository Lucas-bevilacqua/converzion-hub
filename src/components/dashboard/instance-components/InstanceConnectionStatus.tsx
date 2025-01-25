import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import type { EvolutionInstance } from "@/integrations/supabase/database-types/evolution-instances"

interface InstanceConnectionStatusProps {
  instance: EvolutionInstance
  stateData: any
  isLoading: boolean
}

export function InstanceConnectionStatus({ 
  instance,
  stateData,
  isLoading 
}: InstanceConnectionStatusProps) {
  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }

  const isConnected = instance?.connection_status === 'connected'

  return (
    <Badge 
      variant="secondary"
      className={`${isConnected ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
    >
      {isConnected ? 'Conectado' : 'Desconectado'}
    </Badge>
  )
}
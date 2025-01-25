import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { InstanceStatusProps } from "@/types/instance-status";

export function InstanceConnectionStatus({ instance, stateData, isLoading }: InstanceStatusProps) {
  console.log('Status atual da conexão:', {
    stateData,
    instanceStatus: instance?.connection_status,
    instanceState: instance?.status
  });

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  const isConnected = 
    instance?.connection_status === 'connected' ||
    stateData?.state === 'connected' ||
    stateData?.instance?.instance?.state === 'open';

  return (
    <Badge 
      variant={isConnected ? "success" : "secondary"}
      className="h-5 px-1.5"
    >
      {isConnected ? "Conectado" : "Desconectado"}
    </Badge>
  );
}
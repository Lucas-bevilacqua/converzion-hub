import { Loader2 } from "lucide-react"
import type { InstanceStatusProps } from "@/types/instance-types"

export function InstanceStatus({ isConnected, isLoading }: InstanceStatusProps) {
  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }
  
  return (
    <div 
      className={`h-2 w-2 rounded-full ${
        isConnected ? 'bg-green-500' : 'bg-red-500'
      }`} 
    />
  )
}
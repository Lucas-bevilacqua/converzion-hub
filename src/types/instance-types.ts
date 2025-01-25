import type { EvolutionInstance } from "@/integrations/supabase/database-types/evolution-instances"

export interface InstanceState {
  state: string
  connected: boolean
  instance: any
  updateResult?: any
  verificationResult?: any
  timestamp: string
}

export interface InstanceStatusProps {
  isConnected: boolean
  isLoading: boolean
}

export interface InstanceActionsProps {
  instance: EvolutionInstance
  isConnected: boolean
  isLoading: boolean
  onConnect: () => void
  onDisconnect?: () => void
  onSettings: () => void
  onQRCode: () => void
}
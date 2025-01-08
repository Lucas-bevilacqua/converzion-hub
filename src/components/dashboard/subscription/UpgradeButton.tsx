import { Button } from "@/components/ui/button"
import { type Subscription } from "@/integrations/supabase/database-types/subscriptions"

interface UpgradeButtonProps {
  subscription: Subscription | null
  onUpgrade: () => void
}

export function UpgradeButton({ subscription, onUpgrade }: UpgradeButtonProps) {
  return (
    <Button 
      onClick={onUpgrade} 
      className="w-full"
      variant={subscription?.status === 'active' ? 'outline' : 'default'}
    >
      {subscription?.status === 'active' ? 'Fazer Upgrade' : 'Assinar Agora'}
    </Button>
  )
}
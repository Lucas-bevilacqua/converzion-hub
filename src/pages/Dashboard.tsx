import { useState } from "react"
import { useAuth } from "@/contexts/auth/AuthContext"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { SubscriptionCard } from "@/components/dashboard/SubscriptionCard"
import { InstancesCard } from "@/components/dashboard/InstancesCard"
import { AISettingsCard } from "@/components/dashboard/AISettingsCard"
import { Loader2 } from "lucide-react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"

export default function Dashboard() {
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState("overview")

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      console.log('Fetching subscription for dashboard:', user?.id)
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle()
      
      if (error) {
        console.error('Error fetching subscription:', error)
        throw error
      }
      
      console.log('Subscription data:', data)
      return data
    },
    enabled: !!user?.id,
  })

  if (isLoadingSubscription) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return (
          <div className="space-y-6">
            <SubscriptionCard />
            {(subscription?.status === 'active' || subscription?.status === 'trial') && (
              <>
                <InstancesCard />
                <AISettingsCard />
              </>
            )}
          </div>
        )
      case "instances":
        return <InstancesCard />
      case "ai-settings":
        return <AISettingsCard />
      case "subscription":
        return <SubscriptionCard />
      default:
        return null
    }
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
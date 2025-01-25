import { useState } from "react"
import { useAuth } from "@/contexts/auth/AuthContext"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { SubscriptionCard } from "@/components/dashboard/SubscriptionCard"
import { DashboardOverview } from "@/components/dashboard/overview/DashboardOverview"
import { Loader2, Menu } from "lucide-react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { TrialAlert } from "@/components/dashboard/overview/TrialAlert"
import { InstancesCard } from "@/components/dashboard/InstancesCard"

export default function Dashboard() {
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState("overview")
  const isMobile = useIsMobile()

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      console.log('Fetching subscription for dashboard:', user?.id)
      try {
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
      } catch (error) {
        console.error('Error in subscription query:', error)
        throw error
      }
    },
    enabled: !!user?.id,
    retry: 3,
    staleTime: 1000 * 60 * 5,
  })

  const { data: instances } = useQuery({
    queryKey: ['instances', user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('evolution_instances')
          .select('*')
          .eq('user_id', user?.id)
        
        if (error) throw error
        return data
      } catch (error) {
        console.error('Error fetching instances:', error)
        throw error
      }
    },
    enabled: !!user?.id
  })

  if (isLoadingSubscription) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const hasAccess = subscription?.status === 'trial' || subscription?.status === 'active'
  console.log('Access check - Status:', subscription?.status, 'Has access:', hasAccess)

  const renderContent = () => {
    if (!hasAccess) {
      console.log('No access, showing subscription card only')
      return <SubscriptionCard />
    }

    console.log('Has access, showing content for section:', activeSection)
    switch (activeSection) {
      case "overview":
        return (
          <div className="space-y-6">
            {subscription?.status === 'trial' && subscription.trial_ends_at && (
              <TrialAlert 
                trialEndsAt={subscription.trial_ends_at}
                trialPlanName={subscription.plan_id === 'professional' ? 'Professional' : 'Starter'}
              />
            )}
            <DashboardOverview 
              subscription={subscription} 
              instances={instances || []} 
            />
          </div>
        )
      case "instances":
        return <InstancesCard />
      case "subscription":
        return <SubscriptionCard />
      default:
        return null
    }
  }

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background to-background/95">
        <DashboardSidebar 
          onSectionChange={setActiveSection} 
          activeSection={activeSection} 
        />
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                {isMobile && (
                  <SidebarTrigger>
                    <Menu className="h-6 w-6 text-foreground/80 hover:text-foreground transition-colors" />
                  </SidebarTrigger>
                )}
                <h1 className="text-2xl font-semibold text-foreground/90">
                  {activeSection === "overview" && "Visão Geral"}
                  {activeSection === "instances" && "Instâncias"}
                  {activeSection === "subscription" && "Assinatura"}
                </h1>
              </div>
            </div>
            <div className="max-w-6xl mx-auto">
              <div className="rounded-lg bg-white/50 backdrop-blur-sm shadow-sm border border-border/50">
                {renderContent()}
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
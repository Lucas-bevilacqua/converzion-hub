import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionCard } from "@/components/dashboard/SubscriptionCard";
import { AISettingsCard } from "@/components/dashboard/AISettingsCard";
import { InstancesCard } from "@/components/dashboard/InstancesCard";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch subscription status
  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      console.log('Fetching subscription for dashboard:', user?.id);
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching subscription:', error);
        throw error;
      }
      
      console.log('Subscription data:', data);
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user) {
      console.log('No user found, redirecting to login');
      navigate("/login");
    }
  }, [user, navigate]);

  if (isLoadingSubscription) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        
        <div className="grid gap-6 md:grid-cols-2">
          <SubscriptionCard />
          {subscription?.status === 'active' && (
            <>
              <AISettingsCard />
              <div className="md:col-span-2">
                <InstancesCard />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
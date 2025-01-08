import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionCard } from "@/components/dashboard/SubscriptionCard";
import { AISettingsCard } from "@/components/dashboard/AISettingsCard";
import { InstancesCard } from "@/components/dashboard/InstancesCard";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Desconectado com sucesso",
        description: "Você foi desconectado da sua conta.",
      });
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        variant: "destructive",
        title: "Erro ao desconectar",
        description: "Ocorreu um erro ao tentar desconectar. Tente novamente.",
      });
    }
  };

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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button 
            variant="outline" 
            onClick={handleSignOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Desconectar
          </Button>
        </div>
        
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
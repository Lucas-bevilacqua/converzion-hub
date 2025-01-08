import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AdminUsersCard } from "@/components/admin/AdminUsersCard";
import { AdminSubscriptionsCard } from "@/components/admin/AdminSubscriptionsCard";
import { AdminInstancesCard } from "@/components/admin/AdminInstancesCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  useEffect(() => {
    if (!user) {
      navigate("/login");
    } else if (!isLoading && !profile?.is_admin) {
      navigate("/dashboard");
    }
  }, [user, navigate, profile, isLoading]);

  if (isLoading) {
    return <div className="min-h-screen bg-background pt-16">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-8">Painel Administrativo</h1>
        
        <div className="grid gap-6">
          <AdminUsersCard />
          <AdminSubscriptionsCard />
          <AdminInstancesCard />
        </div>
      </div>
    </div>
  );
}
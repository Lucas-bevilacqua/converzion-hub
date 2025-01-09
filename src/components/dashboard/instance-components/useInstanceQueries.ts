import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useInstanceQueries = (userId: string | undefined) => {
  const { data: subscription } = useQuery({
    queryKey: ['subscription', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId
  });

  const { data: instances, isLoading } = useQuery({
    queryKey: ['instances', userId],
    queryFn: async () => {
      console.log('Fetching instances for user:', userId);
      const { data, error } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching instances:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!userId
  });

  return {
    subscription,
    instances,
    isLoading
  };
};
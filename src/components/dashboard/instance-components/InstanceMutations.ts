import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useInstanceMutations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (newInstance: { name: string; phone_number: string }) => {
      console.log('Creating new instance:', newInstance);
      const { data: response, error } = await supabase.functions.invoke('create-evolution-instance', {
        body: { 
          instanceName: newInstance.name
        }
      });
      
      if (error) throw error;
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      toast({
        title: "Sucesso",
        description: "Instância criada com sucesso",
      });
    },
    onError: (error) => {
      console.error('Error creating instance:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a instância. Tente novamente.",
        variant: "destructive",
      });
    }
  });

  const connectMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      console.log('Connecting instance:', instanceId);
      const { data: response, error } = await supabase.functions.invoke('connect-evolution-instance', {
        body: { instanceId }
      });
      
      if (error) throw error;
      console.log('Connect response:', response);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    },
    onError: (error) => {
      console.error('Error connecting instance:', error);
      toast({
        title: "Erro",
        description: "Não foi possível conectar a instância. Tente novamente.",
        variant: "destructive",
      });
    }
  });

  return {
    createMutation,
    connectMutation
  };
};
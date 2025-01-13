import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/auth/AuthContext";

export const useInstanceMutations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const createMutation = useMutation({
    mutationFn: async (newInstance: { name: string; phone_number: string }) => {
      console.log('Criando nova instância:', newInstance);
      
      // Primeiro cria a instância
      const { data: instanceData, error: instanceError } = await supabase.functions.invoke('create-evolution-instance', {
        body: { 
          name: newInstance.name,
          phone_number: newInstance.phone_number,
          userId: user?.id
        }
      });
      
      if (instanceError) {
        console.error('Erro ao criar instância:', instanceError);
        throw instanceError;
      }

      console.log('Instância criada com sucesso:', instanceData);

      // Configura o webhook após criar a instância
      try {
        console.log('Configurando webhook para a instância:', newInstance.name);
        const { data: webhookResponse, error: webhookError } = await supabase.functions.invoke('configure-evolution-webhook', {
          body: { 
            instanceName: newInstance.name
          }
        });

        if (webhookError) {
          console.error('Erro ao configurar webhook:', webhookError);
          throw webhookError;
        }

        console.log('Webhook configurado com sucesso:', webhookResponse);
      } catch (webhookError) {
        console.error('Erro ao configurar webhook:', webhookError);
        // Não vamos lançar o erro aqui para não impedir a criação da instância
        toast({
          title: "Aviso",
          description: "Instância criada, mas houve um erro ao configurar o webhook. Tente reconectar a instância.",
          variant: "destructive",
        });
      }

      return instanceData;
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

  const disconnectMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      console.log('Disconnecting instance:', instanceId);
      const { data: response, error } = await supabase.functions.invoke('disconnect-evolution-instance', {
        body: { instanceId }
      });
      
      if (error) throw error;
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      queryClient.invalidateQueries({ queryKey: ['instanceStates'] });
      toast({
        title: "Sucesso",
        description: "Instância desconectada com sucesso",
      });
    },
    onError: (error) => {
      console.error('Error disconnecting instance:', error);
      toast({
        title: "Erro",
        description: "Não foi possível desconectar a instância. Tente novamente.",
        variant: "destructive",
      });
    }
  });

  return {
    createMutation,
    connectMutation,
    disconnectMutation
  };
};
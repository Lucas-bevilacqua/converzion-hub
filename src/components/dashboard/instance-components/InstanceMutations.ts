import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export const useInstanceMutations = () => {
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; phone_number: string }) => {
      console.log('Creating instance with data:', data)
      const response = await supabase.functions.invoke('create-evolution-instance', {
        body: {
          ...data,
          userId: (await supabase.auth.getSession()).data.session?.user.id
        }
      })

      if (response.error) {
        console.error('Error creating instance:', response.error)
        throw new Error(response.error.message || 'Failed to create instance')
      }

      return response.data
    }
  })

  const disconnectMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      console.log('Disconnecting instance:', instanceId)
      
      const { data, error } = await supabase.functions.invoke('disconnect-evolution-instance', {
        body: { instanceId }
      })

      if (error) {
        console.error('Error disconnecting instance:', error)
        throw error
      }

      // Delete chat messages after successful disconnect
      const { error: chatMessagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('instance_id', instanceId)

      if (chatMessagesError) {
        console.error('Error deleting chat messages:', chatMessagesError)
        throw chatMessagesError
      }

      return data
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      console.log('Deleting instance:', instanceId)
      
      // First disconnect the instance
      await disconnectMutation.mutateAsync(instanceId)
      
      // Then delete the instance from the database
      const { error } = await supabase
        .from('evolution_instances')
        .delete()
        .eq('id', instanceId)

      if (error) {
        console.error('Error deleting instance:', error)
        throw error
      }

      return true
    }
  })

  return {
    createMutation,
    disconnectMutation,
    deleteMutation
  }
}
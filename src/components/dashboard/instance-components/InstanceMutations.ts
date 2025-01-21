import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export const useInstanceMutations = () => {
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; phone_number: string }) => {
      console.log('Creating instance with data:', data)
      const response = await fetch('/functions/v1/create-evolution-instance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create instance')
      }

      return response.json()
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

  return {
    createMutation,
    disconnectMutation
  }
}
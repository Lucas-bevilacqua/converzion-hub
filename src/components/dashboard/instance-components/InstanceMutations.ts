import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export const useInstanceMutations = () => {
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; phone_number: string }) => {
      console.log('Creating instance with data:', data)

      // First check if an instance with this name already exists
      const { data: existingInstance, error: checkError } = await supabase
        .from('evolution_instances')
        .select('id, name')
        .eq('name', data.name)
        .single()

      if (existingInstance) {
        console.error('Instance with this name already exists:', existingInstance)
        throw new Error('Uma instância com este nome já existe. Por favor, escolha outro nome.')
      }

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows returned
        console.error('Error checking existing instance:', checkError)
        throw checkError
      }

      const response = await supabase.functions.invoke('create-evolution-instance', {
        body: {
          ...data,
          userId: (await supabase.auth.getSession()).data.session?.user.id
        }
      })

      if (response.error) {
        console.error('Error creating instance:', response.error)
        // Parse the error message to make it user friendly
        const errorBody = JSON.parse(response.error.message || '{}')
        if (errorBody.error && errorBody.error.includes('already in use')) {
          throw new Error('Uma instância com este nome já existe. Por favor, escolha outro nome.')
        }
        throw new Error(response.error.message || 'Falha ao criar instância')
      }

      return response.data
    }
  })

  const disconnectMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      console.log('Disconnecting instance:', instanceId)
      
      // First check if instance exists and is connected
      const { data: instance, error: instanceError } = await supabase
        .from('evolution_instances')
        .select('connection_status')
        .eq('id', instanceId)
        .single()

      if (instanceError) {
        console.error('Error checking instance status:', instanceError)
        throw instanceError
      }

      if (instance.connection_status !== 'connected') {
        console.log('Instance is already disconnected')
        throw new Error('Esta instância já está desconectada')
      }

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
      
      // First disconnect the instance if it's connected
      const { data: instance } = await supabase
        .from('evolution_instances')
        .select('connection_status')
        .eq('id', instanceId)
        .single()

      if (instance?.connection_status === 'connected') {
        try {
          await disconnectMutation.mutateAsync(instanceId)
        } catch (error) {
          console.log('Instance was already disconnected or disconnect failed:', error)
          // Continue with deletion even if disconnect fails
        }
      }
      
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
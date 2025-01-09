import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth/AuthContext"
import { isAfter } from "date-fns"

export const useSubscription = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      console.log('Fetching subscription for user:', user?.id)
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

        if (data?.status === 'trial' && data.trial_ends_at) {
          const trialEnded = isAfter(new Date(), new Date(data.trial_ends_at))
          
          if (trialEnded) {
            console.log('Trial period ended, updating status')
            const { error: updateError } = await supabase
              .from('subscriptions')
              .update({ status: null })
              .eq('id', data.id)
            
            if (updateError) {
              console.error('Error updating subscription status:', updateError)
            } else {
              return {
                ...data,
                status: null
              }
            }
          }
        }

        console.log('Subscription data:', data)
        return data
      } catch (error) {
        console.error('Error in subscription query:', error)
        throw error
      }
    },
    enabled: !!user?.id
  })
}
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isAfter } from 'https://esm.sh/date-fns@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting disconnect-trial-instances function')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all trial subscriptions that have ended
    const { data: expiredTrials, error: trialsError } = await supabaseClient
      .from('subscriptions')
      .select('user_id, trial_ends_at')
      .eq('status', 'trial')
      .not('trial_ends_at', 'is', null)

    if (trialsError) {
      console.error('Error fetching expired trials:', trialsError)
      throw trialsError
    }

    console.log('Found trials:', expiredTrials)

    const now = new Date()
    const expiredUserIds = expiredTrials
      .filter(trial => trial.trial_ends_at && isAfter(now, new Date(trial.trial_ends_at)))
      .map(trial => trial.user_id)

    console.log('Expired user IDs:', expiredUserIds)

    if (expiredUserIds.length === 0) {
      console.log('No expired trials found')
      return new Response(
        JSON.stringify({ message: 'No expired trials found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all instances for users with expired trials
    const { data: instances, error: instancesError } = await supabaseClient
      .from('evolution_instances')
      .select('*')
      .in('user_id', expiredUserIds)
      .eq('connection_status', 'connected')

    if (instancesError) {
      console.error('Error fetching instances:', instancesError)
      throw instancesError
    }

    console.log('Found instances to disconnect:', instances)

    // Disconnect each instance
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API configuration not found')
    }

    const disconnectionResults = await Promise.all(
      instances.map(async (instance) => {
        try {
          const baseUrl = evolutionApiUrl.replace(/\/+$/, '')
          const instanceName = encodeURIComponent(instance.name)
          const logoutUrl = `${baseUrl}/instance/logout/${instanceName}`
          
          console.log('Disconnecting instance:', instance.name)
          
          const evolutionResponse = await fetch(logoutUrl, {
            method: 'DELETE',
            headers: {
              'apikey': evolutionApiKey,
              'Content-Type': 'application/json'
            }
          })

          if (!evolutionResponse.ok) {
            const errorText = await evolutionResponse.text()
            console.error('Evolution API logout error for instance', instance.name, ':', errorText)
            return { instanceId: instance.id, success: false, error: errorText }
          }

          // Update instance status in database
          const { error: updateError } = await supabaseClient
            .from('evolution_instances')
            .update({
              connection_status: 'disconnected',
              qr_code: null,
              last_qr_update: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', instance.id)

          if (updateError) {
            console.error('Error updating instance status:', updateError)
            return { instanceId: instance.id, success: false, error: updateError.message }
          }

          return { instanceId: instance.id, success: true }
        } catch (error) {
          console.error('Error disconnecting instance:', instance.name, error)
          return { instanceId: instance.id, success: false, error: error.message }
        }
      })
    )

    // Update subscription status to null for expired trials
    const { error: updateSubError } = await supabaseClient
      .from('subscriptions')
      .update({ status: null })
      .in('user_id', expiredUserIds)

    if (updateSubError) {
      console.error('Error updating subscription status:', updateSubError)
    }

    console.log('Disconnection results:', disconnectionResults)

    return new Response(
      JSON.stringify({
        message: 'Processed expired trials',
        results: disconnectionResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in disconnect-trial-instances:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.cause || error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
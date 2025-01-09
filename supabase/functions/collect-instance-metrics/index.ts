import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')

    if (!supabaseUrl || !supabaseKey || !evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Missing environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get all active instances
    const { data: instances, error: instancesError } = await supabase
      .from('evolution_instances')
      .select('*')

    if (instancesError) {
      throw instancesError
    }

    console.log(`Found ${instances.length} instances to check`)

    for (const instance of instances) {
      try {
        // Get instance metrics from Evolution API
        const stateUrl = `${evolutionApiUrl}/instance/connectionState/${instance.name}`
        console.log(`Checking state for instance ${instance.name} at: ${stateUrl}`)

        const stateResponse = await fetch(stateUrl, {
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          }
        })

        if (!stateResponse.ok) {
          console.error(`Error getting state for instance ${instance.name}:`, await stateResponse.text())
          continue
        }

        const stateData = await stateResponse.json()
        
        // Calculate connection time (in minutes)
        const connectionTimeMinutes = stateData.instance?.state === 'open' ? 1 : 0

        // Get message count from Evolution API
        const messagesUrl = `${evolutionApiUrl}/message/list/${instance.name}`
        console.log(`Getting messages for instance ${instance.name} at: ${messagesUrl}`)

        const messagesResponse = await fetch(messagesUrl, {
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          }
        })

        if (!messagesResponse.ok) {
          console.error(`Error getting messages for instance ${instance.name}:`, await messagesResponse.text())
          continue
        }

        const messagesData = await messagesResponse.json()
        const messagesSent = messagesData.length || 0

        // Save metrics to database
        const { error: insertError } = await supabase
          .from('instance_metrics')
          .insert({
            instance_id: instance.id,
            user_id: instance.user_id,
            messages_sent: messagesSent,
            connection_time_minutes: connectionTimeMinutes
          })

        if (insertError) {
          console.error(`Error saving metrics for instance ${instance.name}:`, insertError)
        } else {
          console.log(`Successfully saved metrics for instance ${instance.name}`)
        }

      } catch (error) {
        console.error(`Error processing instance ${instance.name}:`, error)
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in collect-instance-metrics:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
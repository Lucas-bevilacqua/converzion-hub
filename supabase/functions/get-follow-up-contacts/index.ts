import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔄 Starting follow-up contacts processing')

    // Get active follow-ups with pending status
    const { data: followUps, error: followUpsError } = await supabase
      .from('follow_ups')
      .select(`
        *,
        instance:evolution_instances (
          id,
          connection_status
        )
      `)
      .eq('status', 'pending')
      .filter('settings->is_active', 'eq', true)

    if (followUpsError) {
      console.error('❌ Error fetching follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log('✅ Found follow-ups:', followUps)

    // Process each follow-up
    const results = await Promise.all(followUps.map(async (followUp) => {
      try {
        // Check if instance is connected (case-insensitive)
        const isConnected = followUp.instance?.connection_status?.toLowerCase() === 'connected'
        
        if (!isConnected) {
          console.log(`⚠️ Instance ${followUp.instance_id} not connected, skipping`)
          return {
            followUpId: followUp.id,
            status: 'skipped',
            reason: 'Instance not connected'
          }
        }

        // Update follow-up status to in_progress
        const { error: updateError } = await supabase
          .from('follow_ups')
          .update({ 
            status: 'in_progress',
            updated_at: new Date().toISOString()
          })
          .eq('id', followUp.id)

        if (updateError) {
          console.error(`❌ Error updating follow-up ${followUp.id}:`, updateError)
          throw updateError
        }

        // Get follow-up messages
        const { data: messages, error: messagesError } = await supabase
          .from('follow_up_messages')
          .select('*')
          .eq('follow_up_id', followUp.id)
          .order('delay_minutes', { ascending: true })

        if (messagesError) {
          console.error(`❌ Error fetching messages for follow-up ${followUp.id}:`, messagesError)
          throw messagesError
        }

        console.log(`✅ Processing follow-up ${followUp.id} with ${messages.length} messages`)

        return {
          followUpId: followUp.id,
          status: 'success',
          messages: messages
        }
      } catch (error) {
        console.error(`❌ Error processing follow-up ${followUp.id}:`, error)
        return {
          followUpId: followUp.id,
          status: 'error',
          error: error.message
        }
      }
    }))

    return new Response(
      JSON.stringify({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('❌ Error in follow-up contacts processing:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
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
    console.log('🔄 Starting follow-up contacts processing')
    const startTime = Date.now()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get active follow-ups that are pending or in_progress using a single query
    const { data: followUps, error: followUpsError } = await supabase
      .from('follow_ups')
      .select(`
        *,
        instance:evolution_instances (
          id,
          name,
          connection_status,
          user_id
        )
      `)
      .in('status', ['pending', 'in_progress'])
      .eq('settings->is_active', true)

    if (followUpsError) {
      console.error('❌ Error fetching follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log(`✅ Found ${followUps?.length || 0} follow-ups to process`)

    // Filter connected instances
    const activeFollowUps = followUps?.filter(followUp => {
      const isConnected = followUp.instance?.connection_status?.toLowerCase() === 'connected'
      console.log(`🔌 Instance ${followUp.instance_id} status: ${followUp.instance?.connection_status}`)
      return isConnected
    }) || []

    console.log(`✅ ${activeFollowUps.length} follow-ups have connected instances`)

    // Process each follow-up in parallel for better performance
    const results = await Promise.all(activeFollowUps.map(async (followUp) => {
      try {
        const processingStart = Date.now()
        
        // Get follow-up messages
        const { data: messages, error: messagesError } = await supabase
          .from('follow_up_messages')
          .select('*')
          .eq('follow_up_id', followUp.id)
          .order('delay_minutes', { ascending: true })

        if (messagesError) throw messagesError

        // Optimize contact fetching by using a single efficient query
        const { data: contacts, error: contactsError } = await supabase.rpc(
          'get_eligible_follow_up_contacts',
          { 
            p_instance_id: followUp.instance_id,
            p_follow_up_id: followUp.id,
            p_hours_threshold: 24
          }
        )

        if (contactsError) throw contactsError

        console.log(`✅ Found ${contacts?.length || 0} eligible contacts for follow-up ${followUp.id}`)

        // Batch insert new contacts if any found
        if (contacts && contacts.length > 0) {
          const { error: insertError } = await supabase
            .from('follow_up_contacts')
            .insert(contacts.map(contact => ({
              follow_up_id: followUp.id,
              phone: contact.telefoneclientes,
              status: 'pending',
              metadata: {
                contact_name: contact.nomeclientes,
                last_message_time: contact.last_message_time,
                instance_id: followUp.instance_id
              }
            })))

          if (insertError) throw insertError
        }

        // Update follow-up status if needed
        if (followUp.status === 'pending') {
          const { error: updateError } = await supabase
            .from('follow_ups')
            .update({ 
              status: 'in_progress',
              updated_at: new Date().toISOString()
            })
            .eq('id', followUp.id)

          if (updateError) throw updateError
        }

        const processingTime = Date.now() - processingStart
        console.log(`✅ Processed follow-up ${followUp.id} in ${processingTime}ms`)

        return {
          followUpId: followUp.id,
          status: 'success',
          messages: messages?.length || 0,
          newContacts: contacts?.length || 0,
          processingTime
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

    const totalTime = Date.now() - startTime
    console.log(`✅ Completed processing in ${totalTime}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        data: results,
        processingTime: totalTime,
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
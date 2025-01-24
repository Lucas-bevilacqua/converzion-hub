import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface FollowUpContact {
  id: string
  phone: string
  status: string
  follow_up_id: string
  created_at: string
  updated_at: string
  sent_at: string | null
  reply_at: string | null
  metadata: Record<string, any>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔄 Starting follow-up contacts processing')

    // Get active follow-ups with connected instances
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
      .is('completed_at', null)

    if (followUpsError) {
      console.error('❌ Error fetching follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log(`✅ Found ${followUps?.length || 0} pending follow-ups`)

    // Filter follow-ups with connected instances
    const activeFollowUps = followUps?.filter(
      (followUp) => 
        followUp.instance?.connection_status?.toLowerCase() === 'connected' &&
        followUp.settings?.is_active === true
    )

    console.log(`✅ Found ${activeFollowUps?.length || 0} active follow-ups with connected instances`)

    if (!activeFollowUps?.length) {
      return new Response(
        JSON.stringify({ 
          message: 'No active follow-ups found',
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Process each follow-up
    const results = await Promise.all(
      activeFollowUps.map(async (followUp) => {
        console.log(`🔄 Processing follow-up ${followUp.id}`)

        try {
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

          // Get contacts that haven't been processed
          const { data: contacts, error: contactsError } = await supabase
            .from('follow_up_contacts')
            .select('*')
            .eq('follow_up_id', followUp.id)
            .eq('status', 'pending')
            .is('sent_at', null)

          if (contactsError) {
            console.error(`❌ Error fetching contacts for follow-up ${followUp.id}:`, contactsError)
            throw contactsError
          }

          console.log(`✅ Found ${contacts?.length || 0} pending contacts for follow-up ${followUp.id}`)

          // Update follow-up status
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

          return {
            followUpId: followUp.id,
            messagesCount: messages?.length || 0,
            contactsCount: contacts?.length || 0,
            status: 'processed'
          }
        } catch (error) {
          console.error(`❌ Error processing follow-up ${followUp.id}:`, error)
          return {
            followUpId: followUp.id,
            error: error.message,
            status: 'failed'
          }
        }
      })
    )

    return new Response(
      JSON.stringify({
        results,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
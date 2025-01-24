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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get active follow-ups with pending status and is_active true
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

    // Filter out follow-ups where instance is not connected
    const activeFollowUps = followUps.filter(followUp => 
      followUp.instance?.connection_status?.toLowerCase() === 'connected'
    )

    console.log('✅ Active follow-ups after filtering:', activeFollowUps)

    // Process each follow-up
    const results = await Promise.all(activeFollowUps.map(async (followUp) => {
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

        // Get existing contacts to avoid duplicates
        const { data: existingContacts, error: contactsError } = await supabase
          .from('follow_up_contacts')
          .select('phone')
          .eq('follow_up_id', followUp.id)

        if (contactsError) {
          console.error(`❌ Error fetching existing contacts for follow-up ${followUp.id}:`, contactsError)
          throw contactsError
        }

        // Get potential contacts from users_clientes
        const { data: contacts, error: usersError } = await supabase
          .from('users_clientes')
          .select('*')
          .eq('nomedaempresa', followUp.instance_id)
          .not('telefoneclientes', 'in', existingContacts.map(c => c.phone))

        if (usersError) {
          console.error(`❌ Error fetching users for follow-up ${followUp.id}:`, usersError)
          throw usersError
        }

        console.log(`✅ Processing follow-up ${followUp.id} with ${messages.length} messages and ${contacts.length} new contacts`)

        // Create follow-up contacts
        if (contacts.length > 0) {
          const { error: insertError } = await supabase
            .from('follow_up_contacts')
            .insert(contacts.map(contact => ({
              follow_up_id: followUp.id,
              phone: contact.telefoneclientes,
              status: 'pending',
              metadata: {
                contact_name: contact.nomeclientes,
                last_message_time: contact.last_message_time
              }
            })))

          if (insertError) {
            console.error(`❌ Error inserting contacts for follow-up ${followUp.id}:`, insertError)
            throw insertError
          }
        }

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
          status: 'success',
          messages: messages,
          newContacts: contacts.length
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
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(id, name, user_id, connection_status, phone_number)
      `)
      .eq('is_active', true)
      .limit(1)

    if (followUpsError) throw followUpsError
    if (!followUps?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active follow-ups' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const followUp = followUps[0]
    if (!followUp.instance || followUp.instance.connection_status !== 'connected') {
      return new Response(
        JSON.stringify({ success: true, message: 'Instance not connected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: contacts, error: contactsError } = await supabaseClient
      .from('Users_clientes')
      .select('*')
      .eq('NomeDaEmpresa', followUp.instance_id)
      .is('ConversationId', null)
      .order('created_at', { ascending: true })
      .limit(1)

    if (contactsError) throw contactsError
    if (!contacts?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'No contacts for follow-up' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const contact = contacts[0]
    const manualMessages = Array.isArray(followUp.manual_messages) ? followUp.manual_messages : []
    
    if (!manualMessages.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'No messages configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const firstMessage = manualMessages[0]
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
    
    const evolutionResponse = await fetch(
      `${evolutionApiUrl}/message/sendText/${followUp.instance.name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
        },
        body: JSON.stringify({
          number: contact.TelefoneClientes,
          text: firstMessage.message
        })
      }
    )

    if (!evolutionResponse.ok) {
      const error = await evolutionResponse.text()
      throw new Error(error)
    }

    const evolutionData = await evolutionResponse.json()

    await supabaseClient
      .from('Users_clientes')
      .update({
        ConversationId: 'follow-up-sent-0',
        last_message_time: new Date().toISOString()
      })
      .eq('id', contact.id)

    await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: followUp.instance_id,
        user_id: followUp.instance.user_id,
        sender_type: 'follow_up',
        content: firstMessage.message,
        whatsapp_message_id: evolutionData.key?.id
      })

    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'success'
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message sent successfully',
        contact: contact.TelefoneClientes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'error',
      })

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
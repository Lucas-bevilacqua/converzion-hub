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
    console.log('Edge function started - get-follow-up-contacts')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Supabase client created')

    // Log cron execution
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'started'
      })

    // Buscar follow-ups ativos
    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(id, name, user_id, connection_status, phone_number)
      `)
      .eq('is_active', true)
      .limit(1)

    console.log('Follow-ups query result:', { followUps, error: followUpsError })

    if (followUpsError) throw followUpsError
    if (!followUps?.length) {
      console.log('No active follow-ups found')
      return new Response(
        JSON.stringify({ success: true, message: 'No active follow-ups' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const followUp = followUps[0]
    console.log('Processing follow-up:', followUp)

    if (!followUp.instance || followUp.instance.connection_status !== 'connected') {
      console.log('Instance not connected:', followUp.instance)
      return new Response(
        JSON.stringify({ success: true, message: 'Instance not connected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar contatos pendentes
    const { data: contacts, error: contactsError } = await supabaseClient
      .from('Users_clientes')
      .select('*')
      .eq('NomeDaEmpresa', followUp.instance_id)
      .is('ConversationId', null)
      .order('created_at', { ascending: true })
      .limit(1)

    console.log('Contacts query result:', { contacts, error: contactsError })

    if (contactsError) throw contactsError
    if (!contacts?.length) {
      console.log('No contacts found for follow-up')
      return new Response(
        JSON.stringify({ success: true, message: 'No contacts for follow-up' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const contact = contacts[0]
    const manualMessages = Array.isArray(followUp.manual_messages) ? followUp.manual_messages : []
    
    if (!manualMessages.length) {
      console.log('No messages configured for follow-up')
      return new Response(
        JSON.stringify({ success: true, message: 'No messages configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const firstMessage = manualMessages[0]
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')
    
    console.log('Sending message via Evolution API:', {
      instance: followUp.instance.name,
      contact: contact.TelefoneClientes
    })

    // Enviar mensagem via Evolution API
    const evolutionResponse = await fetch(
      `${evolutionApiUrl}/message/sendText/${followUp.instance.name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey || '',
        },
        body: JSON.stringify({
          number: contact.TelefoneClientes,
          text: firstMessage.message
        })
      }
    )

    if (!evolutionResponse.ok) {
      const error = await evolutionResponse.text()
      console.error('Evolution API error:', error)
      throw new Error(error)
    }

    const evolutionData = await evolutionResponse.json()
    console.log('Evolution API response:', evolutionData)

    // Atualizar status do contato
    await supabaseClient
      .from('Users_clientes')
      .update({
        ConversationId: 'follow-up-sent-0',
        last_message_time: new Date().toISOString()
      })
      .eq('id', contact.id)

    // Registrar mensagem enviada
    await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: followUp.instance_id,
        user_id: followUp.instance.user_id,
        sender_type: 'follow_up',
        content: firstMessage.message,
        whatsapp_message_id: evolutionData.key?.id
      })

    // Log success
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'success'
      })

    console.log('Follow-up process completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message sent successfully',
        contact: contact.TelefoneClientes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in get-follow-up-contacts:', error)

    // Log error
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
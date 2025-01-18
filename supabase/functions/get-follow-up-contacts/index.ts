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

    // 1. Buscar follow-ups ativos
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
        JSON.stringify({ success: true, message: 'Nenhum follow-up ativo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const followUp = followUps[0]
    
    // Pular instâncias desconectadas
    if (!followUp.instance || followUp.instance.connection_status !== 'connected') {
      return new Response(
        JSON.stringify({ success: true, message: 'Instância não está conectada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Buscar apenas 1 contato que precisa de follow-up
    const { data: contacts } = await supabaseClient
      .from('Users_clientes')
      .select('*')
      .eq('NomeDaEmpresa', followUp.instance_id)
      .is('ConversationId', null)
      .order('created_at', { ascending: true })
      .limit(1)

    if (!contacts?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum contato para follow-up' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const contact = contacts[0]
    const manualMessages = Array.isArray(followUp.manual_messages) ? followUp.manual_messages : []
    
    if (!manualMessages.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhuma mensagem configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const firstMessage = manualMessages[0]
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
    
    // 3. Enviar primeira mensagem
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
      throw new Error(await evolutionResponse.text())
    }

    const evolutionData = await evolutionResponse.json()

    // 4. Atualizar status do contato
    await supabaseClient
      .from('Users_clientes')
      .update({
        ConversationId: 'follow-up-sent-0',
        last_message_time: new Date().toISOString()
      })
      .eq('id', contact.id)

    // 5. Registrar mensagem enviada
    await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: followUp.instance_id,
        user_id: followUp.instance.user_id,
        sender_type: 'follow_up',
        content: firstMessage.message,
        whatsapp_message_id: evolutionData.key?.id
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem enviada com sucesso',
        contact: contact.TelefoneClientes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
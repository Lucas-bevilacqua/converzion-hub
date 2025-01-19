import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 [DEBUG] Iniciando função process-follow-up')
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { contact } = await req.json()
    console.log('📝 [DEBUG] Dados do contato recebidos:', JSON.stringify(contact, null, 2))
    
    if (!contact) {
      throw new Error('Dados do contato não fornecidos')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Determinar qual mensagem enviar
    let currentMessageIndex = -1
    if (contact.ConversationId?.startsWith('follow-up-sent-')) {
      currentMessageIndex = parseInt(contact.ConversationId.split('-').pop() || '-1')
    }

    const nextMessageIndex = currentMessageIndex + 1
    const manualMessages = Array.isArray(contact.followUp?.manual_messages) 
      ? contact.followUp.manual_messages 
      : []

    console.log(`📝 [DEBUG] Índice atual: ${currentMessageIndex}, Próximo: ${nextMessageIndex}`)
    console.log('📝 [DEBUG] Total de mensagens:', manualMessages.length)

    if (nextMessageIndex >= manualMessages.length) {
      console.log('✅ [DEBUG] Sequência de mensagens completa')
      return new Response(
        JSON.stringify({ success: true, message: 'Sequência completa' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const nextMessage = manualMessages[nextMessageIndex]
    console.log('📝 [DEBUG] Próxima mensagem:', nextMessage)

    // Enviar mensagem via Evolution API
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
    const evolutionResponse = await fetch(
      `${evolutionApiUrl}/message/sendText/${contact.followUp.instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
        },
        body: JSON.stringify({
          number: contact.TelefoneClientes,
          text: nextMessage.message
        })
      }
    )

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text()
      throw new Error(errorText)
    }

    const evolutionData = await evolutionResponse.json()
    console.log('✅ [DEBUG] Mensagem enviada:', evolutionData)

    // Atualizar status do contato
    await supabaseClient
      .from('Users_clientes')
      .update({
        ConversationId: `follow-up-sent-${nextMessageIndex}`,
        last_message_time: new Date().toISOString()
      })
      .eq('id', contact.id)

    // Registrar mensagem
    await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: contact.followUp.instance_id,
        user_id: contact.followUp.userId,
        sender_type: 'follow_up',
        content: nextMessage.message,
        whatsapp_message_id: evolutionData.key?.id
      })

    return new Response(
      JSON.stringify({ 
        success: true,
        messageIndex: nextMessageIndex,
        messageId: evolutionData.key?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ [ERRO]:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
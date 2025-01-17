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
    const { contact } = await req.json()
    
    if (!contact) {
      throw new Error('Dados do contato não fornecidos')
    }

    console.log('📨 Processando follow-up para contato:', {
      id: contact.id,
      telefone: contact.TelefoneClientes,
      instancia: contact.followUp?.instanceName
    })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let currentMessageIndex = -1
    if (contact.ConversationId?.startsWith('follow-up-sent-')) {
      currentMessageIndex = parseInt(contact.ConversationId.split('-').pop() || '-1')
    }

    const nextMessageIndex = currentMessageIndex + 1
    const manualMessages = Array.isArray(contact.followUp?.manual_messages) 
      ? contact.followUp.manual_messages 
      : []

    if (nextMessageIndex >= manualMessages.length) {
      console.log('✅ Sequência de mensagens completa para o contato:', contact.id)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Sequência completa' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const nextMessage = manualMessages[nextMessageIndex]
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
    
    console.log('🚀 Enviando mensagem via Evolution API:', {
      url: `${evolutionApiUrl}/message/sendText/${contact.followUp.instanceName}`,
      telefone: contact.TelefoneClientes,
      mensagem: nextMessage.message
    })

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
      const error = await evolutionResponse.text()
      console.error('❌ Erro ao enviar mensagem:', {
        status: evolutionResponse.status,
        erro: error
      })
      throw new Error(`Evolution API error: ${error}`)
    }

    const evolutionData = await evolutionResponse.json()
    
    const { error: updateError } = await supabaseClient
      .from('Users_clientes')
      .update({
        ConversationId: `follow-up-sent-${nextMessageIndex}`,
        last_message_time: new Date().toISOString()
      })
      .eq('id', contact.id)

    if (updateError) {
      console.error('❌ Erro ao atualizar contato:', updateError)
      throw updateError
    }

    const { error: messageError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: contact.followUp.instance_id,
        user_id: contact.followUp.userId,
        sender_type: 'follow_up',
        content: nextMessage.message,
        whatsapp_message_id: evolutionData.key?.id
      })

    if (messageError) {
      console.error('❌ Erro ao registrar mensagem:', messageError)
      throw messageError
    }

    console.log('✅ Follow-up processado com sucesso:', {
      contactId: contact.id,
      messageIndex: nextMessageIndex,
      messageId: evolutionData.key?.id
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
    console.error('❌ Erro ao processar follow-up:', {
      mensagem: error.message,
      stack: error.stack
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
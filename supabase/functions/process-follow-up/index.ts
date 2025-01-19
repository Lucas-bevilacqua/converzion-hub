import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 Iniciando função process-follow-up')
  
  if (req.method === 'OPTIONS') {
    console.log('👋 Handling CORS preflight request')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { contact } = await req.json()
    console.log('📝 Dados do contato recebidos:', contact)
    
    if (!contact) {
      console.error('❌ Erro: Dados do contato não fornecidos')
      throw new Error('Dados do contato não fornecidos')
    }

    console.log('🔑 Inicializando cliente Supabase')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let currentMessageIndex = -1
    if (contact.ConversationId?.startsWith('follow-up-sent-')) {
      currentMessageIndex = parseInt(contact.ConversationId.split('-').pop() || '-1')
    }
    console.log(`📊 Índice atual da mensagem: ${currentMessageIndex}`)

    const nextMessageIndex = currentMessageIndex + 1
    const manualMessages = Array.isArray(contact.followUp?.manual_messages) 
      ? contact.followUp.manual_messages 
      : []

    console.log(`📝 Total de mensagens manuais: ${manualMessages.length}`)
    console.log(`📝 Próximo índice: ${nextMessageIndex}`)

    if (nextMessageIndex >= manualMessages.length) {
      console.log('✅ Sequência de mensagens completa')
      return new Response(
        JSON.stringify({ success: true, message: 'Sequência completa' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const nextMessage = manualMessages[nextMessageIndex]
    console.log('📝 Próxima mensagem:', nextMessage)

    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
    console.log('🔗 URL da Evolution API:', evolutionApiUrl)
    
    console.log('📤 Enviando mensagem via Evolution API')
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
      console.error('❌ Erro da Evolution API:', errorText)
      throw new Error(errorText)
    }

    const evolutionData = await evolutionResponse.json()
    console.log('✅ Resposta da Evolution API:', evolutionData)
    
    console.log('📝 Atualizando status do contato no Supabase')
    const updateResponse = await supabaseClient
      .from('Users_clientes')
      .update({
        ConversationId: `follow-up-sent-${nextMessageIndex}`,
        last_message_time: new Date().toISOString()
      })
      .eq('id', contact.id)

    if (updateResponse.error) {
      console.error('❌ Erro ao atualizar contato:', updateResponse.error)
    }

    console.log('📝 Registrando mensagem no histórico')
    const messageResponse = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: contact.followUp.instance_id,
        user_id: contact.followUp.userId,
        sender_type: 'follow_up',
        content: nextMessage.message,
        whatsapp_message_id: evolutionData.key?.id
      })

    if (messageResponse.error) {
      console.error('❌ Erro ao registrar mensagem:', messageResponse.error)
    }

    console.log('✅ Processamento concluído com sucesso')
    return new Response(
      JSON.stringify({ 
        success: true,
        messageIndex: nextMessageIndex,
        messageId: evolutionData.key?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Erro crítico:', error)
    console.error('Stack do erro:', error.stack)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
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
    console.log('🚀 Iniciando processamento de follow-up')
    const { contact } = await req.json()
    
    if (!contact) {
      console.error('❌ Nenhum contato fornecido na requisição')
      throw new Error('Contato não fornecido')
    }

    console.log('📋 Dados do contato recebidos:', {
      id: contact.id,
      telefone: contact.TelefoneClientes,
      ultimaMensagem: contact.last_message_time,
      configuracaoFollowUp: contact.followUp
    })

    // Verificar se há configuração de follow-up válida
    const manualMessages = Array.isArray(contact.followUp?.manual_messages) 
      ? contact.followUp.manual_messages 
      : []

    if (!manualMessages.length) {
      console.error('❌ Configuração de follow-up inválida:', contact.followUp)
      throw new Error('Configuração de follow-up inválida')
    }

    // Determinar o índice da próxima mensagem
    let currentMessageIndex = -1
    if (contact.ConversationId?.startsWith('follow-up-sent-')) {
      currentMessageIndex = parseInt(contact.ConversationId.split('-').pop() || '-1')
    }

    const nextMessageIndex = currentMessageIndex + 1

    console.log('🔄 Status da sequência:', {
      indiceAtual: currentMessageIndex,
      proximoIndice: nextMessageIndex,
      totalMensagens: manualMessages.length
    })

    // Verificar se há próxima mensagem disponível
    if (nextMessageIndex >= manualMessages.length) {
      console.log('✅ Sequência de mensagens completa')
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Sequência de mensagens completa' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obter a próxima mensagem
    const nextMessage = manualMessages[nextMessageIndex]
    
    console.log('📨 Próxima mensagem:', {
      indice: nextMessageIndex,
      mensagem: nextMessage.message,
      atrasoMinutos: nextMessage.delay_minutes
    })

    // Enviar mensagem via Evolution API
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '')
    const evolutionApiEndpoint = `${evolutionApiUrl}/message/sendText/${contact.followUp.instanceName}`
    
    console.log('🔗 Preparando envio via Evolution API:', {
      url: evolutionApiEndpoint,
      instancia: contact.followUp.instanceName
    })

    const evolutionResponse = await fetch(evolutionApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
      },
      body: JSON.stringify({
        number: contact.TelefoneClientes,
        text: nextMessage.message
      }),
    })

    if (!evolutionResponse.ok) {
      const error = await evolutionResponse.text()
      console.error('❌ Erro ao enviar mensagem:', {
        status: evolutionResponse.status,
        erro: error
      })
      throw new Error(`Evolution API error: ${error}`)
    }

    const evolutionData = await evolutionResponse.json()
    console.log('✅ Mensagem enviada com sucesso:', evolutionData)

    // Atualizar o registro do contato
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('📝 Atualizando registro do contato:', {
      id: contact.id,
      novoStatus: `follow-up-sent-${nextMessageIndex}`,
      horarioEnvio: new Date().toISOString()
    })

    const { error: updateError } = await supabaseClient
      .from('Users_clientes')
      .update({ 
        last_message_time: new Date().toISOString(),
        ConversationId: `follow-up-sent-${nextMessageIndex}`
      })
      .eq('id', contact.id)

    if (updateError) {
      console.error('❌ Erro ao atualizar contato:', updateError)
      throw updateError
    }

    // Registrar mensagem no histórico
    console.log('📝 Registrando mensagem no histórico')

    const { error: chatError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: contact.NomeDaEmpresa,
        user_id: contact.followUp.userId,
        sender_type: 'follow_up',
        content: nextMessage.message,
        whatsapp_message_id: evolutionData.key?.id
      })

    if (chatError) {
      console.error('❌ Erro ao registrar mensagem:', chatError)
      throw chatError
    }

    console.log('✅ Follow-up processado com sucesso')

    return new Response(
      JSON.stringify({ 
        success: true,
        messageIndex: nextMessageIndex,
        nextDelay: nextMessage.delay_minutes 
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
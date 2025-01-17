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
    console.log('📩 Processando follow-up para:', {
      contato: contact.TelefoneClientes,
      ultimaMensagem: contact.last_message_time,
      followUpConfig: contact.followUp,
      mensagens: contact.followUp.messages
    })

    // Verificar qual é a próxima mensagem a ser enviada
    const lastMessageTime = new Date(contact.last_message_time || contact.created_at)
    const now = new Date()
    const minutesSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60)

    // Encontrar a próxima mensagem baseada no tempo acumulado e ConversationId
    let currentMessageIndex = -1
    if (contact.ConversationId && contact.ConversationId.startsWith('follow-up-sent-')) {
      currentMessageIndex = parseInt(contact.ConversationId.split('-').pop() || '-1')
    }

    const nextMessageIndex = currentMessageIndex + 1

    console.log('⏰ Calculando próxima mensagem:', {
      tempoDesdeUltima: minutesSinceLastMessage,
      mensagensDisponiveis: contact.followUp.messages.length,
      indiceAtual: currentMessageIndex,
      proximoIndice: nextMessageIndex
    })

    // Verificar se há próxima mensagem disponível
    if (nextMessageIndex >= contact.followUp.messages.length) {
      console.log('⏳ Sequência de mensagens completa')
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Sequência de mensagens completa' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obter a próxima mensagem
    const nextMessage = contact.followUp.messages[nextMessageIndex]
    
    // Calcular tempo acumulado até a próxima mensagem
    let accumulatedDelay = 0
    for (let i = 0; i <= nextMessageIndex; i++) {
      accumulatedDelay += contact.followUp.messages[i].delay_minutes
    }

    console.log('⏰ Verificando tempo para próxima mensagem:', {
      atrasoAcumulado: accumulatedDelay,
      tempoPassado: minutesSinceLastMessage,
      deveEnviar: minutesSinceLastMessage >= contact.followUp.messages[nextMessageIndex].delay_minutes
    })

    // Verificar se já passou tempo suficiente
    if (minutesSinceLastMessage < contact.followUp.messages[nextMessageIndex].delay_minutes) {
      console.log('⏳ Ainda não é hora de enviar a próxima mensagem')
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Aguardando intervalo para próxima mensagem' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Enviar mensagem via Evolution API
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')
    const evolutionApiEndpoint = `${evolutionApiUrl}/message/sendText/${contact.followUp.instanceName}`
    
    console.log('🔗 Configuração Evolution API:', {
      url: evolutionApiEndpoint,
      temChave: !!evolutionApiKey,
      instancia: contact.followUp.instanceName
    })

    if (!nextMessage?.message) {
      console.error('❌ Mensagem não configurada corretamente')
      throw new Error('Mensagem não configurada corretamente')
    }

    console.log('📤 Preparando envio:', {
      mensagem: nextMessage.message,
      numero: contact.TelefoneClientes,
      delay: nextMessage.delay_minutes,
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'PRESENTE' // não logamos a chave real
      }
    })

    const evolutionResponse = await fetch(evolutionApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey || '',
      },
      body: JSON.stringify({
        number: contact.TelefoneClientes,
        text: nextMessage.message
      }),
    })

    if (!evolutionResponse.ok) {
      const error = await evolutionResponse.text()
      console.error('❌ Erro Evolution API:', {
        status: evolutionResponse.status,
        erro: error
      })
      throw new Error(`Evolution API error: ${error}`)
    }

    const evolutionData = await evolutionResponse.json()
    console.log('✅ Mensagem enviada:', evolutionData)

    // Atualizar o horário da última mensagem
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('📝 Atualizando registro do contato:', {
      id: contact.id,
      novoStatus: `follow-up-sent-${nextMessageIndex}`,
      mensagemEnviada: nextMessageIndex
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
    console.log('📝 Registrando mensagem no histórico:', {
      instancia: contact.NomeDaEmpresa,
      usuario: contact.followUp.userId,
      tipo: 'follow_up',
      sequencia: nextMessageIndex
    })

    const { error: chatError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: contact.NomeDaEmpresa,
        user_id: contact.followUp.userId,
        sender_type: 'follow_up',
        content: nextMessage.message
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
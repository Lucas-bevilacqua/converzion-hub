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

    // Verificar se já passou o tempo de delay configurado
    const lastMessageTime = new Date(contact.last_message_time || contact.created_at)
    const now = new Date()
    const minutesSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60)
    const configuredDelay = contact.followUp.messages[0]?.delay_minutes || 60

    console.log('⏰ Análise de tempo:', {
      ultimaMensagem: lastMessageTime,
      agora: now,
      minutos: minutesSinceLastMessage,
      delayConfigurado: configuredDelay,
      mensagemConfig: contact.followUp.messages[0]
    })

    if (minutesSinceLastMessage < configuredDelay) {
      console.log('⏳ Ainda não é hora de enviar o follow-up:', {
        tempoPassado: minutesSinceLastMessage,
        tempoNecessario: configuredDelay,
        diferenca: configuredDelay - minutesSinceLastMessage
      })
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Aguardando tempo de delay' 
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

    // Se for follow-up manual, enviar a primeira mensagem da sequência
    const message = contact.followUp.messages[0]?.message || ''
    
    if (!message) {
      console.error('❌ Nenhuma mensagem configurada para envio')
      throw new Error('Nenhuma mensagem configurada para envio')
    }

    console.log('📤 Preparando envio:', {
      mensagem: message,
      numero: contact.TelefoneClientes,
      delay: configuredDelay,
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
        text: message
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
      novoStatus: 'follow-up-sent',
      delay: configuredDelay
    })

    const { error: updateError } = await supabaseClient
      .from('Users_clientes')
      .update({ 
        last_message_time: new Date().toISOString(),
        ConversationId: 'follow-up-sent'
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
      delay: configuredDelay
    })

    const { error: chatError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: contact.NomeDaEmpresa,
        user_id: contact.followUp.userId,
        sender_type: 'follow_up',
        content: message
      })

    if (chatError) {
      console.error('❌ Erro ao registrar mensagem:', chatError)
      throw chatError
    }

    console.log('✅ Follow-up processado com sucesso')

    return new Response(
      JSON.stringify({ success: true }),
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
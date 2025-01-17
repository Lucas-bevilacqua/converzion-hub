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
    console.log('📩 Processando follow-up para:', contact)

    // Verificar se já passou o tempo de delay configurado
    const lastMessageTime = new Date(contact.last_message_time || contact.created_at)
    const now = new Date()
    const minutesSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60)

    console.log('⏰ Tempo desde última mensagem:', minutesSinceLastMessage, 'minutos')
    console.log('⚙️ Delay configurado:', contact.followUp.messages[0]?.delay_minutes, 'minutos')

    if (minutesSinceLastMessage < (contact.followUp.messages[0]?.delay_minutes || 60)) {
      console.log('⏳ Ainda não é hora de enviar o follow-up')
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
    const evolutionApiEndpoint = `${evolutionApiUrl}/message/sendText/${contact.followUp.instanceName}`
    
    console.log('🔗 Evolution API endpoint:', evolutionApiEndpoint)

    // Se for follow-up manual, enviar a primeira mensagem da sequência
    const message = contact.followUp.messages[0]?.message || ''
    
    if (!message) {
      throw new Error('Nenhuma mensagem configurada para envio')
    }

    console.log('📤 Enviando mensagem:', message)
    console.log('📱 Para o número:', contact.TelefoneClientes)

    const evolutionResponse = await fetch(evolutionApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
      },
      body: JSON.stringify({
        number: contact.TelefoneClientes,
        text: message
      }),
    })

    if (!evolutionResponse.ok) {
      const error = await evolutionResponse.text()
      console.error('❌ Erro Evolution API:', error)
      throw new Error(`Evolution API error: ${error}`)
    }

    const evolutionData = await evolutionResponse.json()
    console.log('✅ Mensagem enviada:', evolutionData)

    // Atualizar o horário da última mensagem
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
    console.error('❌ Erro ao processar follow-up:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
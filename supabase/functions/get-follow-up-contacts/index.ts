import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 Iniciando função de follow-up - ' + new Date().toISOString())
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Log para verificar se as credenciais estão corretas
    console.log('📝 Credenciais do Supabase configuradas')

    // 1. Buscar follow-ups ativos
    console.log('📥 Buscando follow-ups ativos')
    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(id, name, user_id, connection_status, phone_number)
      `)
      .eq('is_active', true)
      .limit(1)

    if (followUpsError) {
      console.error('❌ Erro ao buscar follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log('✅ Follow-ups encontrados:', followUps?.length || 0)

    if (!followUps?.length) {
      console.log('ℹ️ Nenhum follow-up ativo encontrado')
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum follow-up ativo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const followUp = followUps[0]
    console.log('📱 Processando follow-up para instância:', followUp.instance?.name)
    
    // Pular instâncias desconectadas
    if (!followUp.instance || followUp.instance.connection_status !== 'connected') {
      console.log('⚠️ Instância não está conectada:', followUp.instance?.name)
      return new Response(
        JSON.stringify({ success: true, message: 'Instância não está conectada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Buscar contatos para follow-up
    console.log('🔍 Buscando contatos para follow-up')
    const { data: contacts, error: contactsError } = await supabaseClient
      .from('Users_clientes')
      .select('*')
      .eq('NomeDaEmpresa', followUp.instance_id)
      .is('ConversationId', null)
      .order('created_at', { ascending: true })
      .limit(1)

    if (contactsError) {
      console.error('❌ Erro ao buscar contatos:', contactsError)
      throw contactsError
    }

    console.log('✅ Contatos encontrados:', contacts?.length || 0)

    if (!contacts?.length) {
      console.log('ℹ️ Nenhum contato para follow-up')
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum contato para follow-up' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const contact = contacts[0]
    console.log('📱 Processando contato:', contact.TelefoneClientes)

    const manualMessages = Array.isArray(followUp.manual_messages) ? followUp.manual_messages : []
    
    if (!manualMessages.length) {
      console.log('⚠️ Nenhuma mensagem configurada')
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhuma mensagem configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const firstMessage = manualMessages[0]
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
    
    console.log('📤 Enviando mensagem via Evolution API')
    console.log('URL:', `${evolutionApiUrl}/message/sendText/${followUp.instance.name}`)
    console.log('Número:', contact.TelefoneClientes)
    console.log('Mensagem:', firstMessage.message)
    
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
      const error = await evolutionResponse.text()
      console.error('❌ Erro ao enviar mensagem:', error)
      throw new Error(error)
    }

    const evolutionData = await evolutionResponse.json()
    console.log('✅ Resposta da Evolution API:', evolutionData)

    // 4. Atualizar status do contato
    console.log('💾 Atualizando status do contato')
    const { error: updateError } = await supabaseClient
      .from('Users_clientes')
      .update({
        ConversationId: 'follow-up-sent-0',
        last_message_time: new Date().toISOString()
      })
      .eq('id', contact.id)

    if (updateError) {
      console.error('❌ Erro ao atualizar contato:', updateError)
      throw updateError
    }

    // 5. Registrar mensagem enviada
    console.log('💾 Registrando mensagem enviada')
    const { error: messageError } = await supabaseClient
      .from('chat_messages')
      .insert({
        instance_id: followUp.instance_id,
        user_id: followUp.instance.user_id,
        sender_type: 'follow_up',
        content: firstMessage.message,
        whatsapp_message_id: evolutionData.key?.id
      })

    if (messageError) {
      console.error('❌ Erro ao registrar mensagem:', messageError)
      throw messageError
    }

    // Log final de sucesso
    console.log('✅ Follow-up processado com sucesso')
    
    // Registrar execução na tabela de logs
    const { error: logError } = await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'success'
      })

    if (logError) {
      console.error('❌ Erro ao registrar log:', logError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem enviada com sucesso',
        contact: contact.TelefoneClientes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro ao processar follow-up:', error)
    
    // Registrar erro na tabela de logs
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
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting implementation
const rateLimiter = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 30; // Max requests per minute per instance

function isRateLimited(instanceId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimiter.get(instanceId) || [];
  
  // Remove old timestamps
  const recentTimestamps = timestamps.filter(t => t > now - RATE_LIMIT_WINDOW);
  rateLimiter.set(instanceId, recentTimestamps);
  
  return recentTimestamps.length >= MAX_REQUESTS;
}

function addRequest(instanceId: string) {
  const timestamps = rateLimiter.get(instanceId) || [];
  timestamps.push(Date.now());
  rateLimiter.set(instanceId, timestamps);
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

    // Rate limiting check
    if (isRateLimited(contact.followUp.instance_id)) {
      console.log('⚠️ [RATE LIMIT] Instance hit rate limit:', contact.followUp.instance_id)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.' 
        }),
        { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get service key from secure_configurations
    const { data: keyData, error: keyError } = await supabaseClient
      .from('secure_configurations')
      .select('config_value')
      .eq('config_key', 'supabase_service_role_key')
      .single()

    if (keyError || !keyData) {
      throw new Error('Failed to get service key')
    }

    const serviceKey = keyData.config_value

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

    // Adicionar request ao rate limiter
    addRequest(contact.followUp.instance_id)

    // Enviar mensagem via Evolution API usando a chave do banco
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
    const evolutionResponse = await fetch(
      `${evolutionApiUrl}/message/sendText/${contact.followUp.instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
        },
        body: JSON.stringify({
          number: contact.TelefoneClientes,
          text: nextMessage.message
        })
      }
    )

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text()
      console.error('❌ [ERROR] Erro ao enviar mensagem:', errorText)
      throw new Error(errorText)
    }

    const evolutionData = await evolutionResponse.json()
    console.log('✅ [DEBUG] Mensagem enviada:', evolutionData)

    // Atualizar status do contato e métricas
    const now = new Date().toISOString()
    
    await Promise.all([
      // Atualizar status do contato
      supabaseClient
        .from('Users_clientes')
        .update({
          ConversationId: `follow-up-sent-${nextMessageIndex}`,
          last_message_time: now
        })
        .eq('id', contact.id),

      // Atualizar métricas do follow-up
      supabaseClient
        .from('instance_follow_ups')
        .update({
          last_execution_time: now,
          execution_count: contact.followUp.execution_count + 1
        })
        .eq('id', contact.followUp.id),

      // Registrar mensagem
      supabaseClient
        .from('chat_messages')
        .insert({
          instance_id: contact.followUp.instance_id,
          user_id: contact.followUp.userId,
          sender_type: 'follow_up',
          content: nextMessage.message,
          whatsapp_message_id: evolutionData.key?.id
        })
    ])

    return new Response(
      JSON.stringify({ 
        success: true,
        messageIndex: nextMessageIndex,
        messageId: evolutionData.key?.id,
        executionTime: now
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
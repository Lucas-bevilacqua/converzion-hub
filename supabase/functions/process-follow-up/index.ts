import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_REQUESTS = 30

const rateLimiter = new Map<string, number[]>()

function isRateLimited(instanceId: string): boolean {
  const now = Date.now()
  const timestamps = rateLimiter.get(instanceId) || []
  const recentTimestamps = timestamps.filter(t => t > now - RATE_LIMIT_WINDOW)
  rateLimiter.set(instanceId, recentTimestamps)
  return recentTimestamps.length >= MAX_REQUESTS
}

function addRequest(instanceId: string) {
  const timestamps = rateLimiter.get(instanceId) || []
  timestamps.push(Date.now())
  rateLimiter.set(instanceId, timestamps)
}

serve(async (req) => {
  const requestId = crypto.randomUUID()
  console.log(`[${requestId}] 🚀 Starting process-follow-up`)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { contact } = await req.json()
    console.log(`[${requestId}] 📝 Received contact data:`, JSON.stringify(contact, null, 2))
    
    if (!contact || !contact.followUp) {
      console.error(`[${requestId}] ❌ Invalid request data:`, { contact })
      throw new Error('Dados do contato não fornecidos corretamente')
    }

    // Rate limiting check
    if (isRateLimited(contact.followUp.instance_id)) {
      console.log(`[${requestId}] ⚠️ Rate limit hit for instance:`, contact.followUp.instance_id)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.',
          requestId 
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

    // Verify instance connection status
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('connection_status, name')
      .eq('id', contact.followUp.instance_id)
      .single()

    if (instanceError) {
      console.error(`[${requestId}] ❌ Error fetching instance:`, instanceError)
      throw new Error('Erro ao verificar status da instância')
    }

    if (instance.connection_status !== 'connected') {
      console.log(`[${requestId}] ⚠️ Instance ${instance.name} not connected, skipping`)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Instance not connected',
          requestId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Add request to rate limiter
    addRequest(contact.followUp.instance_id)

    // Send message via Evolution API
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')
    
    if (!evolutionApiKey) {
      throw new Error('Evolution API key not configured')
    }

    // Get the next message to send
    const manualMessages = Array.isArray(contact.followUp.manual_messages) 
      ? contact.followUp.manual_messages 
      : []

    let currentMessageIndex = -1
    if (contact.ConversationId?.startsWith('follow-up-sent-')) {
      currentMessageIndex = parseInt(contact.ConversationId.split('-').pop() || '-1')
    }

    const nextMessageIndex = currentMessageIndex + 1
    
    console.log(`[${requestId}] 📝 Message indices:`, {
      current: currentMessageIndex,
      next: nextMessageIndex,
      total: manualMessages.length
    })

    if (nextMessageIndex >= manualMessages.length) {
      console.log(`[${requestId}] ✅ Message sequence complete`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Sequence complete',
          requestId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const nextMessage = manualMessages[nextMessageIndex]
    console.log(`[${requestId}] 📝 Sending message:`, nextMessage)
    
    const evolutionResponse = await fetch(
      `${evolutionApiUrl}/message/sendText/${instance.name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({
          number: contact.TelefoneClientes || contact.telefoneclientes,
          text: nextMessage.message
        })
      }
    )

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text()
      console.error(`[${requestId}] ❌ Error sending message:`, errorText)
      throw new Error(`Erro ao enviar mensagem: ${errorText}`)
    }

    const evolutionData = await evolutionResponse.json()
    console.log(`[${requestId}] ✅ Message sent:`, evolutionData)

    // Update contact status and metrics
    const now = new Date().toISOString()
    
    await Promise.all([
      // Update contact status
      supabaseClient
        .from('Users_clientes')
        .update({
          ConversationId: `follow-up-sent-${nextMessageIndex}`,
          last_message_time: now
        })
        .eq('id', contact.id),

      // Update follow-up metrics
      supabaseClient
        .from('instance_follow_ups')
        .update({
          last_execution_time: now,
          execution_count: contact.followUp.execution_count + 1,
          next_execution_time: new Date(Date.now() + (contact.followUp.delay_minutes * 60000)).toISOString()
        })
        .eq('id', contact.followUp.id),

      // Log message
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

    console.log(`[${requestId}] ✅ Follow-up processed successfully`)

    return new Response(
      JSON.stringify({ 
        success: true,
        messageIndex: nextMessageIndex,
        messageId: evolutionData.key?.id,
        executionTime: now,
        requestId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(`[${requestId}] ❌ Error processing follow-up:`, error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        requestId,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
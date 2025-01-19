import "https://deno.land/x/xhr@0.1.0/mod.ts"
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
    console.log('🚀 Starting follow-up contacts processing')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar follow-ups ativos
    const { data: followUps, error: followUpsError } = await supabase
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id,
          name,
          user_id,
          phone_number
        )
      `)
      .eq('is_active', true)

    if (followUpsError) {
      throw followUpsError
    }

    console.log(`✅ Found ${followUps?.length || 0} active follow-ups`)

    const processedFollowUps = []
    const errors = []

    for (const followUp of followUps || []) {
      try {
        console.log(`📝 Processing follow-up: { id: "${followUp.id}", instanceId: "${followUp.instance?.name}", type: "${followUp.follow_up_type}" }`)

        // Buscar contatos que precisam de follow-up
        const { data: contacts } = await supabase
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .not('TelefoneClientes', 'is', null)

        if (!contacts?.length) {
          console.log('⚠️ No contacts found for follow-up')
          continue
        }

        console.log(`ℹ️ Processing contact: { id: ${contacts[0].id}, phone: "${contacts[0].TelefoneClientes}" }`)
        console.log(`📊 Found contacts: ${contacts.length}`)

        // Verificar última mensagem
        const { data: lastMessage } = await supabase
          .from('chat_messages')
          .select('created_at')
          .eq('instance_id', followUp.instance_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (lastMessage) {
          const lastMessageTime = new Date(lastMessage.created_at)
          const delayMinutes = followUp.delay_minutes || 60
          const nextMessageTime = new Date(lastMessageTime.getTime() + delayMinutes * 60000)

          if (nextMessageTime > new Date()) {
            console.log('⏳ Waiting for delay time to pass')
            continue
          }
        }

        // Verificar número de tentativas
        const { data: followUpMessages } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('instance_id', followUp.instance_id)
          .eq('sender_type', 'follow_up')
          .order('created_at', { ascending: false })

        if (followUpMessages && followUpMessages.length >= (followUp.max_attempts || 3)) {
          console.log('⚠️ Max attempts reached')
          continue
        }

        // Verificar se houve resposta
        if (followUp.stop_on_reply && followUpMessages?.length > 0) {
          const { data: userReplies } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('instance_id', followUp.instance_id)
            .eq('sender_type', 'user')
            .gt('created_at', followUpMessages[0].created_at)
            .order('created_at', { ascending: false })

          if (userReplies?.length > 0) {
            console.log('✋ User has replied, stopping follow-up')
            continue
          }
        }

        // Verificar palavras-chave de parada
        const stopKeywords = followUp.stop_on_keyword || []
        const { data: messages } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('instance_id', followUp.instance_id)
          .order('created_at', { ascending: true })

        const hasStopKeyword = messages?.some(msg => 
          msg.sender_type === 'user' && 
          stopKeywords.some(keyword => 
            msg.content.toLowerCase().includes(keyword.toLowerCase())
          )
        )

        if (hasStopKeyword) {
          console.log('🚫 Stop keyword found, skipping')
          continue
        }

        // Preparar mensagens para envio
        let messagesToSend = []
        
        if (followUp.follow_up_type === 'manual') {
          messagesToSend = followUp.manual_messages || []
        } else if (followUp.follow_up_type === 'ai_generated') {
          // Gerar mensagem com OpenAI
          console.log('🤖 Generating message with OpenAI')
          
          const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { 
                  role: 'system', 
                  content: followUp.system_prompt || "You are a helpful assistant that generates natural and contextualized follow-up messages." 
                },
                ...(messages?.map(msg => ({
                  role: msg.sender_type === 'user' ? 'user' : 'assistant',
                  content: msg.content
                })) || []),
                { 
                  role: 'user', 
                  content: 'Please generate an appropriate follow-up message for this conversation.' 
                }
              ],
              temperature: 0.7,
            }),
          })

          if (!openAiResponse.ok) {
            throw new Error(await openAiResponse.text())
          }

          const aiData = await openAiResponse.json()
          messagesToSend = [{
            message: aiData.choices[0].message.content,
            delay_minutes: followUp.delay_minutes || 60
          }]
        }

        if (!messagesToSend.length) {
          console.log('⚠️ No messages configured for follow-up:', followUp.id)
          continue
        }

        console.log('📨 Messages to send:', messagesToSend)

        processedFollowUps.push({
          followUpId: followUp.id,
          instanceId: followUp.instance_id,
          messages: messagesToSend
        })

      } catch (error) {
        console.error('❌ Error processing follow-up:', error)
        errors.push({
          followUpId: followUp.id,
          error: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: processedFollowUps,
        errors 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Critical error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
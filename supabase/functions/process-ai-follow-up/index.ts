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
    console.log('🚀 Iniciando processamento de follow-ups de IA')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Log execution start
    const { data: logData, error: logError } = await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'process-ai-follow-up',
        status: 'started'
      })
      .select()
      .single()

    if (logError) {
      console.error('❌ Erro ao registrar início do job:', logError)
      throw logError
    }

    console.log('✅ Log de execução criado:', logData)

    // Buscar follow-ups ativos do tipo AI
    console.log('🔍 Buscando follow-ups ativos do tipo AI')
    const { data: activeFollowUps, error: followUpsError } = await supabaseClient
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id,
          name,
          user_id,
          phone_number,
          system_prompt
        )
      `)
      .eq('is_active', true)
      .eq('follow_up_type', 'ai_generated')

    if (followUpsError) {
      console.error('❌ Erro ao buscar follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log(`✅ Encontrados ${activeFollowUps?.length || 0} follow-ups ativos do tipo AI`)

    if (!activeFollowUps?.length) {
      console.log('ℹ️ Nenhum follow-up ativo do tipo AI encontrado')
      await supabaseClient
        .from('cron_logs')
        .update({ 
          status: 'completed - no active follow-ups',
          execution_time: new Date().toISOString()
        })
        .eq('id', logData?.id)

      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum follow-up ativo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')

    if (!evolutionApiUrl || !evolutionApiKey || !openAiKey) {
      throw new Error('Configurações de API ausentes')
    }

    const processedFollowUps = []
    const errors = []

    for (const followUp of activeFollowUps) {
      try {
        console.log('📝 Processando follow-up:', {
          id: followUp.id,
          instanceId: followUp.instance_id,
          instanceName: followUp.instance?.name
        })

        if (!followUp.instance?.name || !followUp.instance?.phone_number) {
          console.error('❌ Dados da instância incompletos:', followUp.instance_id)
          errors.push({
            type: 'missing_instance_data',
            followUpId: followUp.id
          })
          continue
        }

        // Buscar histórico de mensagens
        const { data: chatHistory, error: chatError } = await supabaseClient
          .from('chat_messages')
          .select('*')
          .eq('instance_id', followUp.instance_id)
          .order('created_at', { ascending: true })
          .limit(10)

        if (chatError) {
          console.error('❌ Erro ao buscar histórico:', chatError)
          errors.push({
            type: 'chat_history_error',
            followUpId: followUp.id,
            error: chatError
          })
          continue
        }

        // Preparar mensagens para a IA
        const messages = [
          { 
            role: 'system', 
            content: followUp.system_prompt || followUp.instance.system_prompt || "Você é um assistente prestativo que gera mensagens de follow-up naturais e contextualizadas." 
          }
        ]

        if (chatHistory?.length) {
          chatHistory.forEach(msg => {
            messages.push({
              role: msg.sender_type === 'user' ? 'user' : 'assistant',
              content: msg.content
            })
          })
        }

        messages.push({ 
          role: 'user', 
          content: 'Por favor, gere uma mensagem de follow-up apropriada para esta conversa.'
        })

        console.log('🤖 Gerando mensagem com OpenAI')
        
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.7,
          }),
        })

        if (!openaiResponse.ok) {
          const error = await openaiResponse.text()
          console.error('❌ Erro na API da OpenAI:', error)
          errors.push({
            type: 'openai_api_error',
            followUpId: followUp.id,
            error
          })
          continue
        }

        const data = await openaiResponse.json()
        const followUpMessage = data.choices[0].message.content
        console.log('✅ Mensagem gerada:', followUpMessage)

        // Enviar mensagem via Evolution API
        console.log('📤 Enviando mensagem via Evolution API')
        const fullUrl = `${evolutionApiUrl}/message/sendText/${followUp.instance.name}`
        
        const evolutionResponse = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            number: followUp.instance.phone_number,
            text: followUpMessage
          })
        })

        if (!evolutionResponse.ok) {
          const error = await evolutionResponse.text()
          console.error('❌ Erro na Evolution API:', error)
          errors.push({
            type: 'evolution_api_error',
            followUpId: followUp.id,
            error
          })
          continue
        }

        const evolutionData = await evolutionResponse.json()
        console.log('✅ Resposta da Evolution API:', evolutionData)

        // Salvar mensagem no histórico
        const { error: saveError } = await supabaseClient
          .from('chat_messages')
          .insert({
            instance_id: followUp.instance_id,
            user_id: followUp.instance.user_id,
            sender_type: 'follow_up',
            content: followUpMessage,
            whatsapp_message_id: evolutionData.key?.id
          })

        if (saveError) {
          console.error('❌ Erro ao salvar mensagem:', saveError)
          errors.push({
            type: 'save_message_error',
            followUpId: followUp.id,
            error: saveError
          })
          continue
        }

        processedFollowUps.push({
          id: followUp.id,
          messageId: evolutionData.key?.id
        })

      } catch (error) {
        console.error('❌ Erro ao processar follow-up:', error)
        errors.push({
          type: 'follow_up_processing_error',
          followUpId: followUp.id,
          error: error.message
        })
      }
    }

    // Atualizar status final no log
    const finalStatus = errors.length > 0 
      ? `completed with ${errors.length} errors` 
      : 'completed successfully'

    await supabaseClient
      .from('cron_logs')
      .update({ 
        status: finalStatus,
        execution_time: new Date().toISOString()
      })
      .eq('id', logData?.id)

    console.log('🏁 Processamento concluído:', {
      processed: processedFollowUps.length,
      errors: errors.length
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Follow-ups processados',
        processed: processedFollowUps,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro crítico:', error)
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
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
    console.log('🔄 [DEBUG] Iniciando busca de follow-ups')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar follow-ups ativos que precisam ser processados
    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('follow_ups')
      .select(`
        *,
        instance:evolution_instances (
          id,
          name,
          connection_status,
          user_id
        )
      `)
      .eq('status', 'pending')
      .lt('scheduled_for', new Date().toISOString())

    if (followUpsError) {
      console.error('❌ [ERROR] Erro ao buscar follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log(`✅ [DEBUG] Follow-ups encontrados: ${followUps?.length || 0}`)
    console.log('📊 [DEBUG] Detalhes dos follow-ups:', followUps)

    // Filtrar follow-ups com instâncias conectadas
    const validFollowUps = followUps?.filter(followUp => 
      followUp.instance?.connection_status?.toLowerCase() === 'connected'
    ) || []

    console.log(`🔍 [DEBUG] Follow-ups válidos (com instâncias conectadas): ${validFollowUps.length}`)
    
    if (validFollowUps.length === 0) {
      console.log('ℹ️ [INFO] Razões possíveis para não encontrar follow-ups:')
      console.log('- Follow-ups não estão com status "pending"')
      console.log('- Data agendada ainda não chegou')
      console.log('- Instâncias estão desconectadas')
      
      return new Response(
        JSON.stringify({ 
          message: 'Nenhum follow-up para processar',
          details: {
            total: followUps?.length || 0,
            valid: 0,
            timestamp: new Date().toISOString()
          }
        }),
        { 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Processar cada follow-up válido
    const results = await Promise.all(
      validFollowUps.map(async (followUp) => {
        try {
          console.log(`🔄 [DEBUG] Processando follow-up ${followUp.id} para instância ${followUp.instance?.name}`)
          
          // Buscar mensagens do follow-up
          const { data: messages, error: messagesError } = await supabaseClient
            .from('follow_up_messages')
            .select('*')
            .eq('follow_up_id', followUp.id)
            .order('delay_minutes', { ascending: true })

          if (messagesError) throw messagesError

          console.log(`📨 [DEBUG] Mensagens encontradas para follow-up ${followUp.id}:`, messages?.length || 0)

          // Atualizar status do follow-up para in_progress
          const { error: updateError } = await supabaseClient
            .from('follow_ups')
            .update({ 
              status: 'in_progress',
              updated_at: new Date().toISOString()
            })
            .eq('id', followUp.id)

          if (updateError) throw updateError

          return {
            followUpId: followUp.id,
            instanceId: followUp.instance_id,
            status: 'processed',
            messages: messages?.length || 0
          }
        } catch (error) {
          console.error(`❌ [ERROR] Erro ao processar follow-up ${followUp.id}:`, error)
          return {
            followUpId: followUp.id,
            instanceId: followUp.instance_id,
            status: 'error',
            error: error.message
          }
        }
      })
    )

    console.log('✅ [DEBUG] Resultados do processamento:', results)

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('❌ [ERROR] Erro crítico:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
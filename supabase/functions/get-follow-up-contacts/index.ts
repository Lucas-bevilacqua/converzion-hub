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
          user_id,
          connection_status
        )
      `)
      .eq('status', 'pending')
      .is('completed_at', null)

    if (followUpsError) {
      console.error('❌ [ERROR] Erro ao buscar follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log(`✅ [DEBUG] Follow-ups encontrados: ${followUps?.length || 0}`)
    
    if (followUps && followUps.length > 0) {
      console.log('📊 [DEBUG] Detalhes dos follow-ups:', JSON.stringify(followUps, null, 2))
    }

    // Filtrar follow-ups com instâncias conectadas
    const validFollowUps = followUps?.filter(followUp => {
      // Normalizar status para case-insensitive
      const instanceStatus = (followUp.instance?.connection_status || '').toLowerCase()
      const isConnected = instanceStatus === 'connected'
      const isActive = followUp.settings?.is_active === true
      const scheduledTime = new Date(followUp.scheduled_for).getTime()
      const currentTime = new Date().getTime()
      const isTimeToProcess = scheduledTime <= currentTime

      console.log(`🔍 [DEBUG] Validando follow-up ${followUp.id}:`, {
        instanceStatus,
        isConnected,
        isActive,
        scheduledTime: new Date(followUp.scheduled_for).toISOString(),
        currentTime: new Date().toISOString(),
        isTimeToProcess,
        connection_status: followUp.instance?.connection_status,
        settings: followUp.settings
      })

      return isConnected && isActive && isTimeToProcess
    }) || []

    console.log(`🔍 [DEBUG] Follow-ups válidos (com instâncias conectadas): ${validFollowUps.length}`)

    if (validFollowUps.length === 0) {
      console.log('ℹ️ [INFO] Razões possíveis para não encontrar follow-ups:')
      if (followUps?.length === 0) {
        console.log('- Nenhum follow-up encontrado')
      } else {
        if (!followUps?.some(f => f.settings?.is_active)) {
          console.log('- Follow-ups não estão ativos')
        }
        if (!followUps?.some(f => new Date(f.scheduled_for).getTime() <= new Date().getTime())) {
          console.log('- Data agendada ainda não chegou')
        }
        if (!followUps?.some(f => (f.instance?.connection_status || '').toLowerCase() === 'connected')) {
          console.log('- Instâncias estão desconectadas')
        }
      }
      
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

    // Process each valid follow-up
    const results = await Promise.all(
      validFollowUps.map(async (followUp) => {
        try {
          // Update follow-up status to in_progress
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
            status: 'processed'
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
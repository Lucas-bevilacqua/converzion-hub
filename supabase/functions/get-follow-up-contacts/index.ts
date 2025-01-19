import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FollowUp {
  id: string;
  instance_id: string;
  is_active: boolean;
  follow_up_type: 'manual' | 'ai_generated';
  instance: {
    id: string;
    name: string;
    user_id: string;
    connection_status: string;
  };
}

interface Contact {
  id: string;
  TelefoneClientes: string;
  ConversationId: string | null;
  NomeDaEmpresa: string;
}

serve(async (req) => {
  console.log('🚀 [DEBUG] Iniciando função get-follow-up-contacts')
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Log inicial
    console.log('📝 [DEBUG] Registrando início da execução')
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'iniciado',
        execution_time: new Date().toISOString()
      })

    // Buscar follow-ups ativos
    console.log('🔍 [DEBUG] Buscando follow-ups ativos')
    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id,
          name,
          user_id,
          connection_status
        )
      `)
      .eq('is_active', true)

    if (followUpsError) {
      throw followUpsError
    }

    const processedFollowUps = []
    const errors = []

    for (const followUp of (followUps as FollowUp[] || [])) {
      try {
        if (!followUp.instance?.connection_status || followUp.instance.connection_status !== 'connected') {
          console.log(`⚠️ [AVISO] Instância ${followUp.instance?.name} não está conectada`)
          continue
        }

        // Buscar contatos
        const { data: contacts, error: contactsError } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .not('TelefoneClientes', 'is', null)
          .order('last_message_time', { ascending: true, nullsFirst: true })

        if (contactsError) {
          throw contactsError
        }

        console.log(`📊 [DEBUG] Encontrados ${contacts?.length || 0} contatos para a instância ${followUp.instance.name}`)

        for (const contact of (contacts as Contact[] || [])) {
          try {
            const processFollowUpUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-follow-up`
            
            const processingResponse = await fetch(
              processFollowUpUrl,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({
                  contact: {
                    ...contact,
                    followUp: {
                      ...followUp,
                      instance_id: followUp.instance_id,
                      instanceName: followUp.instance.name,
                      userId: followUp.instance.user_id
                    }
                  }
                })
              }
            )

            if (!processingResponse.ok) {
              throw new Error(`Erro ao processar follow-up: ${await processingResponse.text()}`)
            }

            const responseData = await processingResponse.json()
            console.log('✅ [DEBUG] Follow-up processado:', responseData)

            processedFollowUps.push({
              followUpId: followUp.id,
              instanceId: followUp.instance_id,
              contactId: contact.id,
              timestamp: new Date().toISOString()
            })

          } catch (contactError) {
            console.error(`❌ [ERRO] Falha ao processar contato ${contact.id}:`, contactError)
            errors.push({
              followUpId: followUp.id,
              contactId: contact.id,
              error: contactError.message,
              timestamp: new Date().toISOString()
            })
          }
        }
      } catch (error) {
        console.error(`❌ [ERRO] Falha ao processar follow-up ${followUp.id}:`, error)
        errors.push({
          followUpId: followUp.id,
          error: error.message,
          timestamp: new Date().toISOString()
        })
      }
    }

    // Log final
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'completado',
        execution_time: new Date().toISOString(),
        details: JSON.stringify({
          processed: processedFollowUps.length,
          errors: errors.length
        })
      })

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedFollowUps,
        errors,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ [ERRO CRÍTICO]:', error)
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    await supabase
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: `erro: ${error.message}`,
        execution_time: new Date().toISOString()
      })

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
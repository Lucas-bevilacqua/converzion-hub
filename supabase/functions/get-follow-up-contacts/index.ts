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
    console.log('🔍 Buscando contatos para follow-up')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar configurações de follow-up ativas
    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('instance_follow_ups')
      .select(`
        *,
        evolution_instances (
          name,
          phone_number,
          system_prompt
        )
      `)
      .eq('is_active', true)

    if (followUpsError) {
      console.error('❌ Erro ao buscar configurações de follow-up:', followUpsError)
      throw followUpsError
    }

    // Para cada configuração, buscar contatos elegíveis
    const contacts = []
    const now = new Date()
    const currentDay = now.getDay() // 0-6 (Domingo-Sábado)
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false })

    for (const followUp of followUps) {
      console.log(`📝 Processando follow-up ${followUp.id} do tipo ${followUp.follow_up_type}`)
      
      // Verificar se está dentro do horário permitido
      if (
        followUp.schedule_days.includes(currentDay) &&
        currentTime >= followUp.schedule_start_time &&
        currentTime <= followUp.schedule_end_time
      ) {
        // Buscar contatos que não receberam follow-up ainda
        // ou que já passou o tempo de delay desde a última mensagem
        const { data: eligibleContacts, error: contactsError } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .or(`ConversationId.is.null,and(last_message_time.lt.${new Date(now.getTime() - followUp.delay_minutes * 60000).toISOString()})`)
          .limit(10) // Limitar a 10 contatos por vez para não sobrecarregar

        if (contactsError) {
          console.error('❌ Erro ao buscar contatos:', contactsError)
          continue
        }

        console.log(`✅ Encontrados ${eligibleContacts?.length || 0} contatos elegíveis`)

        // Para follow-ups do tipo AI, precisamos incluir o prompt do sistema
        if (followUp.follow_up_type === 'ai_generated') {
          contacts.push(...(eligibleContacts || []).map(contact => ({
            ...contact,
            followUp: {
              type: followUp.follow_up_type,
              delay_minutes: followUp.delay_minutes,
              instanceName: followUp.evolution_instances.name,
              instancePhone: followUp.evolution_instances.phone_number,
              systemPrompt: followUp.evolution_instances.system_prompt,
              maxAttempts: followUp.max_attempts
            }
          })))
        } else {
          contacts.push(...(eligibleContacts || []).map(contact => ({
            ...contact,
            followUp: {
              type: followUp.follow_up_type,
              template: followUp.template_message,
              instanceName: followUp.evolution_instances.name,
              instancePhone: followUp.evolution_instances.phone_number,
              maxAttempts: followUp.max_attempts
            }
          })))
        }
      }
    }

    console.log(`✅ Total de ${contacts.length} contatos para follow-up`)

    return new Response(
      JSON.stringify({ contacts }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('❌ Erro ao processar requisição:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
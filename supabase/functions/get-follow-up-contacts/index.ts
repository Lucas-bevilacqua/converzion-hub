import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
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
          phone_number
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
      // Verificar se está dentro do horário permitido
      if (
        followUp.schedule_days.includes(currentDay) &&
        currentTime >= followUp.schedule_start_time &&
        currentTime <= followUp.schedule_end_time
      ) {
        // Buscar contatos que não receberam follow-up ainda
        const { data: eligibleContacts, error: contactsError } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .is('ConversationId', null) // Ainda não teve follow-up

        if (contactsError) {
          console.error('❌ Erro ao buscar contatos:', contactsError)
          continue
        }

        contacts.push(...(eligibleContacts || []).map(contact => ({
          ...contact,
          followUp: {
            type: followUp.follow_up_type,
            template: followUp.template_message,
            instanceName: followUp.evolution_instances.name,
            instancePhone: followUp.evolution_instances.phone_number
          }
        })))
      }
    }

    console.log(`✅ Encontrados ${contacts.length} contatos para follow-up`)

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
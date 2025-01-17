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
    console.log('🔍 Iniciando busca de contatos para follow-up')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar instâncias com follow-up ativo
    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id,
          name,
          user_id
        )
      `)
      .eq('is_active', true)

    if (followUpsError) {
      console.error('❌ Erro ao buscar follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log('📋 Follow-ups ativos encontrados:', followUps?.length || 0)

    // Para cada follow-up ativo, buscar contatos elegíveis
    const processedContacts = []
    
    for (const followUp of followUps || []) {
      console.log('🔄 Processando follow-up da instância:', followUp.instance?.name)

      const { data: contacts, error: contactsError } = await supabaseClient
        .from('Users_clientes')
        .select('*')
        .eq('NomeDaEmpresa', followUp.instance_id)
        .is('ConversationId', null)

      if (contactsError) {
        console.error('❌ Erro ao buscar contatos:', contactsError)
        continue
      }

      console.log('👥 Contatos encontrados para a instância:', contacts?.length || 0)

      // Processar cada contato
      for (const contact of contacts || []) {
        console.log('👤 Processando contato:', contact.TelefoneClientes)

        try {
          const processResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-follow-up`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                contact: {
                  ...contact,
                  followUp: {
                    ...followUp,
                    instanceName: followUp.instance?.name,
                    userId: followUp.instance?.user_id
                  }
                }
              })
            }
          )

          const processResult = await processResponse.json()
          console.log('✅ Resultado do processamento:', processResult)
          
          processedContacts.push({
            contactId: contact.id,
            success: processResult.success,
            message: processResult.message
          })
        } catch (error) {
          console.error('❌ Erro ao processar contato:', {
            contato: contact.id,
            erro: error.message
          })
        }
      }
    }

    console.log('✅ Processamento de follow-ups concluído:', {
      totalProcessado: processedContacts.length
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: processedContacts
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Erro geral no processamento:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
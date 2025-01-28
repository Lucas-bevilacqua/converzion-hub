import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

console.log('🔄 [DEBUG] Starting get-follow-up-contacts function')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔄 [DEBUG] Fetching active follow-ups')

    // Buscar follow-ups ativos
    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('follow_ups')
      .select(`
        id,
        instance_id,
        settings,
        type,
        instance:evolution_instances (
          id,
          connection_status
        )
      `)
      .eq('status', 'pending')
      .filter('settings->is_active', 'eq', true)

    if (followUpsError) {
      console.error('❌ [ERROR] Error fetching follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log('✅ [DEBUG] Found follow-ups:', followUps?.length || 0)

    if (!followUps || followUps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active follow-ups found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Para cada follow-up, buscar contatos elegíveis
    for (const followUp of followUps) {
      console.log('🔄 [DEBUG] Processing follow-up:', followUp.id)

      // Verificar se a instância está conectada
      if (!followUp.instance?.connection_status?.toLowerCase().includes('connected')) {
        console.log('⚠️ [WARN] Instance not connected, skipping')
        continue
      }

      // Buscar contatos que já foram processados
      const { data: existingContacts } = await supabaseClient
        .from('follow_up_contacts')
        .select('phone')
        .eq('follow_up_id', followUp.id)

      const existingPhones = new Set(existingContacts?.map(c => c.phone) || [])

      // Buscar contatos elegíveis
      const { data: contacts, error: contactsError } = await supabaseClient
        .from('Users_clientes')
        .select('*')
        .eq('NomeDaEmpresa', followUp.instance_id)
        .not('TelefoneClientes', 'in', `(${Array.from(existingPhones).join(',')})`)
        .order('last_message_time', { ascending: false })
        .limit(10)

      if (contactsError) {
        console.error('❌ [ERROR] Error fetching contacts:', contactsError)
        continue
      }

      console.log('✅ [DEBUG] Found contacts:', contacts?.length || 0)

      if (!contacts || contacts.length === 0) {
        continue
      }

      // Formatar contatos para inserção
      const contactsToInsert = contacts
        .filter(contact => contact.TelefoneClientes)
        .map(contact => ({
          follow_up_id: followUp.id,
          phone: contact.TelefoneClientes,
          status: 'pending',
          metadata: {
            contact_name: contact.NomeClientes || 'Unknown',
            last_message_time: contact.last_message_time
          }
        }))

      console.log('🔄 [DEBUG] Filtered and formated', contactsToInsert.length, 'valid contacts')

      // Inserir contatos
      if (contactsToInsert.length > 0) {
        console.log('🔄 [DEBUG] Trying to insert', contactsToInsert.length, 'contacts for follow-up', followUp.id)
        
        const { error: insertError } = await supabaseClient
          .from('follow_up_contacts')
          .insert(contactsToInsert)

        if (insertError) {
          console.error('❌ [ERROR] Error inserting contacts:', insertError)
          continue
        }

        console.log('✅ [DEBUG] Successfully inserted', contactsToInsert.length, 'contacts for follow-up', followUp.id)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Follow-up contacts processed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ [ERROR] Error processing follow-ups:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
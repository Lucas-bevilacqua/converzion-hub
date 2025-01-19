import "https://deno.land/x/xhr@0.1.0/mod.ts"
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
    const currentTimestamp = new Date().toISOString()
    console.log(`🚀 Starting follow-up contacts processing at: ${currentTimestamp}`)
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('📝 Initialized Supabase client')

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
      console.error('❌ Error fetching follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log(`✅ Found ${followUps?.length || 0} active follow-ups`)

    // Log de execução na tabela cron_logs
    const { error: logError } = await supabase
      .from('cron_logs')
      .insert([
        {
          job_name: 'get-follow-up-contacts-job',
          status: 'executed',
          execution_time: new Date().toISOString()
        }
      ])

    if (logError) {
      console.error('❌ Error logging execution:', logError)
    }

    if (!followUps?.length) {
      console.log('ℹ️ No active follow-ups found')
      return new Response(
        JSON.stringify({ 
          success: true,
          timestamp: currentTimestamp,
          message: 'No active follow-ups found',
          processed: [],
          errors: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const processedFollowUps = []
    const errors = []

    for (const followUp of followUps) {
      try {
        if (!followUp.instance?.id) {
          console.log(`⚠️ Follow-up ${followUp.id} has no associated instance`)
          continue
        }

        console.log(`📝 Processing follow-up: { id: "${followUp.id}", instanceId: "${followUp.instance?.name}" }`)

        // Verificar se há mensagens configuradas
        if (followUp.follow_up_type === 'manual' && (!followUp.manual_messages?.length)) {
          console.log(`⚠️ No manual messages configured for follow-up: ${followUp.id}`)
          continue
        }

        // Buscar contatos que precisam de follow-up
        const { data: contacts, error: contactsError } = await supabase
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .not('TelefoneClientes', 'is', null)

        if (contactsError) {
          console.error('❌ Error fetching contacts:', contactsError)
          throw contactsError
        }

        console.log(`📊 Found ${contacts?.length || 0} contacts to process for instance ${followUp.instance?.name}`)

        if (!contacts?.length) {
          console.log('⚠️ No contacts found for follow-up')
          continue
        }

        // Verificar última mensagem
        const { data: lastMessage, error: messageError } = await supabase
          .from('chat_messages')
          .select('created_at')
          .eq('instance_id', followUp.instance_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (messageError && !messageError.message.includes('No rows found')) {
          console.error('❌ Error fetching last message:', messageError)
          throw messageError
        }

        if (lastMessage) {
          const lastMessageTime = new Date(lastMessage.created_at)
          const delayMinutes = followUp.delay_minutes || 60
          const nextMessageTime = new Date(lastMessageTime.getTime() + delayMinutes * 60000)

          console.log(`⏰ Last message time: ${lastMessageTime.toISOString()}`)
          console.log(`⏰ Next message time: ${nextMessageTime.toISOString()}`)
          console.log(`⏰ Current time: ${new Date().toISOString()}`)

          if (nextMessageTime > new Date()) {
            console.log('⏳ Waiting for delay time to pass')
            continue
          }
        }

        processedFollowUps.push({
          followUpId: followUp.id,
          instanceId: followUp.instance_id,
          contactsCount: contacts.length,
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        console.error('❌ Error processing follow-up:', error)
        errors.push({
          followUpId: followUp.id,
          error: error.message,
          timestamp: new Date().toISOString()
        })
      }
    }

    console.log(`✅ Finished processing. Success: ${processedFollowUps.length}, Errors: ${errors.length}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        timestamp: currentTimestamp,
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
        timestamp: new Date().toISOString(),
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
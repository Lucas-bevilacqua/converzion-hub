import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 Starting follow-up contacts function')
  
  if (req.method === 'OPTIONS') {
    console.log('👋 Handling CORS preflight request')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const currentTimestamp = new Date().toISOString()
    console.log(`⏰ Current timestamp: ${currentTimestamp}`)
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration')
    }

    console.log('🔑 Initializing Supabase client')
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Log execution start
    console.log('📝 Logging execution start')
    const { error: logError } = await supabase
      .from('cron_logs')
      .insert([{
        job_name: 'get-follow-up-contacts-job',
        status: 'started',
        execution_time: currentTimestamp
      }])

    if (logError) {
      console.error('❌ Error logging execution:', logError)
    }

    // Fetch active follow-ups
    console.log('🔍 Fetching active follow-ups')
    const { data: followUps, error: followUpsError } = await supabase
      .from('instance_follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id,
          name,
          user_id,
          phone_number,
          connection_status
        )
      `)
      .eq('is_active', true)

    if (followUpsError) {
      console.error('❌ Error fetching follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log(`✅ Found ${followUps?.length || 0} active follow-ups`)
    console.log('📊 Active follow-ups:', followUps)

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
        console.log(`🔄 Processing follow-up ID: ${followUp.id}`)
        
        if (!followUp.instance?.id) {
          console.log(`⚠️ Follow-up ${followUp.id} has no associated instance`)
          continue
        }

        // Check instance connection
        if (followUp.instance.connection_status !== 'connected') {
          console.log(`⚠️ Instance ${followUp.instance.name} is not connected. Status: ${followUp.instance.connection_status}`)
          continue
        }

        // Check message configuration
        if (followUp.follow_up_type === 'manual' && (!followUp.manual_messages?.length)) {
          console.log(`⚠️ No manual messages configured for follow-up: ${followUp.id}`)
          continue
        }

        // Fetch contacts
        console.log(`🔍 Fetching contacts for instance: ${followUp.instance.name}`)
        const { data: contacts, error: contactsError } = await supabase
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .not('TelefoneClientes', 'is', null)

        if (contactsError) {
          console.error('❌ Error fetching contacts:', contactsError)
          throw contactsError
        }

        console.log(`📊 Found ${contacts?.length || 0} contacts for instance ${followUp.instance.name}`)

        if (!contacts?.length) {
          console.log('⚠️ No contacts found for follow-up')
          continue
        }

        // Check last message timing
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
          const currentTime = new Date()

          console.log(`⏰ Last message time: ${lastMessageTime.toISOString()}`)
          console.log(`⏰ Next message time: ${nextMessageTime.toISOString()}`)
          console.log(`⏰ Current time: ${currentTime.toISOString()}`)

          if (nextMessageTime > currentTime) {
            console.log('⏳ Waiting for delay time to pass')
            continue
          }
        }

        // Process follow-up
        console.log('🚀 Calling process-follow-up function')
        const processingResponse = await fetch(
          'https://vodexhppkasbulogmcqb.supabase.co/functions/v1/process-follow-up',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              followUpId: followUp.id,
              instanceId: followUp.instance_id,
              contacts: contacts
            })
          }
        )

        if (!processingResponse.ok) {
          throw new Error(`Failed to process follow-up: ${await processingResponse.text()}`)
        }

        console.log('✅ Successfully processed follow-up')
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

    // Log completion
    await supabase
      .from('cron_logs')
      .insert([{
        job_name: 'get-follow-up-contacts-job',
        status: 'completed',
        execution_time: new Date().toISOString()
      }])

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
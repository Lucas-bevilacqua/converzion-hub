import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const requestId = crypto.randomUUID()
  console.log(`[${requestId}] 🚀 Starting get-follow-up-contacts function`)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Log initial details
    const startTime = new Date().toISOString()
    console.log(`[${requestId}] 📝 Execution started at ${startTime}`)
    
    // Register execution start
    const { error: logError } = await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'started',
        execution_time: startTime,
        details: 'Starting follow-up contacts search',
        details_json: { request_id: requestId }
      })

    if (logError) {
      console.error(`[${requestId}] ❌ Error logging start:`, logError)
    }

    // Fetch active follow-ups
    console.log(`[${requestId}] 🔍 Fetching active follow-ups`)
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
      throw new Error(`Error fetching follow-ups: ${followUpsError.message}`)
    }

    console.log(`[${requestId}] ✅ Found ${followUps?.length || 0} active follow-ups`)

    const processedFollowUps = []
    const errors = []

    for (const followUp of (followUps || [])) {
      try {
        console.log(`[${requestId}] 📱 Processing follow-up for instance: ${followUp.instance?.name}`)
        
        if (!followUp.instance?.connection_status || followUp.instance.connection_status !== 'connected') {
          console.log(`[${requestId}] ⚠️ Instance ${followUp.instance?.name} not connected, skipping`)
          continue
        }

        // Fetch contacts
        console.log(`[${requestId}] 🔍 Fetching contacts for instance: ${followUp.instance.name}`)
        const { data: contacts, error: contactsError } = await supabaseClient
          .from('Users_clientes')
          .select('*')
          .eq('NomeDaEmpresa', followUp.instance_id)
          .not('TelefoneClientes', 'is', null)
          .order('last_message_time', { ascending: true, nullsFirst: true })

        if (contactsError) {
          throw new Error(`Error fetching contacts: ${contactsError.message}`)
        }

        console.log(`[${requestId}] 📊 Found ${contacts?.length || 0} contacts for instance ${followUp.instance.name}`)

        for (const contact of (contacts || [])) {
          try {
            console.log(`[${requestId}] 👤 Processing contact: ${contact.TelefoneClientes}`)
            
            const processFollowUpUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-follow-up`
            
            console.log(`[${requestId}] 🔄 Sending request to ${processFollowUpUrl}`)
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
              const errorText = await processingResponse.text()
              throw new Error(`Error processing follow-up: ${errorText}`)
            }

            const responseData = await processingResponse.json()
            console.log(`[${requestId}] ✅ Follow-up processed:`, responseData)

            processedFollowUps.push({
              followUpId: followUp.id,
              instanceId: followUp.instance_id,
              contactId: contact.id,
              timestamp: new Date().toISOString()
            })

          } catch (contactError) {
            console.error(`[${requestId}] ❌ Failed to process contact ${contact.id}:`, contactError)
            errors.push({
              followUpId: followUp.id,
              contactId: contact.id,
              error: contactError.message,
              timestamp: new Date().toISOString()
            })
          }
        }
      } catch (error) {
        console.error(`[${requestId}] ❌ Failed to process follow-up ${followUp.id}:`, error)
        errors.push({
          followUpId: followUp.id,
          error: error.message,
          timestamp: new Date().toISOString()
        })
      }
    }

    // Log completion
    const endTime = new Date().toISOString()
    const finalLog = {
      request_id: requestId,
      processed: processedFollowUps.length,
      errors: errors.length,
      startTime,
      endTime,
      duration: new Date(endTime).getTime() - new Date(startTime).getTime()
    }
    
    console.log(`[${requestId}] 📝 Execution completed:`, finalLog)
    
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'completed',
        execution_time: endTime,
        details: 'Follow-up contacts processing completed',
        details_json: finalLog
      })

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedFollowUps,
        errors,
        startTime,
        endTime,
        request_id: requestId
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error(`[${requestId}] ❌ Critical error:`, error)
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    await supabase
      .from('cron_logs')
      .insert({
        job_name: 'get-follow-up-contacts',
        status: 'error',
        execution_time: new Date().toISOString(),
        details: 'Function execution failed',
        details_json: {
          request_id: requestId,
          error: error.message,
          stack: error.stack
        }
      })

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        request_id: requestId,
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
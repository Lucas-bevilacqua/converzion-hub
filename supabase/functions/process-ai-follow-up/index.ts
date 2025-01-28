import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_RETRIES = 3
const INITIAL_DELAY = 1000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function retryOperation<T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = INITIAL_DELAY
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (retries > 0) {
      console.log(`🔄 [DEBUG] Retrying operation, ${retries} attempts remaining, waiting ${delay}ms`)
      await sleep(delay)
      return retryOperation(operation, retries - 1, delay * 2)
    }
    throw error
  }
}

serve(async (req) => {
  const executionId = crypto.randomUUID()
  console.log(`[${executionId}] 🚀 Starting AI follow-up processing`)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get active AI follow-ups
    const { data: followUps, error: followUpsError } = await supabaseClient
      .from('follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id,
          name,
          user_id,
          connection_status,
          system_prompt
        )
      `)
      .eq('type', 'ai')
      .eq('status', 'pending')
      .order('created_at')

    if (followUpsError) {
      throw followUpsError
    }

    console.log(`✅ [DEBUG] Found ${followUps?.length || 0} AI follow-ups to process`)

    const results = []

    for (const followUp of followUps || []) {
      try {
        if (!followUp.instance?.connection_status?.toLowerCase().includes('connected')) {
          console.log(`⚠️ [DEBUG] Instance ${followUp.instance?.name} is not connected, skipping`)
          continue
        }

        // Get eligible contacts
        const { data: contacts, error: contactsError } = await retryOperation(async () => {
          return await supabaseClient
            .from('follow_up_contacts')
            .select('*')
            .eq('follow_up_id', followUp.id)
            .eq('status', 'pending')
        })

        if (contactsError) {
          throw contactsError
        }

        console.log(`✅ [DEBUG] Found ${contacts?.length || 0} contacts to process`)

        // Process each contact
        for (const contact of contacts || []) {
          try {
            console.log(`🔄 [DEBUG] Processing contact:`, contact)

            // Generate AI message
            const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  { 
                    role: 'system', 
                    content: followUp.settings?.system_prompt || "You are a helpful assistant that generates natural follow-up messages." 
                  },
                  { 
                    role: 'user', 
                    content: 'Please generate an appropriate follow-up message for this conversation.' 
                  }
                ],
                temperature: 0.7,
              }),
            })

            if (!openAiResponse.ok) {
              const errorText = await openAiResponse.text()
              throw new Error(`OpenAI error: ${errorText}`)
            }

            const aiData = await openAiResponse.json()
            const message = aiData.choices[0].message.content

            // Send message through Evolution API
            const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '')
            const evolutionApiEndpoint = `${evolutionApiUrl}/message/sendText/${followUp.instance.name}`

            console.log(`📤 [DEBUG] Sending to Evolution API:`, {
              endpoint: evolutionApiEndpoint,
              phone: contact.phone,
              message: message
            })

            const response = await fetch(evolutionApiEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
              },
              body: JSON.stringify({
                number: contact.phone,
                text: message
              })
            })

            if (!response.ok) {
              throw new Error(`Evolution API error: ${await response.text()}`)
            }

            // Update contact status
            const { error: updateError } = await supabaseClient
              .from('follow_up_contacts')
              .update({ 
                status: 'sent',
                sent_at: new Date().toISOString()
              })
              .eq('id', contact.id)

            if (updateError) {
              throw new Error(`Failed to update contact status: ${updateError.message}`)
            }

            // Wait for configured delay before next message
            const delayMinutes = followUp.settings?.delay_minutes || 60
            if (delayMinutes > 0) {
              console.log(`⏳ [DEBUG] Waiting ${delayMinutes} minutes before next message`)
              await new Promise(resolve => setTimeout(resolve, delayMinutes * 60 * 1000))
            }

            results.push({
              followUpId: followUp.id,
              contactId: contact.id,
              status: 'success'
            })

          } catch (error) {
            console.error(`❌ [DEBUG] Error processing contact ${contact.id}:`, error)
            results.push({
              followUpId: followUp.id,
              contactId: contact.id,
              status: 'error',
              error: error.message
            })
          }
        }

        // Update follow-up status if all contacts processed
        if (contacts?.length === 0) {
          const { error: updateError } = await supabaseClient
            .from('follow_ups')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', followUp.id)

          if (updateError) {
            throw new Error(`Failed to update follow-up status: ${updateError.message}`)
          }
        }

      } catch (error) {
        console.error(`❌ [DEBUG] Error processing follow-up ${followUp.id}:`, error)
        results.push({
          followUpId: followUp.id,
          status: 'error',
          error: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        results,
        executionId
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error(`❌ [DEBUG] Fatal error:`, error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        executionId
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
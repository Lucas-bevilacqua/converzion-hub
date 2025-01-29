import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;
const MIN_DELAY_MINUTES = 5;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  const executionId = crypto.randomUUID()
  console.log(`[${executionId}] 🚀 Starting AI follow-up processing`)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { followUpId } = await req.json()
    
    if (!followUpId) {
      throw new Error('Follow-up ID is required')
    }

    console.log(`[${executionId}] 🔍 Processing follow-up ID: ${followUpId}`)

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get follow-up details
    const { data: followUp, error: followUpError } = await supabaseClient
      .from('follow_ups')
      .select(`
        *,
        instance:evolution_instances(
          id,
          name,
          connection_status,
          system_prompt
        )
      `)
      .eq('id', followUpId)
      .single()

    if (followUpError) {
      console.error(`[${executionId}] ❌ Error fetching follow-up:`, followUpError)
      throw followUpError
    }

    if (!followUp) {
      throw new Error('Follow-up not found')
    }

    console.log(`[${executionId}] ✅ Follow-up details:`, {
      type: followUp.type,
      status: followUp.status,
      instanceStatus: followUp.instance?.connection_status
    })

    if (!followUp.instance?.connection_status?.toLowerCase().includes('connected')) {
      throw new Error('Instance is not connected')
    }

    // Get pending contacts
    const { data: contacts, error: contactsError } = await supabaseClient
      .from('follow_up_contacts')
      .select('*')
      .eq('follow_up_id', followUpId)
      .eq('status', 'pending')
      .is('sent_at', null)
      .order('created_at')
      .limit(10)

    if (contactsError) {
      console.error(`[${executionId}] ❌ Error fetching contacts:`, contactsError)
      throw contactsError
    }

    console.log(`[${executionId}] 📱 Processing ${contacts?.length || 0} contacts`)

    const results = []

    for (const contact of contacts || []) {
      let retries = MAX_RETRIES
      let delay = INITIAL_DELAY
      let success = false

      while (retries > 0 && !success) {
        try {
          console.log(`[${executionId}] 🤖 Generating AI message for contact:`, {
            id: contact.id,
            phone: contact.phone
          })

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
                  content: followUp.instance.system_prompt || "Você é um assistente que gera mensagens de follow-up naturais e amigáveis." 
                },
                { 
                  role: 'user', 
                  content: `Por favor, gere uma mensagem de follow-up apropriada para ${contact.metadata?.contact_name || 'o cliente'}. 
                           A última interação foi em ${new Date(contact.metadata?.last_message_time || '').toLocaleString()}.` 
                }
              ],
              temperature: 0.7,
            }),
          })

          if (!openAiResponse.ok) {
            const errorText = await openAiResponse.text()
            console.error(`[${executionId}] ❌ OpenAI error:`, errorText)
            throw new Error(`OpenAI error: ${errorText}`)
          }

          const aiData = await openAiResponse.json()
          const message = aiData.choices[0].message.content

          console.log(`[${executionId}] ✅ Generated message:`, message)

          // Send message through Evolution API
          const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '')
          const evolutionApiEndpoint = `${evolutionApiUrl}/message/sendText/${followUp.instance.name}`

          console.log(`[${executionId}] 📤 Sending message to:`, {
            endpoint: evolutionApiEndpoint,
            phone: contact.phone
          })

          const response = await fetch(evolutionApiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
            },
            body: JSON.stringify({
              number: contact.phone,
              options: {
                delay: MIN_DELAY_MINUTES * 60 * 1000,
                presence: "composing"
              },
              textMessage: {
                text: message
              }
            })
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error(`[${executionId}] ❌ Evolution API error:`, errorText)
            throw new Error(`Evolution API error: ${errorText}`)
          }

          console.log(`[${executionId}] ✅ Message sent successfully`)

          // Update contact status
          const { error: updateError } = await supabaseClient
            .from('follow_up_contacts')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', contact.id)

          if (updateError) {
            console.error(`[${executionId}] ❌ Error updating contact:`, updateError)
            throw updateError
          }

          success = true
          results.push({
            contactId: contact.id,
            status: 'success'
          })

        } catch (error) {
          console.error(`[${executionId}] ❌ Error processing contact (Attempt ${MAX_RETRIES - retries + 1}):`, error)
          retries--
          
          if (retries > 0) {
            console.log(`[${executionId}] 🔄 Retrying in ${delay}ms...`)
            await sleep(delay)
            delay *= 2
          } else {
            results.push({
              contactId: contact.id,
              status: 'error',
              error: error.message
            })
          }
        }
      }

      // Add delay between contacts
      if (contacts.length > 1) {
        await sleep(MIN_DELAY_MINUTES * 60 * 1000)
      }
    }

    // Check if all contacts have been processed
    const { data: pendingContacts } = await supabaseClient
      .from('follow_up_contacts')
      .select('id')
      .eq('follow_up_id', followUpId)
      .eq('status', 'pending')
      .is('sent_at', null)

    if (!pendingContacts?.length) {
      console.log(`[${executionId}] ✅ All contacts processed, updating follow-up status`)
      
      const { error: updateError } = await supabaseClient
        .from('follow_ups')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', followUpId)

      if (updateError) {
        console.error(`[${executionId}] ❌ Error updating follow-up status:`, updateError)
        throw updateError
      }
    }

    console.log(`[${executionId}] ✅ Processing completed successfully`)

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
    console.error(`[${executionId}] ❌ Fatal error:`, error)
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
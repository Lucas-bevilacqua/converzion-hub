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
      console.error('❌ [ERROR] Error fetching follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log(`✅ [DEBUG] Found ${followUps?.length || 0} AI follow-ups to process`)

    const results = []

    for (const followUp of followUps || []) {
      try {
        console.log(`🔄 [DEBUG] Processing follow-up ${followUp.id}:`, {
          type: followUp.type,
          instanceStatus: followUp.instance?.connection_status,
          settings: followUp.settings
        })

        if (!followUp.instance?.connection_status?.toLowerCase().includes('connected')) {
          console.log(`⚠️ [DEBUG] Instance ${followUp.instance?.name} is not connected, skipping`)
          continue
        }

        // Get eligible contacts that haven't been processed yet
        const { data: contacts, error: contactsError } = await supabaseClient
          .from('follow_up_contacts')
          .select('*')
          .eq('follow_up_id', followUp.id)
          .eq('status', 'pending')
          .is('sent_at', null)
          .order('created_at')
          .limit(10) // Process in batches

        if (contactsError) {
          console.error('❌ [ERROR] Error fetching contacts:', contactsError)
          throw contactsError
        }

        console.log(`✅ [DEBUG] Found ${contacts?.length || 0} contacts to process for follow-up ${followUp.id}`)

        // Process each contact with retries
        for (const contact of contacts || []) {
          let retries = MAX_RETRIES;
          let delay = INITIAL_DELAY;
          let success = false;

          while (retries > 0 && !success) {
            try {
              console.log(`🔄 [DEBUG] Processing contact (Attempt ${MAX_RETRIES - retries + 1}):`, {
                id: contact.id,
                phone: contact.phone,
                metadata: contact.metadata
              })

              // Generate AI message using system prompt from instance
              const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'gpt-4',
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
                console.error('❌ [ERROR] OpenAI error:', errorText)
                throw new Error(`OpenAI error: ${errorText}`)
              }

              const aiData = await openAiResponse.json()
              const message = aiData.choices[0].message.content

              console.log(`✅ [DEBUG] Generated AI message:`, message)

              // Send message through Evolution API - mantendo o número com 55
              const evolutionApiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '')
              const evolutionApiEndpoint = `${evolutionApiUrl}/message/sendText/${followUp.instance.name}`

              console.log(`📱 [DEBUG] Using phone number:`, contact.phone)

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
                  options: {
                    delay: MIN_DELAY_MINUTES * 60 * 1000, // Convertendo minutos para milissegundos
                    presence: "composing"
                  },
                  textMessage: {
                    text: message
                  }
                })
              })

              if (!response.ok) {
                const errorText = await response.text()
                console.error('❌ [ERROR] Evolution API error:', errorText)
                throw new Error(`Evolution API error: ${errorText}`)
              }

              const evolutionResponse = await response.json()
              console.log('✅ [DEBUG] Evolution API response:', evolutionResponse)

              // Update contact status
              const { error: updateError } = await supabaseClient
                .from('follow_up_contacts')
                .update({ 
                  status: 'sent',
                  sent_at: new Date().toISOString()
                })
                .eq('id', contact.id)

              if (updateError) {
                console.error('❌ [ERROR] Error updating contact:', updateError)
                throw updateError
              }

              console.log(`✅ [DEBUG] Successfully processed contact ${contact.id}`)
              success = true;

              results.push({
                followUpId: followUp.id,
                contactId: contact.id,
                status: 'success'
              })

            } catch (error) {
              console.error(`❌ [ERROR] Error processing contact ${contact.id} (Attempt ${MAX_RETRIES - retries + 1}):`, error)
              retries--;
              
              if (retries > 0) {
                console.log(`🔄 [DEBUG] Retrying in ${delay}ms...`)
                await sleep(delay);
                delay *= 2; // Exponential backoff
              } else {
                results.push({
                  followUpId: followUp.id,
                  contactId: contact.id,
                  status: 'error',
                  error: error.message
                })
              }
            }
          }

          // Add delay between contacts
          if (contacts.length > 1) {
            await sleep(MIN_DELAY_MINUTES * 60 * 1000);
          }
        }

        // Check if all contacts have been processed
        const { data: pendingContacts } = await supabaseClient
          .from('follow_up_contacts')
          .select('id')
          .eq('follow_up_id', followUp.id)
          .eq('status', 'pending')
          .is('sent_at', null)

        if (!pendingContacts?.length) {
          // Update follow-up status to completed
          const { error: updateError } = await supabaseClient
            .from('follow_ups')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', followUp.id)

          if (updateError) {
            console.error('❌ [ERROR] Error updating follow-up status:', updateError)
            throw updateError
          }

          console.log(`✅ [DEBUG] Follow-up ${followUp.id} completed successfully`)
        }

      } catch (error) {
        console.error(`❌ [ERROR] Error processing follow-up ${followUp.id}:`, error)
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
    console.error(`❌ [ERROR] Fatal error:`, error)
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
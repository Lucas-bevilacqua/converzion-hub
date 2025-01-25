import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface WebhookRequest {
  followUpId: string
  instanceId: string
  testPhoneNumber?: string
  executeFullSequence?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { followUpId, instanceId, testPhoneNumber, executeFullSequence } = await req.json() as WebhookRequest

    console.log('🔄 Testing follow-up:', { followUpId, instanceId, testPhoneNumber, executeFullSequence })

    if (!followUpId || !instanceId) {
      throw new Error('Missing required parameters')
    }

    if (!testPhoneNumber) {
      throw new Error('Test phone number is required')
    }

    // Format phone number - remove any non-numeric characters
    const formattedPhone = testPhoneNumber.replace(/[^0-9]/g, '')
    if (formattedPhone.length < 10) {
      throw new Error('Invalid phone number format')
    }

    // Get follow-up data with messages
    const { data: followUp, error: followUpError } = await supabaseClient
      .from('follow_ups')
      .select(`
        *,
        instance:evolution_instances (
          id,
          name,
          connection_status
        )
      `)
      .eq('id', followUpId)
      .single()

    if (followUpError) {
      console.error('Error fetching follow-up:', followUpError)
      throw followUpError
    }

    if (!followUp) {
      throw new Error('Follow-up not found')
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabaseClient
      .from('follow_up_messages')
      .select('*')
      .eq('follow_up_id', followUpId)
      .order('delay_minutes', { ascending: true })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      throw messagesError
    }

    if (!messages || messages.length === 0) {
      throw new Error('No messages found for this follow-up')
    }

    // Check connection status
    const status = (followUp.instance?.connection_status || '').toLowerCase()
    const isConnected = status === 'connected' || 
                       status === 'open' || 
                       status.includes('open') ||
                       status.includes('connected')

    console.log('Connection status check:', {
      rawStatus: followUp.instance?.connection_status,
      normalizedStatus: status,
      isConnected,
      instanceName: followUp.instance?.name,
      testPhoneNumber: formattedPhone
    })

    if (!isConnected) {
      throw new Error('Instance is not connected')
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/, '')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API configuration missing')
    }

    console.log('Evolution API configuration:', {
      url: evolutionApiUrl,
      hasKey: !!evolutionApiKey,
      instanceName: followUp.instance?.name
    })

    if (executeFullSequence) {
      try {
        // Check if contact already exists to avoid duplicates
        const { data: existingContact } = await supabaseClient
          .from('follow_up_contacts')
          .select('*')
          .eq('follow_up_id', followUpId)
          .eq('phone', formattedPhone)
          .single()

        if (!existingContact) {
          // Insert test contact with correct initial status
          const { error: contactError } = await supabaseClient
            .from('follow_up_contacts')
            .insert({
              follow_up_id: followUpId,
              phone: formattedPhone,
              status: 'pending',
              metadata: { 
                is_test: true,
                contact_name: 'Test Contact',
                last_message_time: new Date().toISOString()
              }
            })

          if (contactError) {
            throw new Error(`Failed to create test contact: ${contactError.message}`)
          }
        }

        console.log('✅ Test contact created/verified successfully')

        // Send initial confirmation
        const confirmationResponse = await fetch(`${evolutionApiUrl}/message/sendText/${followUp.instance?.name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: `[TESTE DE FOLLOW-UP]\n\nIniciando sequência de follow-up...\n\nVocê receberá ${messages.length} mensagens com os intervalos configurados:\n\n${messages.map((msg, index) => 
              `${index + 1}. Em ${msg.delay_minutes} minutos`
            ).join('\n')}`,
          }),
        })

        if (!confirmationResponse.ok) {
          const errorText = await confirmationResponse.text()
          console.error('Error sending confirmation:', errorText)
          throw new Error(`Failed to send confirmation: ${errorText}`)
        }

        console.log('✅ Initial confirmation sent successfully')

        // Send first message immediately
        const firstMessageResponse = await fetch(`${evolutionApiUrl}/message/sendText/${followUp.instance?.name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: messages[0].message
          }),
        })

        if (!firstMessageResponse.ok) {
          const errorText = await firstMessageResponse.text()
          console.error('Error sending first message:', errorText)
          throw new Error(`Failed to send first message: ${errorText}`)
        }

        console.log('✅ First message sent successfully')

        // Schedule remaining messages
        for (let i = 1; i < messages.length; i++) {
          const message = messages[i]
          const delay = message.delay_minutes * 60000 // Convert to milliseconds
          
          setTimeout(async () => {
            try {
              console.log(`🔄 Sending message ${i + 1} after ${message.delay_minutes} minutes`)
              
              // Check if we should still send the message (no reply received)
              const { data: contact } = await supabaseClient
                .from('follow_up_contacts')
                .select('*')
                .eq('follow_up_id', followUpId)
                .eq('phone', formattedPhone)
                .single()

              if (contact?.reply_at) {
                console.log('⚠️ Contact has replied, stopping sequence')
                return
              }
              
              const response = await fetch(`${evolutionApiUrl}/message/sendText/${followUp.instance?.name}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': evolutionApiKey,
                },
                body: JSON.stringify({
                  number: formattedPhone,
                  text: message.message
                }),
              })

              if (!response.ok) {
                console.error(`Failed to send message ${i + 1}:`, await response.text())
              } else {
                console.log(`✅ Message ${i + 1} sent successfully`)
                
                // Update sent_at timestamp
                await supabaseClient
                  .from('follow_up_contacts')
                  .update({
                    sent_at: new Date().toISOString()
                  })
                  .eq('follow_up_id', followUpId)
                  .eq('phone', formattedPhone)
              }
            } catch (error) {
              console.error(`Error sending message ${i + 1}:`, error)
            }
          }, delay)
        }

      } catch (error) {
        console.error('Error in Evolution API communication:', error)
        throw new Error(`Evolution API error: ${error.message}`)
      }

    } else {
      // Send preview message only
      try {
        const previewResponse = await fetch(`${evolutionApiUrl}/message/sendText/${followUp.instance?.name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: `[TESTE DE FOLLOW-UP]\n\nMensagens configuradas:\n\n${messages.map((msg, index) => 
              `${index + 1}. Após ${msg.delay_minutes} minutos:\n${msg.message}`
            ).join('\n\n')}`,
          }),
        })

        if (!previewResponse.ok) {
          const errorText = await previewResponse.text()
          console.error('Error sending preview:', errorText)
          throw new Error(`Failed to send preview: ${errorText}`)
        }
      } catch (error) {
        console.error('Error in Evolution API communication:', error)
        throw new Error(`Evolution API error: ${error.message}`)
      }
    }

    console.log('✅ Test sequence initiated successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        message: executeFullSequence ? 'Full sequence initiated' : 'Test message sent successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in test-follow-up-system:', error)

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
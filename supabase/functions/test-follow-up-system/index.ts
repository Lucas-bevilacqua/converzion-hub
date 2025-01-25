import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface WebhookRequest {
  followUpId: string
  instanceId: string
  testPhoneNumber?: string // Add optional phone number for testing
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get request body
    const { followUpId, instanceId, testPhoneNumber } = await req.json() as WebhookRequest

    console.log('🔄 Testing follow-up:', { followUpId, instanceId, testPhoneNumber })

    // Validate input
    if (!followUpId || !instanceId) {
      throw new Error('Missing required parameters')
    }

    if (!testPhoneNumber) {
      throw new Error('Test phone number is required')
    }

    // Get follow-up data
    const { data: followUp, error: followUpError } = await supabaseClient
      .from('follow_ups')
      .select('*, instance:evolution_instances(*)')
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

    // Get instance data to send test message
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (instanceError) {
      console.error('Error fetching instance:', instanceError)
      throw instanceError
    }

    if (!instance) {
      throw new Error('Instance not found')
    }

    // Check connection status properly
    const status = (instance.connection_status || '').toLowerCase()
    const isConnected = status === 'connected' || 
                       status === 'open' || 
                       status.includes('open') ||
                       status.includes('connected')

    console.log('Connection status check:', {
      rawStatus: instance.connection_status,
      normalizedStatus: status,
      isConnected,
      instanceName: instance.name,
      testPhoneNumber
    })

    if (!isConnected) {
      throw new Error('Instance is not connected')
    }

    // Log test execution
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'test-follow-up',
        status: 'started',
        details: `Testing follow-up ${followUpId} for instance ${instanceId}`,
        execution_time: new Date().toISOString()
      })

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/, '') // Remove trailing slash if present
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API configuration missing')
    }

    console.log('Sending test message to Evolution API:', {
      url: `${evolutionApiUrl}/message/sendText/${instance.name}`,
      phone: testPhoneNumber,
      messageCount: messages.length
    })

    // Send test message using Evolution API - ensure proper URL construction
    const evolutionResponse = await fetch(`${evolutionApiUrl}/message/sendText/${instance.name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({
        number: testPhoneNumber.replace(/[^0-9]/g, ''), // Remove non-numeric characters
        text: `[TESTE DE FOLLOW-UP]\n\nMensagens configuradas:\n\n${messages.map((msg, index) => 
          `${index + 1}. Após ${msg.delay_minutes} minutos:\n${msg.message}`
        ).join('\n\n')}`,
      }),
    })

    const responseText = await evolutionResponse.text()
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      responseData = responseText
    }

    console.log('Evolution API response:', {
      status: evolutionResponse.status,
      response: responseData,
      instance: instance.name
    })

    if (!evolutionResponse.ok) {
      throw new Error(`Failed to send test message: ${responseText}`)
    }

    // Log successful test
    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'test-follow-up',
        status: 'completed',
        details: `Successfully tested follow-up ${followUpId}`,
        execution_time: new Date().toISOString()
      })

    console.log('✅ Test message sent successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Test message sent successfully',
        details: responseData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in test-follow-up-system:', error)

    // Log error
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabaseClient
      .from('cron_logs')
      .insert({
        job_name: 'test-follow-up',
        status: 'error',
        details: `Error testing follow-up: ${error.message}`,
        execution_time: new Date().toISOString()
      })

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
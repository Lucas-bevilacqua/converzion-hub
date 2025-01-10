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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      console.error('User error:', userError)
      throw userError || new Error('User not found')
    }

    console.log('Checking subscription status for user:', user.id)

    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .or('status.eq.active,status.eq.trial')
      .maybeSingle()

    if (subError) {
      console.error('Error fetching subscription:', subError)
      throw subError
    }

    if (!subscription) {
      console.error('No active or trial subscription found for user:', user.id)
      return new Response(
        JSON.stringify({ error: 'Active or trial subscription required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { count, error: countError } = await supabaseClient
      .from('evolution_instances')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    if (countError) {
      console.error('Error counting instances:', countError)
      throw countError
    }

    const instanceLimit = subscription.plan_id?.includes('professional') ? 3 : 1
    if (count && count >= instanceLimit) {
      console.error('Instance limit reached for user:', user.id)
      return new Response(
        JSON.stringify({ error: `Instance limit (${instanceLimit}) reached for your plan` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { instanceName } = await req.json()
    console.log('Creating instance with name:', instanceName)

    // Create Dify agent first
    const difyApiUrl = Deno.env.get('DIFY_API_URL')
    const difyApiKey = Deno.env.get('DIFY_API_KEY')
    
    if (!difyApiUrl || !difyApiKey) {
      throw new Error('Dify configuration missing')
    }

    console.log('Creating Dify agent with URL:', `${difyApiUrl}/api/v1/apps`)
    const difyResponse = await fetch(`${difyApiUrl}/api/v1/apps`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `WhatsApp Assistant - ${instanceName}`,
        mode: "completion",
        model: {
          provider: "openai",
          name: "gpt-3.5-turbo",
          mode: "chat"
        }
      })
    })

    if (!difyResponse.ok) {
      const errorText = await difyResponse.text()
      console.error('Dify API error response:', {
        status: difyResponse.status,
        statusText: difyResponse.statusText,
        body: errorText
      })
      throw new Error(`Failed to create Dify agent: ${errorText}`)
    }

    const difyData = await difyResponse.json()
    console.log('Dify agent created:', difyData)

    // Create instance in Evolution API
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    if (!evolutionApiUrl) {
      throw new Error('Evolution API URL not configured')
    }

    const baseUrl = evolutionApiUrl.endsWith('/') 
      ? evolutionApiUrl.slice(0, -1) 
      : evolutionApiUrl

    console.log('Creating Evolution instance...')
    const evolutionResponse = await fetch(`${baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') ?? '',
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      })
    })

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text()
      console.error('Evolution API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to create Evolution API instance', details: errorText }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Configure Dify in Evolution instance
    console.log('Configuring Dify in Evolution instance...')
    const difyConfigResponse = await fetch(`${baseUrl}/instance/dify/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') ?? '',
      },
      body: JSON.stringify({
        enabled: true,
        apiKey: difyData.api_key,
        apiUrl: difyApiUrl,
        appId: difyData.id
      })
    })

    if (!difyConfigResponse.ok) {
      const errorText = await difyConfigResponse.text()
      console.error('Evolution Dify config error:', errorText)
      console.warn('Failed to configure Dify in Evolution:', errorText)
    } else {
      console.log('Dify configured in Evolution instance successfully')
    }

    // Save instance to database with Dify app ID
    const { data: instance, error: insertError } = await supabaseClient
      .from('evolution_instances')
      .insert({
        user_id: user.id,
        name: instanceName,
        connection_status: 'disconnected',
        dify_app_id: difyData.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting instance:', insertError)
      throw insertError
    }

    console.log('Instance created successfully:', instance)
    return new Response(
      JSON.stringify(instance),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in create-evolution-instance:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
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
      throw userError || new Error('User not found')
    }

    const { instanceId } = await req.json()
    console.log('Disconnecting instance:', instanceId)

    // Get instance details
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      throw instanceError || new Error('Instance not found')
    }

    // Call Evolution API to logout
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API configuration not found')
    }

    const baseUrl = evolutionApiUrl.replace(/\/+$/, '')
    const instanceName = encodeURIComponent(instance.name)
    
    console.log('Evolution API Base URL:', baseUrl)
    console.log('Instance Name:', instanceName)

    const logoutUrl = `${baseUrl}/instance/logout/${instanceName}`
    console.log('Logout URL:', logoutUrl)
    
    const evolutionResponse = await fetch(logoutUrl, {
      method: 'DELETE',
      headers: {
        'apikey': evolutionApiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text()
      console.error('Evolution API logout error:', errorText)
      throw new Error(`Evolution API returned status ${evolutionResponse.status}: ${errorText}`)
    }

    // Update instance status in database
    const { error: updateError } = await supabaseClient
      .from('evolution_instances')
      .update({
        connection_status: 'disconnected',
        qr_code: null,
        last_qr_update: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in disconnect-evolution-instance:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.cause || error.stack
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
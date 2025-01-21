import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { instanceId } = await req.json()
    console.log('Disconnecting instance:', instanceId)

    if (!instanceId) {
      throw new Error('Instance ID is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get instance details
    const { data: instance, error: instanceError } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      console.error('Error fetching instance:', instanceError)
      throw new Error('Instance not found')
    }

    // Call Evolution API to disconnect instance
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API configuration missing')
    }

    // Clean the base URL by removing trailing slashes
    const cleanBaseUrl = evolutionApiUrl.replace(/\/+$/, '')
    console.log('Calling Evolution API to disconnect instance:', instance.name)

    const logoutResponse = await fetch(`${cleanBaseUrl}/instance/logout/${instance.name}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      }
    })

    if (!logoutResponse.ok) {
      const error = await logoutResponse.text()
      console.error('Error disconnecting instance:', error)
      throw new Error(`Evolution API error: ${error}`)
    }

    // Update instance status in database
    const { error: updateError } = await supabase
      .from('evolution_instances')
      .update({
        connection_status: 'disconnected',
        qr_code: null,
        last_qr_update: null
      })
      .eq('id', instanceId)

    if (updateError) {
      console.error('Error updating instance status:', updateError)
      throw updateError
    }

    console.log('Instance disconnected successfully:', instanceId)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in disconnect-evolution-instance:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
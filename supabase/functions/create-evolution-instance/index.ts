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
    const { name, phone_number, userId } = await req.json()
    console.log('Creating instance:', { name, phone_number, userId })

    if (!name) {
      throw new Error('Instance name is required')
    }

    // Clean the base URL by removing trailing slashes
    const cleanBaseUrl = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/+$/, '')
    console.log('Clean base URL:', cleanBaseUrl)

    // Create instance in Evolution API
    const createInstanceResponse = await fetch(`${cleanBaseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('EVOLUTION_API_KEY') || ''
      },
      body: JSON.stringify({
        instanceName: name,
        qrcode: true,
        number: phone_number,
        token: Deno.env.get('EVOLUTION_API_KEY'),
        integration: "WHATSAPP-BAILEYS"
      })
    })

    if (!createInstanceResponse.ok) {
      const error = await createInstanceResponse.text()
      console.error('Error creating instance:', error)
      throw new Error(`Evolution API error: ${error}`)
    }

    const instanceData = await createInstanceResponse.json()
    console.log('Instance created successfully:', instanceData)

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Create instance in Supabase
    const { data: instance, error: dbError } = await supabase
      .from('evolution_instances')
      .insert({
        name: name,
        phone_number: phone_number,
        user_id: userId,
        status: 'disconnected'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error saving instance to database:', dbError)
      throw dbError
    }

    console.log('Instance saved to database:', instance)

    return new Response(
      JSON.stringify(instance),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        } 
      }
    )
  } catch (error) {
    console.error('Error in create-evolution-instance:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        } 
      }
    )
  }
})
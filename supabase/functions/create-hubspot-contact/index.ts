import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { name, email, phone, source } = await req.json()

    // Validate required fields
    if (!name || !email || !phone) {
      throw new Error('Missing required fields')
    }

    // HubSpot API endpoint
    const hubspotApiKey = Deno.env.get('HUBSPOT_API_KEY')
    if (!hubspotApiKey) {
      throw new Error('HubSpot API key not configured')
    }

    console.log('Creating HubSpot contact with data:', { name, email, phone, source })

    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hubspotApiKey}`,
      },
      body: JSON.stringify({
        properties: {
          firstname: name.split(' ')[0],
          lastname: name.split(' ').slice(1).join(' '),
          email: email,
          phone: phone,
          // Using a standard HubSpot property for lead source
          hs_lead_status: 'NEW',
          lifecyclestage: 'lead',
          // Store the source in a note instead
          hs_note_body: `Lead source: ${source}`
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('HubSpot API error response:', error)
      throw new Error(`HubSpot API error: ${error}`)
    }

    const result = await response.json()
    console.log('HubSpot contact created successfully:', result)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error creating HubSpot contact:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
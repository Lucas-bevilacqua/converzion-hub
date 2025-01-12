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

    // First create the contact
    const createContactResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
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
          hs_lead_status: 'NEW',
          lifecyclestage: 'lead'
        },
      }),
    })

    if (!createContactResponse.ok) {
      const error = await createContactResponse.text()
      console.error('HubSpot API error response:', error)
      throw new Error(`HubSpot API error: ${error}`)
    }

    const contact = await createContactResponse.json()
    console.log('HubSpot contact created successfully:', contact)

    // Then create a note for the contact with the source information
    const createNoteResponse = await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hubspotApiKey}`,
      },
      body: JSON.stringify({
        properties: {
          hs_timestamp: Date.now(),
          hs_note: `Lead source: ${source}`,
          hs_association_ids: [contact.id],
          hs_association_types: ["contact_to_note"]
        },
      }),
    })

    if (!createNoteResponse.ok) {
      console.error('Failed to create note, but contact was created:', await createNoteResponse.text())
      // Don't throw error here as the contact was successfully created
    } else {
      console.log('Note created successfully')
    }

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
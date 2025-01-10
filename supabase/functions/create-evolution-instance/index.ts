import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { name, phone_number, userId } = await req.json()
    console.log('Creating instance:', { name, phone_number, userId })

    // Criar instância na Evolution API
    const createInstanceResponse = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        instanceName: name,
        qrcode: true,
        number: phone_number,
        token: EVOLUTION_API_KEY
      })
    })

    if (!createInstanceResponse.ok) {
      const error = await createInstanceResponse.text()
      console.error('Error creating instance:', error)
      throw new Error(`Evolution API error: ${error}`)
    }

    const instanceData = await createInstanceResponse.json()
    console.log('Instance created successfully:', instanceData)

    // Configurar webhook para a instância usando a estrutura correta
    console.log('Configuring webhook for instance:', name)
    const webhookUrl = `${SUPABASE_URL}/functions/v1/chat-with-openai`
    const configureWebhookResponse = await fetch(`${EVOLUTION_API_URL}/webhook/set/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          headers: {
            'Content-Type': 'application/json'
          },
          byEvents: false,
          base64: false,
          events: [
            "APPLICATION_STARTUP",
            "QRCODE_UPDATED",
            "MESSAGES_SET",
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_DELETE",
            "SEND_MESSAGE",
            "CONTACTS_SET",
            "CONTACTS_UPSERT",
            "CONTACTS_UPDATE",
            "PRESENCE_UPDATE",
            "CHATS_SET",
            "CHATS_UPSERT",
            "CHATS_UPDATE",
            "CHATS_DELETE",
            "GROUPS_UPSERT",
            "GROUP_UPDATE",
            "GROUP_PARTICIPANTS_UPDATE",
            "CONNECTION_UPDATE",
            "LABELS_EDIT",
            "LABELS_ASSOCIATION",
            "CALL"
          ]
        }
      })
    })

    if (!configureWebhookResponse.ok) {
      const error = await configureWebhookResponse.text()
      console.error('Error configuring webhook:', error)
      throw new Error(`Error configuring webhook: ${error}`)
    }

    const webhookData = await configureWebhookResponse.json()
    console.log('Webhook configured successfully:', webhookData)

    // Criar instância no Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
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
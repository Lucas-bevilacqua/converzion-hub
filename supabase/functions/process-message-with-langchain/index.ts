import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('⚡ Process Message with LangChain function initialized')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { message, instanceId, phoneNumber } = await req.json()
    console.log('📩 Received request:', { message, instanceId, phoneNumber })

    if (!message || !instanceId || !phoneNumber) {
      console.error('❌ Missing required parameters')
      throw new Error('Message, instanceId and phoneNumber are required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔍 Fetching instance data...')
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*, profiles!inner(*)')
      .eq('id', instanceId)
      .single()

    if (instanceError) {
      console.error('❌ Error fetching instance:', instanceError)
      throw instanceError
    }

    console.log('✅ Instance fetched:', instance)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: instance.system_prompt || "You are a helpful AI assistant." 
          },
          { 
            role: 'user', 
            content: message 
          }
        ],
      }),
    })

    const data = await response.json()
    console.log('✅ OpenAI response:', data)

    const aiResponse = data.choices[0].message.content

    return new Response(
      JSON.stringify({ success: true, response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error processing message:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ChatOpenAI } from "https://esm.sh/@langchain/openai"
import { ChatPromptTemplate } from "https://esm.sh/@langchain/core/prompts"
import { StringOutputParser } from "https://esm.sh/@langchain/core/output_parsers"

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

    const model = new ChatOpenAI({
      openAIApiKey: Deno.env.get('OPENAI_API_KEY'),
      modelName: 'gpt-4',
      temperature: 0.7,
    })

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", instance.system_prompt || "You are a helpful AI assistant."],
      ["human", "{input}"]
    ])

    const chain = prompt.pipe(model).pipe(new StringOutputParser())

    console.log('🤖 Processing message with LangChain...')
    const response = await chain.invoke({
      input: message,
    })

    console.log('✅ LangChain response:', response)

    return new Response(
      JSON.stringify({ success: true, response }),
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
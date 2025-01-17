import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ChatOpenAI } from "https://esm.sh/@langchain/openai@0.0.14"
import { ConversationChain } from "https://esm.sh/langchain@0.0.214/chains"
import { BufferMemory } from "https://esm.sh/langchain@0.0.214/memory"
import { 
  ChatPromptTemplate, 
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
  MessagesPlaceholder 
} from "https://esm.sh/langchain@0.0.214/prompts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 LangChain Function Started')
  
  if (req.method === 'OPTIONS') {
    console.log('👉 Handling CORS preflight request')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('📥 Parsing request body...')
    const { message, instanceId, phoneNumber } = await req.json()
    console.log('✅ Request parameters:', { message, instanceId, phoneNumber })

    if (!message || !instanceId || !phoneNumber) {
      console.error('❌ Missing required parameters')
      throw new Error('Message, instanceId and phoneNumber are required')
    }

    console.log('🔄 Creating Supabase client...')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔍 Fetching instance configuration...')
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*, instance_follow_ups(*)')
      .eq('id', instanceId)
      .single()

    if (instanceError) {
      console.error('❌ Error fetching instance:', instanceError)
      throw instanceError
    }
    console.log('✅ Instance found:', instance)

    console.log('🤖 Configuring ChatOpenAI...')
    const chat = new ChatOpenAI({
      openAIApiKey: Deno.env.get('OPENAI_API_KEY'),
      modelName: 'gpt-4',
      temperature: 0.7,
    })
    console.log('✅ ChatOpenAI configured')

    console.log('📝 Setting up chat prompt template...')
    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
        instance.system_prompt || "Você é um assistente prestativo que ajuda com follow-ups."
      ),
      new MessagesPlaceholder("history"),
      HumanMessagePromptTemplate.fromTemplate("{input}")
    ])
    console.log('✅ Chat prompt template configured')

    console.log('💾 Configuring memory...')
    const memory = new BufferMemory({
      returnMessages: true,
      memoryKey: "history",
    })
    console.log('✅ Memory configured')

    console.log('⚡ Creating conversation chain...')
    const chain = new ConversationChain({
      memory: memory,
      prompt: chatPrompt,
      llm: chat,
    })
    console.log('✅ Conversation chain created')

    console.log('🤔 Generating response...')
    const response = await chain.call({
      input: message,
    })
    console.log('✅ Response generated:', response.response)

    console.log('📤 Sending response through Evolution API...')
    const evolutionResponse = await fetch(
      `${Deno.env.get('EVOLUTION_API_URL')}/message/sendText/${instance.name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': Deno.env.get('EVOLUTION_API_KEY') || '',
        },
        body: JSON.stringify({
          number: phoneNumber,
          text: response.response
        }),
      }
    )

    if (!evolutionResponse.ok) {
      const error = await evolutionResponse.text()
      console.error('❌ Evolution API error:', error)
      throw new Error(`Evolution API error: ${error}`)
    }
    console.log('✅ Evolution API response sent successfully')

    console.log('💾 Saving message to chat history...')
    const { error: saveError } = await supabaseClient
      .from('chat_messages')
      .insert([
        {
          instance_id: instanceId,
          user_id: instance.user_id,
          sender_type: 'assistant',
          content: response.response
        }
      ])

    if (saveError) {
      console.error('❌ Error saving message:', saveError)
      throw saveError
    }
    console.log('✅ Message saved to chat history')

    console.log('🎉 Function completed successfully')
    return new Response(
      JSON.stringify({ 
        success: true,
        response: response.response
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Function error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
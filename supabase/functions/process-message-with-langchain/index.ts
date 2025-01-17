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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { message, instanceId, phoneNumber } = await req.json()
    console.log('📨 Processing message:', { message, instanceId, phoneNumber })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar configurações da instância
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('*, instance_follow_ups(*)')
      .eq('id', instanceId)
      .single()

    if (instanceError) {
      console.error('❌ Error fetching instance:', instanceError)
      throw instanceError
    }

    // Configurar o modelo de chat
    const chat = new ChatOpenAI({
      openAIApiKey: Deno.env.get('OPENAI_API_KEY'),
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
    })

    // Configurar o template do prompt
    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
        instance.system_prompt || "Você é um assistente prestativo que ajuda com follow-ups."
      ),
      new MessagesPlaceholder("history"),
      HumanMessagePromptTemplate.fromTemplate("{input}")
    ])

    // Configurar a memória para manter contexto
    const memory = new BufferMemory({
      returnMessages: true,
      memoryKey: "history",
    })

    // Criar a chain de conversação
    const chain = new ConversationChain({
      memory: memory,
      prompt: chatPrompt,
      llm: chat,
    })

    // Gerar resposta
    console.log('🤖 Generating response...')
    const response = await chain.call({
      input: message,
    })

    // Enviar resposta via Evolution API
    console.log('📤 Sending response through Evolution API:', response.response)
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

    // Salvar mensagem no histórico
    console.log('💾 Saving message to chat history')
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

    return new Response(
      JSON.stringify({ 
        success: true,
        response: response.response
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error processing message:', error)
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
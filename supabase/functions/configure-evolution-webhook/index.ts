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
    const { instanceName } = await req.json()
    console.log('Configurando webhook para a instância:', instanceName)

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error('Configuração da Evolution API não encontrada')
    }

    // Limpa a URL base removendo barras extras
    const cleanBaseUrl = EVOLUTION_API_URL.replace(/\/+$/, '')
    
    // URL do webhook que receberá os eventos
    const webhookUrl = `${SUPABASE_URL}/functions/v1/evolution-webhook`
    
    // Configura o webhook na Evolution API usando a URL correta com o nome da instância
    const response = await fetch(`${cleanBaseUrl}/instance/${instanceName}/webhook/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        url: webhookUrl,
        enabled: true,
        events: [
          "messages.upsert",  // Evento de novas mensagens
          "connection.update" // Evento de atualização de conexão
        ]
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Erro ao configurar webhook:', error)
      throw new Error(`Erro na Evolution API: ${error}`)
    }

    const result = await response.json()
    console.log('Webhook configurado com sucesso:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro ao configurar webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
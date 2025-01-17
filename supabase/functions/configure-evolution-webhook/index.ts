import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('Configure Evolution Webhook function started')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response(null, { 
      headers: { ...corsHeaders }
    })
  }

  try {
    console.log('Processing webhook configuration request')
    const { instanceName, instanceId } = await req.json()
    
    if (!instanceName || !instanceId) {
      console.error('Parâmetros inválidos:', { instanceName, instanceId })
      throw new Error('Nome da instância e ID são obrigatórios')
    }

    console.log('Configurando webhook para:', { instanceName, instanceId })

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error('Configuração da Evolution API não encontrada')
      throw new Error('Configuração da Evolution API não encontrada')
    }

    // Limpa a URL base removendo barras extras
    const cleanBaseUrl = EVOLUTION_API_URL.replace(/\/+$/, '')
    
    // URL do webhook da Evolution API
    const webhookUrl = `${cleanBaseUrl}/webhook/evolution/${instanceId}`
    
    console.log('Configurando webhook:', {
      baseUrl: cleanBaseUrl,
      instanceName,
      webhookUrl
    })
    
    // Configura o webhook na Evolution API com todos os eventos necessários
    const response = await fetch(`${cleanBaseUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          base64: true,
          headers: {
            'Content-Type': 'application/json'
          },
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_DELETE",
            "SEND_MESSAGE",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
            "MESSAGES_SET"
          ]
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Erro ao configurar webhook na Evolution API:', error)
      throw new Error(`Erro na Evolution API: ${error}`)
    }

    const result = await response.json()
    console.log('Webhook configurado com sucesso:', result)

    // Faz uma chamada de teste para verificar se o webhook está funcionando
    console.log('Fazendo chamada de teste para o webhook...')
    const testResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: 'TEST',
        instance: {
          instanceName: instanceName
        },
        data: {
          test: true
        }
      })
    })

    console.log('Resposta do teste do webhook:', {
      status: testResponse.status,
      ok: testResponse.ok
    })

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
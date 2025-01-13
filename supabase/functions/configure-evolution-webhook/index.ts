import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../connect-evolution-instance/cors.ts"

const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')

console.log("Função de configuração de webhook iniciada")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { instanceName } = await req.json()

    if (!instanceName) {
      console.error('Nome da instância não fornecido')
      return new Response(
        JSON.stringify({ error: 'Nome da instância é obrigatório' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    if (!EVOLUTION_API_KEY || !EVOLUTION_API_URL) {
      console.error('Variáveis de ambiente não configuradas')
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Limpa a URL base removendo barras extras
    const cleanBaseUrl = EVOLUTION_API_URL.replace(/\/+$/, '')
    
    // URL correta do webhook
    const webhookUrl = 'https://adm.whatsremind.com/webhook/evolutin'
    
    console.log('Configurando webhook:', {
      baseUrl: cleanBaseUrl,
      webhookUrl
    })
    
    // Configura o webhook na Evolution API com Base64 ativado e tools
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
          base64: true, // Ativa o Webhook Base64
          headers: {
            'Content-Type': 'application/json'
          },
          events: [
            'messages.upsert',
            'messages.update',
            'qr.update',
            'connection.update',
            'contacts.upsert',
            'contacts.update',
            'groups.upsert',
            'groups.update'
          ]
        },
        tools: {
          calendar: {
            enabled: true,
            webhookUrl: 'https://adm.whatsremind.com/webhook/calendar',
            description: 'Integração com sistema de agendamento',
            settings: {
              base64: true,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          },
          crm: {
            enabled: true,
            webhookUrl: 'https://adm.whatsremind.com/webhook/crm',
            description: 'Integração com CRM para gestão de contatos',
            settings: {
              base64: true,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          }
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Erro ao configurar webhook:', errorData)
      return new Response(
        JSON.stringify({ error: 'Falha ao configurar webhook', details: errorData }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    const result = await response.json()
    console.log('Webhook configurado com sucesso:', result)

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('Erro ao processar requisição:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
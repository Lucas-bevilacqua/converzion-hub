import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('🔧 Configure Evolution Webhook function started')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling OPTIONS request')
    return new Response(null, { 
      headers: { ...corsHeaders }
    })
  }

  try {
    console.log('📥 Processing webhook configuration request')
    const { instanceName, instanceId } = await req.json()
    
    if (!instanceName || !instanceId) {
      console.error('❌ Parâmetros inválidos:', { instanceName, instanceId })
      throw new Error('Nome da instância e ID são obrigatórios')
    }

    console.log('🎯 Configurando webhook para:', { instanceName, instanceId })

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
    const SUPABASE_PROJECT_ID = 'vodexhppkasbulogmcqb'
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !ANON_KEY) {
      console.error('❌ Configurações necessárias não encontradas')
      throw new Error('Configurações necessárias não encontradas')
    }

    // Limpa a URL base removendo barras extras
    const cleanBaseUrl = EVOLUTION_API_URL.replace(/\/+$/, '')
    
    // URL do webhook da Supabase
    const webhookUrl = `https://${SUPABASE_PROJECT_ID}.functions.supabase.co/evolution-webhook`
    
    console.log('🔗 Configurando webhook:', {
      baseUrl: cleanBaseUrl,
      instanceName,
      webhookUrl
    })
    
    // Lista completa de eventos que precisamos monitorar
    const requiredEvents = [
      "APPLICATION_STARTUP",
      "CALL",
      "CHATS_DELETE",
      "CHATS_SET",
      "CHATS_UPDATE",
      "CHATS_UPSERT",
      "CONNECTION_UPDATE",
      "CONTACTS_SET",
      "CONTACTS_UPDATE",
      "GROUP_UPDATE",
      "GROUPS_UPSERT",
      "LABELS_ASSOCIATION",
      "LABELS_EDIT",
      "LOGOUT_INSTANCE",
      "MESSAGES_DELETE",
      "MESSAGES_SET",
      "MESSAGES_UPDATE",
      "MESSAGES_UPSERT",
      "PRESENCE_UPDATE",
      "QRCODE_UPDATED",
      "REMOVE_INSTANCE",
      "SEND_MESSAGE",
      "TYPEBOT_CHANGE_STATUS",
      "TYPEBOT_START"
    ]
    
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
            'Content-Type': 'application/json',
            'apikey': ANON_KEY
          },
          events: requiredEvents
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Erro ao configurar webhook na Evolution API:', error)
      throw new Error(`Erro na Evolution API: ${error}`)
    }

    const result = await response.json()
    console.log('✅ Webhook configurado com sucesso:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
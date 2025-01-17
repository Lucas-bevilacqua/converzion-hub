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
      console.error('❌ Configurações necessárias não encontradas:', {
        hasUrl: !!EVOLUTION_API_URL,
        hasKey: !!EVOLUTION_API_KEY,
        hasAnonKey: !!ANON_KEY
      })
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

    try {
      // Primeiro, vamos verificar se o webhook já existe
      console.log('🔍 Verificando webhook existente...')
      const checkResponse = await fetch(`${cleanBaseUrl}/webhook/find/${instanceName}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        }
      })

      const checkData = await checkResponse.text()
      console.log('📋 Status da verificação:', {
        status: checkResponse.status,
        ok: checkResponse.ok,
        body: checkData
      })

      // Se existir, vamos deletar primeiro
      if (checkResponse.ok && checkData && checkData !== 'null') {
        console.log('🗑️ Deletando webhook existente')
        const deleteResponse = await fetch(`${cleanBaseUrl}/webhook/delete/${instanceName}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          }
        })

        const deleteData = await deleteResponse.text()
        console.log('📋 Resposta da deleção:', {
          status: deleteResponse.status,
          ok: deleteResponse.ok,
          body: deleteData
        })

        if (!deleteResponse.ok) {
          console.error('❌ Erro ao deletar webhook:', deleteData)
          // Continuamos mesmo com erro na deleção
        } else {
          console.log('✅ Webhook anterior deletado com sucesso')
        }
      }
    } catch (error) {
      console.error('⚠️ Erro ao verificar/deletar webhook existente:', error)
      // Continuamos mesmo com erro na verificação/deleção
    }
    
    // Configura o webhook na Evolution API com todos os eventos necessários
    console.log('📝 Criando novo webhook com eventos:', requiredEvents)
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
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`
          },
          events: requiredEvents
        }
      })
    })

    const responseData = await response.text()
    console.log('📤 Resposta da Evolution API:', {
      status: response.status,
      ok: response.ok,
      body: responseData
    })

    if (!response.ok) {
      console.error('❌ Erro ao configurar webhook na Evolution API:', responseData)
      throw new Error(`Erro na Evolution API: ${responseData}`)
    }

    // Aguarda um momento para o webhook ser configurado
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verifica se o webhook foi realmente configurado
    console.log('🔍 Verificando configuração final do webhook')
    const verifyResponse = await fetch(`${cleanBaseUrl}/webhook/find/${instanceName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      }
    })

    const verifyData = await verifyResponse.text()
    console.log('📋 Status da verificação final:', {
      status: verifyResponse.status,
      ok: verifyResponse.ok,
      body: verifyData
    })

    // Faz uma chamada de teste para o webhook
    console.log('🔔 Fazendo chamada de teste para o webhook...')
    const testResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({
        test: true,
        instanceName,
        instanceId
      })
    })

    const testData = await testResponse.text()
    console.log('📋 Resposta do teste do webhook:', {
      status: testResponse.status,
      ok: testResponse.ok,
      body: testData
    })

    return new Response(
      JSON.stringify({ success: true }),
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
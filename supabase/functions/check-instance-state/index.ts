import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { instanceId } = await req.json()
    console.log('Recebendo requisição para verificar estado da instância:', instanceId)

    if (!instanceId) {
      console.error('ID da instância não fornecido')
      return new Response(
        JSON.stringify({ error: 'ID da instância é obrigatório' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!evolutionApiKey || !evolutionApiUrl) {
      console.error('Configurações da Evolution API ausentes')
      throw new Error('Configurações da Evolution API ausentes')
    }

    console.log('Usando URL da Evolution API:', evolutionApiUrl)

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })

    const { data: instance, error: instanceError } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      console.error('Erro ao buscar instância:', instanceError)
      throw new Error('Instância não encontrada')
    }

    console.log('Verificando estado para instância:', instance.name)

    const baseUrl = evolutionApiUrl.replace(/\/+$/, '')
    const connectionStateUrl = `${baseUrl}/instance/connectionState/${instance.name}`
    
    console.log('Fazendo requisição para:', connectionStateUrl)

    const response = await fetch(connectionStateUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      }
    })

    console.log('Resposta da Evolution API:', {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      timestamp: new Date().toISOString()
    })

    if (!response.ok) {
      console.error('Erro na Evolution API:', {
        status: response.status,
        statusText: response.statusText,
        timestamp: new Date().toISOString()
      })

      const errorText = await response.text()
      console.error('Resposta de erro:', errorText)

      // Se a instância não existe na Evolution API, marcar como desconectada
      const { data: updateData, error: updateError } = await supabase
        .from('evolution_instances')
        .update({ 
          connection_status: 'disconnected',
          status: 'disconnected',
          updated_at: new Date().toISOString()
        })
        .eq('id', instanceId)
        .select()
        .single()

      console.log('Marcando instância como desconectada:', {
        instanceId,
        timestamp: new Date().toISOString()
      })

      if (updateError) {
        console.error('Erro ao atualizar status para desconectado:', updateError)
        throw updateError
      }

      return new Response(
        JSON.stringify({
          state: 'disconnected',
          connected: false,
          instance: null,
          updateResult: updateData,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    console.log('Dados recebidos da Evolution API:', {
      data,
      timestamp: new Date().toISOString()
    })

    // Verificar estado diretamente do objeto instance.state ou do state principal
    const state = data?.instance?.instance?.state || data?.state || 'disconnected'
    const isConnected = state === 'CONNECTED' || state === 'open' || state === 'connected'

    console.log('Análise do estado:', { 
      state,
      isConnected,
      rawResponse: data,
      timestamp: new Date().toISOString()
    })

    const newStatus = isConnected ? 'connected' : 'disconnected'
    
    // Atualizar estado da instância
    const { data: updateData, error: updateError } = await supabase
      .from('evolution_instances')
      .update({ 
        connection_status: newStatus,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId)
      .select()
      .single()

    console.log('Resultado da atualização:', {
      data: updateData,
      error: updateError,
      newStatus,
      timestamp: new Date().toISOString()
    })

    if (updateError) {
      console.error('Erro ao atualizar estado:', updateError)
      throw updateError
    }

    // Verificar se a atualização foi bem sucedida
    const { data: verifyData, error: verifyError } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    console.log('Verificação final:', {
      data: verifyData,
      error: verifyError,
      expectedStatus: newStatus,
      timestamp: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({
        state: newStatus,
        connected: isConnected,
        instance: data,
        updateResult: updateData,
        verificationResult: verifyData,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )

  } catch (error) {
    console.error('Erro na função check-instance-state:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Falha ao verificar estado da instância',
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
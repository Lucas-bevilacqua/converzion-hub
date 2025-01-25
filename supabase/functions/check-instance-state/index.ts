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

    // Criar cliente Supabase com service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Primeiro, buscar a instância
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

    if (!response.ok) {
      console.error('Erro na Evolution API:', {
        status: response.status,
        statusText: response.statusText
      })

      const errorText = await response.text()
      console.error('Resposta de erro:', errorText)

      // Se a instância não existe na Evolution API, marcar como desconectada
      if (response.status === 404) {
        console.log('Instância não encontrada na Evolution API, marcando como desconectada')
        const { error: updateError } = await supabase
          .from('evolution_instances')
          .update({ 
            connection_status: 'disconnected',
            status: 'disconnected',
            updated_at: new Date().toISOString()
          })
          .eq('id', instanceId)

        if (updateError) {
          console.error('Erro ao atualizar status para desconectado:', updateError)
          throw updateError
        }

        return new Response(
          JSON.stringify({
            state: 'disconnected',
            connected: false,
            instance: null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      throw new Error(`Erro na Evolution API: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('Resposta da Evolution API:', data)

    // Extrair o estado diretamente do objeto instance.state ou do state principal
    const state = data?.instance?.instance?.state || data?.state || 'disconnected'
    const isConnected = state === 'open' || state === 'connected'

    console.log('Estado da conexão:', { 
      state,
      isConnected,
      rawResponse: data
    })

    try {
      console.log('Tentando atualizar estado no banco:', {
        instanceId,
        state,
        isConnected,
        timestamp: new Date().toISOString()
      })

      // Atualizar estado da instância no banco usando o service role
      const { data: updateData, error: updateError } = await supabase
        .from('evolution_instances')
        .update({ 
          connection_status: isConnected ? 'connected' : 'disconnected',
          status: isConnected ? 'connected' : 'disconnected',
          updated_at: new Date().toISOString()
        })
        .eq('id', instanceId)
        .select()

      if (updateError) {
        console.error('Erro ao atualizar estado da instância:', updateError)
        throw updateError
      }

      console.log('Estado atualizado com sucesso no banco:', updateData)
    } catch (updateError) {
      console.error('Erro na atualização:', updateError)
      throw updateError
    }

    return new Response(
      JSON.stringify({
        state: isConnected ? 'connected' : 'disconnected',
        connected: isConnected,
        instance: data
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
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
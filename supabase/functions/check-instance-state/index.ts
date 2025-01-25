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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: instance, error: instanceError } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      console.error('Erro ao buscar instância:', instanceError)
      return new Response(
        JSON.stringify({ error: 'Instância não encontrada' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('Configuração da Evolution API ausente')
      return new Response(
        JSON.stringify({ error: 'Configuração da Evolution API ausente' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const baseUrl = evolutionApiUrl.replace(/\/+$/, '')
    console.log('Verificando estado na Evolution API para:', instance.name)

    const connectionStateUrl = `${baseUrl}/instance/connectionState/${instance.name}`
    console.log('URL da requisição:', connectionStateUrl)

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
      console.error('Corpo da resposta de erro:', errorText)

      return new Response(
        JSON.stringify({ 
          error: 'Falha ao verificar estado da instância',
          details: {
            status: response.status,
            error: response.statusText,
            response: errorText ? JSON.parse(errorText) : null
          }
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const data = await response.json()
    console.log('Resposta da Evolution API:', data)

    // Mapear o estado 'open' para 'connected'
    const connectionState = data.state === 'open' ? 'connected' : 'disconnected'

    // Atualizar estado da instância no banco
    const { error: updateError } = await supabase
      .from('evolution_instances')
      .update({ 
        connection_status: connectionState,
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId)

    if (updateError) {
      console.error('Erro ao atualizar estado da instância:', updateError)
    }

    return new Response(
      JSON.stringify({
        instance: data,
        state: connectionState,
        connected: connectionState === 'connected'
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
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
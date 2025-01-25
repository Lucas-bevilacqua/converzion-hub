import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InstanceState {
  state: string
  connected: boolean
  instance: any
  updateResult?: any
  timestamp: string
}

async function checkEvolutionApiState(instanceName: string, evolutionApiKey: string, evolutionApiUrl: string): Promise<any> {
  const baseUrl = evolutionApiUrl.replace(/\/+$/, '')
  const connectionStateUrl = `${baseUrl}/instance/connectionState/${instanceName}`
  
  console.log('Fazendo requisição para:', connectionStateUrl)

  const response = await fetch(connectionStateUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': evolutionApiKey
    }
  })

  if (!response.ok) {
    throw new Error(`Evolution API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function updateInstanceStatus(
  supabase: any,
  instanceId: string,
  status: string,
  timestamp = new Date().toISOString()
): Promise<any> {
  console.log('Atualizando status da instância:', {
    instanceId,
    status,
    timestamp
  })

  const { data, error } = await supabase
    .from('evolution_instances')
    .update({ 
      connection_status: status,
      status: status,
      updated_at: timestamp
    })
    .eq('id', instanceId)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar status:', error)
    throw error
  }

  console.log('Status atualizado com sucesso:', data)
  return data
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

    try {
      const apiData = await checkEvolutionApiState(instance.name, evolutionApiKey, evolutionApiUrl)
      console.log('Dados recebidos da Evolution API:', {
        data: apiData,
        timestamp: new Date().toISOString()
      })

      const state = apiData?.instance?.instance?.state || apiData?.state || 'disconnected'
      const isConnected = state === 'CONNECTED' || state === 'open' || state === 'connected'
      const newStatus = isConnected ? 'connected' : 'disconnected'

      console.log('Análise do estado:', { 
        state,
        isConnected,
        newStatus,
        rawResponse: apiData,
        timestamp: new Date().toISOString()
      })

      const updateData = await updateInstanceStatus(supabase, instanceId, newStatus)

      const response: InstanceState = {
        state: newStatus,
        connected: isConnected,
        instance: apiData,
        updateResult: updateData,
        timestamp: new Date().toISOString()
      }

      return new Response(
        JSON.stringify(response),
        { 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          } 
        }
      )

    } catch (error) {
      console.error('Erro ao verificar estado na Evolution API:', error)
      
      const updateData = await updateInstanceStatus(supabase, instanceId, 'disconnected')
      console.log('Instância marcada como desconectada:', updateData)

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
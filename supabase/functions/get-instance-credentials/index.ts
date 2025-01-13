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
    const { instanceName } = await req.json()
    console.log('🔍 Buscando credenciais para instância:', instanceName)

    if (!instanceName) {
      throw new Error('Nome da instância é obrigatório')
    }

    // Inicializa cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Busca a instância pelo nome
    const { data: instance, error: instanceError } = await supabaseClient
      .from('evolution_instances')
      .select('id')
      .eq('name', instanceName)
      .single()

    if (instanceError || !instance) {
      console.error('❌ Erro ao buscar instância:', instanceError)
      throw new Error('Instância não encontrada')
    }

    console.log('✅ Instância encontrada:', instance.id)

    // Busca todas as tools ativas da instância
    const { data: tools, error: toolsError } = await supabaseClient
      .from('instance_tools')
      .select('*')
      .eq('instance_id', instance.id)
      .eq('is_active', true)

    if (toolsError) {
      console.error('❌ Erro ao buscar tools:', toolsError)
      throw toolsError
    }

    console.log('📦 Tools encontradas:', tools?.length || 0)

    // Formata as credenciais para retornar
    const credentials = tools?.reduce((acc, tool) => {
      return {
        ...acc,
        [tool.tool_type]: {
          ...tool.settings,
          webhook_url: tool.webhook_url,
          webhook_secret: tool.webhook_secret,
        }
      }
    }, {})

    return new Response(
      JSON.stringify({ 
        success: true, 
        credentials,
        instanceId: instance.id
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    console.error('❌ Erro ao processar requisição:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
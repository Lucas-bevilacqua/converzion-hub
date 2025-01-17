import "https://deno.land/x/xhr@0.1.0/mod.ts"
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
    const { 
      instanceId, 
      instanceName, 
      userId, 
      delayMinutes, 
      maxAttempts, 
      stopOnReply, 
      stopKeywords, 
      systemPrompt,
      skipInitialMessage 
    } = await req.json()

    console.log('Configurando follow-up:', {
      instanceId,
      instanceName,
      skipInitialMessage,
      delayMinutes,
      maxAttempts,
      stopOnReply,
      stopKeywords
    })

    // Sempre pular o envio imediato de mensagem
    console.log('Configuração salva sem envio de mensagem imediata')
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Follow-up configurado com sucesso, sem mensagem imediata' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro ao processar follow-up:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
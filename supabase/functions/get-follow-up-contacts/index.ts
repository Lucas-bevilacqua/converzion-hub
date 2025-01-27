import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TimingMetrics {
  startTime: number;
  dbFetchTime?: number;
  processingTime?: number;
  totalTime?: number;
}

function formatPhoneNumber(phone: string | null): string | null {
  if (!phone) {
    console.log('⚠️ Número de telefone vazio ou nulo')
    return null
  }

  // Remove todos os caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '')
  
  // Log do número limpo
  console.log(`🧹 Número limpo: ${cleaned}`)

  // Verifica se tem o tamanho correto (10 ou 11 dígitos sem código do país)
  if (cleaned.length < 10 || cleaned.length > 11) {
    console.log(`⚠️ Número com tamanho inválido: ${cleaned.length} dígitos`)
    return null
  }

  // Se começar com 0, remove
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
    console.log(`🔄 Removido 0 inicial: ${cleaned}`)
  }

  // Adiciona código do país se não tiver
  if (!cleaned.startsWith('55')) {
    cleaned = `55${cleaned}`
    console.log(`🔄 Adicionado código do país: ${cleaned}`)
  }

  return cleaned
}

serve(async (req) => {
  const metrics: TimingMetrics = {
    startTime: Date.now()
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔄 Iniciando processamento de follow-up contacts')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get active follow-ups that are pending or in_progress
    const dbStartTime = Date.now()
    const { data: followUps, error: followUpsError } = await supabase
      .from('follow_ups')
      .select(`
        *,
        instance:evolution_instances (
          id,
          name,
          connection_status,
          user_id
        )
      `)
      .in('status', ['pending', 'in_progress'])
      .eq('settings->is_active', true)

    if (followUpsError) {
      console.error('❌ Erro ao buscar follow-ups:', followUpsError)
      throw followUpsError
    }

    metrics.dbFetchTime = Date.now() - dbStartTime
    console.log(`✅ Busca no banco completada em ${metrics.dbFetchTime}ms`)
    console.log(`✅ Encontrados ${followUps?.length || 0} follow-ups para processar`)

    // Filter connected instances
    const activeFollowUps = followUps?.filter(followUp => {
      const isConnected = followUp.instance?.connection_status?.toLowerCase() === 'connected'
      console.log(`🔌 Instance ${followUp.instance_id} status: ${followUp.instance?.connection_status}`)
      return isConnected
    }) || []

    console.log(`✅ ${activeFollowUps.length} follow-ups têm instâncias conectadas`)

    const processingStartTime = Date.now()
    
    // Process each follow-up in parallel for better performance
    const results = await Promise.all(activeFollowUps.map(async (followUp) => {
      const followUpStartTime = Date.now()
      try {
        // Get eligible contacts using the optimized stored procedure
        const { data: contacts, error: contactsError } = await supabase.rpc(
          'get_eligible_follow_up_contacts',
          { 
            p_instance_id: followUp.instance_id,
            p_follow_up_id: followUp.id,
            p_hours_threshold: 24
          }
        )

        if (contactsError) {
          console.error(`❌ Erro ao buscar contatos para follow-up ${followUp.id}:`, contactsError)
          throw contactsError
        }

        // Log dos contatos brutos para debug
        console.log(`🔍 Dados brutos dos contatos para follow-up ${followUp.id}:`, contacts)
        
        // Filtra e formata contatos válidos
        const validContacts = (contacts || [])
          .filter(contact => {
            // Verifica se tem os dados necessários
            if (!contact?.telefoneclientes || !contact?.last_message_time) {
              console.log('⚠️ Contato inválido - Faltam dados obrigatórios:', contact)
              return false
            }

            const formattedPhone = formatPhoneNumber(contact.telefoneclientes)
            if (!formattedPhone) {
              console.log(`⚠️ Contato ignorado - Número inválido: ${contact.telefoneclientes}`)
              return false
            }

            // Atualiza o número formatado no contato
            contact.telefoneclientes = formattedPhone
            return true
          })

        console.log(`✅ Filtrados e formatados ${validContacts.length} contatos válidos`)

        if (validContacts.length > 0) {
          console.log(`🔄 Tentando inserir ${validContacts.length} contatos para follow-up ${followUp.id}`)
          
          // Prepara contatos para inserção
          const contactsToInsert = validContacts.map(contact => ({
            follow_up_id: followUp.id,
            phone: contact.telefoneclientes,
            status: 'pending',
            metadata: {
              contact_name: contact.nomeclientes || 'Unknown',
              last_message_time: contact.last_message_time,
              instance_id: followUp.instance_id,
              original_phone: contact.telefoneclientes
            }
          }))

          // Log do que será inserido
          console.log(`📝 Contatos a serem inseridos:`, contactsToInsert)

          const { error: insertError } = await supabase
            .from('follow_up_contacts')
            .insert(contactsToInsert)

          if (insertError) {
            console.error(`❌ Erro ao inserir contatos para follow-up ${followUp.id}:`, insertError)
            throw insertError
          }

          console.log(`✅ Inseridos com sucesso ${validContacts.length} contatos para follow-up ${followUp.id}`)

          // Chama process-follow-up para cada follow-up com contatos
          console.log(`🔄 Chamando process-follow-up para follow-up ${followUp.id}`)
          const processResponse = await fetch(
            'https://vodexhppkasbulogmcqb.supabase.co/functions/v1/process-follow-up',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                followUpId: followUp.id,
                scheduled: true
              })
            }
          )

          if (!processResponse.ok) {
            const errorText = await processResponse.text()
            console.error(`❌ Erro ao processar follow-up ${followUp.id}:`, errorText)
            throw new Error(`Failed to process follow-up: ${errorText}`)
          }

          console.log(`✅ Follow-up ${followUp.id} processado com sucesso`)
        } else {
          console.log(`ℹ️ Nenhum contato válido encontrado para follow-up ${followUp.id}`)
        }

        // Atualiza status do follow-up se necessário
        if (followUp.status === 'pending') {
          const { error: updateError } = await supabase
            .from('follow_ups')
            .update({ 
              status: 'in_progress',
              updated_at: new Date().toISOString()
            })
            .eq('id', followUp.id)

          if (updateError) throw updateError
        }

        const followUpProcessingTime = Date.now() - followUpStartTime
        console.log(`✅ Follow-up ${followUp.id} processado em ${followUpProcessingTime}ms`)

        return {
          followUpId: followUp.id,
          status: 'success',
          contacts: validContacts.length,
          processingTime: followUpProcessingTime
        }
      } catch (error) {
        console.error(`❌ Erro ao processar follow-up ${followUp.id}:`, error)
        return {
          followUpId: followUp.id,
          status: 'error',
          error: error.message,
          processingTime: Date.now() - followUpStartTime
        }
      }
    }))

    metrics.processingTime = Date.now() - processingStartTime
    metrics.totalTime = Date.now() - metrics.startTime

    console.log('📊 Métricas de Performance:', {
      dbFetchTime: `${metrics.dbFetchTime}ms`,
      processingTime: `${metrics.processingTime}ms`,
      totalTime: `${metrics.totalTime}ms`,
      followUpsProcessed: results.length
    })

    return new Response(
      JSON.stringify({
        success: true,
        data: results,
        metrics: {
          dbFetchTime: metrics.dbFetchTime,
          processingTime: metrics.processingTime,
          totalTime: metrics.totalTime,
          timestamp: new Date().toISOString()
        }
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('❌ Erro no processamento de follow-up contacts:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        metrics: {
          totalTime: Date.now() - metrics.startTime,
          timestamp: new Date().toISOString()
        }
      }),
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
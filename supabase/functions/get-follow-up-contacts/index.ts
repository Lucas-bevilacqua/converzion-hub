import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface TimingMetrics {
  startTime: number;
  dbFetchTime?: number;
  processingTime?: number;
  totalTime?: number;
}

function decodeHexPhone(phone: string): string {
  try {
    // Remove o prefixo 3E se existir
    const cleanHex = phone.replace(/^3E/, '');
    
    // Convert each pair of hex characters to a number
    let result = '';
    for (let i = 0; i < Math.min(cleanHex.length, 24); i += 2) {
      const byte = parseInt(cleanHex.substr(i, 2), 16);
      // Check if it's a valid number (0-9)
      if (!isNaN(byte) && byte >= 48 && byte <= 57) {
        result += String.fromCharCode(byte);
      }
    }

    // If result is empty or invalid, try direct numeric extraction
    if (!result || result.length < 8) {
      result = cleanHex.replace(/[^0-9]/g, '');
    }

    // Add country code if missing
    if (!result.startsWith('55')) {
      result = '55' + result;
    }

    // Validate final length
    if (result.length < 10 || result.length > 13) {
      console.log('⚠️ Invalid number length:', result.length, 'for number:', result);
      return '';
    }

    console.log('✅ Successfully decoded number:', {
      original: phone,
      cleaned: cleanHex,
      result: result
    });

    return result;
  } catch (e) {
    console.error('❌ Error decoding hex:', e);
    return '';
  }
}

function cleanPhoneNumber(phone: string | null): string | null {
  if (!phone) {
    console.log('⚠️ Empty or null phone number')
    return null
  }

  console.log(`🔍 Original number:`, phone)
  
  let cleaned = '';
  
  if (/^3[E-F]/.test(phone)) {
    cleaned = decodeHexPhone(phone);
    console.log(`🔄 Decoded hex number:`, cleaned);
  } else {
    cleaned = phone.replace(/\D/g, '');
  }
  
  console.log(`🧹 Cleaned number:`, cleaned)

  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
    console.log(`🔄 Removed initial 0:`, cleaned)
  }

  if (!cleaned.startsWith('55')) {
    cleaned = `55${cleaned}`
    console.log(`🔄 Added country code:`, cleaned)
  }

  if (cleaned.length < 10 || cleaned.length > 13) {
    console.log(`⚠️ Invalid number length after formatting: ${cleaned.length} digits`)
    return null
  }

  const ddd = parseInt(cleaned.substring(2, 4))
  if (ddd < 11 || ddd > 99) {
    console.log(`⚠️ Invalid DDD: ${ddd}`)
    return null
  }

  console.log(`✅ Number formatted successfully:`, cleaned)
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
    console.log('🔄 Starting follow-up contacts processing')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const dbStartTime = Date.now()
    
    console.log('🔍 Fetching active follow-ups...')
    const { data: followUps, error: followUpsError } = await supabase
      .from('follow_ups')
      .select(`
        *,
        instance:evolution_instances (
          id,
          name,
          connection_status,
          user_id,
          system_prompt
        )
      `)
      .eq('settings->is_active', true)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })

    if (followUpsError) {
      console.error('❌ Error fetching follow-ups:', followUpsError)
      throw followUpsError
    }

    metrics.dbFetchTime = Date.now() - dbStartTime
    console.log(`✅ Database fetch completed in ${metrics.dbFetchTime}ms`)
    console.log(`✅ Found ${followUps?.length || 0} follow-ups to process`)
    
    const aiFollowUps = followUps?.filter(f => f.type === 'ai') || []
    const manualFollowUps = followUps?.filter(f => f.type === 'manual') || []
    console.log(`📊 Follow-ups breakdown:
      - AI Follow-ups: ${aiFollowUps.length}
      - Manual Follow-ups: ${manualFollowUps.length}`)

    followUps?.forEach(followUp => {
      console.log(`🔍 Follow-up ${followUp.id} details:
        - Type: ${followUp.type}
        - Status: ${followUp.status}
        - Instance Status: ${followUp.instance?.connection_status}
        - Is Active: ${followUp.settings?.is_active}
      `)
    })

    const activeFollowUps = followUps?.filter(followUp => {
      const isConnected = followUp.instance?.connection_status?.toLowerCase().includes('connected') || 
                         followUp.instance?.connection_status?.toLowerCase().includes('open')
      console.log(`🔌 Instance ${followUp.instance_id} connection check:
        - Status: ${followUp.instance?.connection_status}
        - Is Connected: ${isConnected}
        - Follow-up Type: ${followUp.type}
      `)
      return isConnected
    }) || []

    console.log(`✅ ${activeFollowUps.length} follow-ups have connected instances`)

    const processingStartTime = Date.now()
    
    const results = await Promise.all(activeFollowUps.map(async (followUp) => {
      const followUpStartTime = Date.now()
      try {
        console.log(`🔄 Processing follow-up ${followUp.id} (Type: ${followUp.type})`)
        
        const { data: contacts, error: contactsError } = await supabase
          .from('users_clientes')
          .select('telefoneclientes, nomeclientes, last_message_time')
          .eq('nomedaempresa', followUp.instance_id)
          .not('telefoneclientes', 'is', null)
          .gt('last_message_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        if (contactsError) {
          console.error(`❌ Error fetching contacts for follow-up ${followUp.id}:`, contactsError)
          throw contactsError
        }

        console.log(`🔍 Raw contact data for follow-up ${followUp.id}:`, contacts)
        
        const validContacts = (contacts || [])
          .filter(contact => {
            if (!contact?.telefoneclientes || !contact?.last_message_time) {
              console.log('⚠️ Invalid contact - Missing required data:', contact)
              return false
            }

            const formattedPhone = cleanPhoneNumber(contact.telefoneclientes)
            if (!formattedPhone) {
              console.log(`⚠️ Contact ignored - Invalid number: ${contact.telefoneclientes}`)
              return false
            }

            contact.telefoneclientes = formattedPhone
            return true
          })

        console.log(`✅ Filtered and formatted ${validContacts.length} valid contacts`)

        if (validContacts.length > 0) {
          console.log(`🔄 Trying to insert ${validContacts.length} contacts for follow-up ${followUp.id}`)
          
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

          console.log(`📝 Contacts to be inserted:`, contactsToInsert)

          const { error: insertError } = await supabase
            .from('follow_up_contacts')
            .insert(contactsToInsert)

          if (insertError) {
            console.error(`❌ Error inserting contacts for follow-up ${followUp.id}:`, insertError)
            throw insertError
          }

          console.log(`✅ Successfully inserted ${validContacts.length} contacts for follow-up ${followUp.id}`)

          // Directly process AI follow-ups after inserting contacts
          if (followUp.type === 'ai') {
            console.log(`🤖 Initiating AI follow-up processing for ${followUp.id}`)
            const processResponse = await supabase.functions.invoke('process-ai-follow-up', {
              body: {
                followUpId: followUp.id,
                scheduled: true,
                systemPrompt: followUp.instance?.system_prompt
              }
            })

            if (processResponse.error) {
              console.error(`❌ Error processing AI follow-up ${followUp.id}:`, processResponse.error)
              throw new Error(`Failed to process AI follow-up: ${processResponse.error.message}`)
            }

            console.log(`✅ AI follow-up ${followUp.id} initiated successfully`)
          } else {
            console.log(`📤 Manual follow-up ${followUp.id} ready for processing`)
          }
        } else {
          console.log(`ℹ️ No valid contacts found for follow-up ${followUp.id}`)
        }

        const followUpProcessingTime = Date.now() - followUpStartTime
        console.log(`✅ Follow-up ${followUp.id} processed in ${followUpProcessingTime}ms`)

        return {
          followUpId: followUp.id,
          status: 'success',
          type: followUp.type,
          contacts: validContacts.length,
          processingTime: followUpProcessingTime
        }
      } catch (error) {
        console.error(`❌ Error processing follow-up ${followUp.id}:`, error)
        return {
          followUpId: followUp.id,
          status: 'error',
          type: followUp.type,
          error: error.message,
          processingTime: Date.now() - followUpStartTime
        }
      }
    }))

    metrics.processingTime = Date.now() - processingStartTime
    metrics.totalTime = Date.now() - metrics.startTime

    console.log('📊 Performance Metrics:', {
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
    console.error('❌ Error in follow-up contacts processing:', error)
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

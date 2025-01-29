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
    // Remove 3E or 3F prefix if present
    const cleanHex = phone.replace(/^(3E|3F|3[E-F])/, '');
    
    // Convert pairs of hex chars to bytes and extract numbers
    let result = '';
    for (let i = 0; i < cleanHex.length; i += 2) {
      const byte = parseInt(cleanHex.substr(i, 2), 16);
      // Only add if it's a valid number character
      if (byte >= 48 && byte <= 57) { // ASCII codes for 0-9
        result += String.fromCharCode(byte);
      }
    }
    
    console.log('🔄 Decoded number:', result);
    return result;
  } catch (e) {
    console.error('❌ Error decoding hex phone:', e);
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
  
  // If number starts with 3E or 3F, it's hex encoded
  if (/^3[E-F]/.test(phone)) {
    cleaned = decodeHexPhone(phone);
    console.log(`🔄 Decoded hex number:`, cleaned);
  } else {
    // Remove all non-numeric characters
    cleaned = phone.replace(/\D/g, '');
  }
  
  console.log(`🧹 Cleaned number:`, cleaned)

  // If starts with 0, remove it
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
    console.log(`🔄 Removed initial 0:`, cleaned)
  }

  // Add country code if doesn't have it
  if (!cleaned.startsWith('55')) {
    cleaned = `55${cleaned}`
    console.log(`🔄 Added country code:`, cleaned)
  }

  // Basic validation - should be 10-13 digits for Brazilian numbers
  if (cleaned.length < 10 || cleaned.length > 13) {
    console.log(`⚠️ Invalid number length after formatting: ${cleaned.length} digits`)
    return null
  }

  // Validate DDD (must be between 11 and 99)
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
          user_id,
          system_prompt
        )
      `)
      .in('status', ['pending', 'in_progress'])
      .eq('settings->is_active', true)

    if (followUpsError) {
      console.error('❌ Error fetching follow-ups:', followUpsError)
      throw followUpsError
    }

    metrics.dbFetchTime = Date.now() - dbStartTime
    console.log(`✅ Database fetch completed in ${metrics.dbFetchTime}ms`)
    console.log(`✅ Found ${followUps?.length || 0} follow-ups to process`)

    // Filter connected instances
    const activeFollowUps = followUps?.filter(followUp => {
      const isConnected = followUp.instance?.connection_status?.toLowerCase() === 'connected'
      console.log(`🔌 Instance ${followUp.instance_id} status: ${followUp.instance?.connection_status}`)
      return isConnected
    }) || []

    console.log(`✅ ${activeFollowUps.length} follow-ups have connected instances`)

    const processingStartTime = Date.now()
    
    // Process each follow-up in parallel for better performance
    const results = await Promise.all(activeFollowUps.map(async (followUp) => {
      const followUpStartTime = Date.now()
      try {
        // Get eligible contacts using the optimized stored procedure
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
        
        // Filter and format valid contacts
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

          // Call appropriate processing function based on follow-up type
          const processingEndpoint = followUp.type === 'ai' ? 'process-ai-follow-up' : 'process-follow-up'
          console.log(`🔄 Calling ${processingEndpoint} for follow-up ${followUp.id} of type ${followUp.type}`)
          
          const processResponse = await supabase.functions.invoke(processingEndpoint, {
            body: {
              followUpId: followUp.id,
              scheduled: true
            }
          })

          if (!processResponse.error) {
            console.log(`✅ Follow-up ${followUp.id} processed successfully`)
          } else {
            console.error(`❌ Error processing follow-up ${followUp.id}:`, processResponse.error)
            throw new Error(`Failed to process follow-up: ${processResponse.error.message}`)
          }
        } else {
          console.log(`ℹ️ No valid contacts found for follow-up ${followUp.id}`)
        }

        // Update follow-up status if needed
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
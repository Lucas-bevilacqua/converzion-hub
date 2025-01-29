import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface TimingMetrics {
  startTime: number;
  dbFetchTime?: number;
  processingTime?: number;
  totalTime?: number;
}

// Function to clean and validate phone number
function cleanPhoneNumber(phone: string): string | null {
  console.log('🔄 Cleaning phone number:', phone)
  
  if (!phone) {
    console.log('❌ Invalid phone: empty or null')
    return null
  }

  // Remove any non-numeric characters
  let cleaned = phone.replace(/\D/g, '')
  console.log('📱 After removing non-numeric:', cleaned)

  // Remove @s.whatsapp.net or @c.us if present
  cleaned = cleaned.split('@')[0]
  console.log('📱 After removing @:', cleaned)

  // Remove any part after : (some numbers come with :1 or :2)
  cleaned = cleaned.split(':')[0]
  console.log('📱 After removing :', cleaned)

  // If it doesn't start with 55, add it
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned
    console.log('📱 After adding 55:', cleaned)
  }

  // Validate length (should be 12 or 13 digits including 55)
  if (cleaned.length < 12 || cleaned.length > 13) {
    console.log('❌ Invalid length:', cleaned.length)
    return null
  }

  // Validate DDD (should be between 11 and 99)
  const ddd = parseInt(cleaned.substring(2, 4))
  if (ddd < 11 || ddd > 99) {
    console.log('❌ Invalid DDD:', ddd)
    return null
  }

  console.log('✅ Valid phone number:', cleaned)
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

    const processingStartTime = Date.now()
    
    const results = await Promise.all(followUps?.map(async (followUp) => {
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

        console.log(`🔍 Found ${contacts?.length || 0} potential contacts for follow-up ${followUp.id}`)
        
        if (!contacts || contacts.length === 0) {
          console.log(`ℹ️ No eligible contacts found for follow-up ${followUp.id}`)
          return {
            followUpId: followUp.id,
            status: 'success',
            type: followUp.type,
            contacts: 0,
            processingTime: Date.now() - followUpStartTime
          }
        }

        // Get existing contacts to avoid duplicates
        const { data: existingContacts, error: existingError } = await supabase
          .from('follow_up_contacts')
          .select('phone')
          .eq('follow_up_id', followUp.id)

        if (existingError) {
          console.error(`❌ Error fetching existing contacts:`, existingError)
          throw existingError
        }

        const existingPhones = new Set(existingContacts?.map(c => c.phone) || [])
        
        const validContacts = contacts
          .filter(contact => {
            if (!contact?.telefoneclientes || !contact?.last_message_time) {
              console.log('⚠️ Invalid contact - Missing required data:', contact)
              return false
            }

            // Clean and validate phone number
            const cleanedPhone = cleanPhoneNumber(contact.telefoneclientes)
            if (!cleanedPhone) {
              console.log('⚠️ Invalid phone number format:', contact.telefoneclientes)
              return false
            }

            // Skip if already processed
            if (existingPhones.has(cleanedPhone)) {
              console.log(`⚠️ Contact already processed: ${cleanedPhone}`)
              return false
            }

            // Update the phone number to the cleaned version
            contact.telefoneclientes = cleanedPhone
            return true
          })

        console.log(`✅ Found ${validContacts.length} new valid contacts to process`)

        if (validContacts.length > 0) {
          console.log(`🔄 Inserting ${validContacts.length} contacts for follow-up ${followUp.id}`)
          
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

          const { error: insertError } = await supabase
            .from('follow_up_contacts')
            .insert(contactsToInsert)

          if (insertError) {
            console.error(`❌ Error inserting contacts for follow-up ${followUp.id}:`, insertError)
            throw insertError
          }

          console.log(`✅ Successfully inserted ${validContacts.length} contacts for follow-up ${followUp.id}`)

          // Update follow-up status to in_progress
          const { error: updateError } = await supabase
            .from('follow_ups')
            .update({ 
              status: 'in_progress',
              updated_at: new Date().toISOString()
            })
            .eq('id', followUp.id)

          if (updateError) {
            console.error(`❌ Error updating follow-up status:`, updateError)
            throw updateError
          }
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
    }) || [])

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
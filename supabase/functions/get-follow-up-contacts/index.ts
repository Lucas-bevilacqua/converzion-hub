import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FollowUp {
  id: string
  instance_id: string
  status: string
  type: string
  settings: {
    is_active: boolean
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔄 [DEBUG] Starting follow-up contacts processing')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get current time in UTC
    const now = new Date()
    console.log('⏰ [DEBUG] Current UTC time:', now.toISOString())

    // Fetch active follow-ups that need processing
    const { data: followUps, error: followUpsError } = await supabase
      .from('follow_ups')
      .select(`
        id,
        instance_id,
        status,
        type,
        settings,
        evolution_instances!inner (
          id,
          connection_status
        )
      `)
      .eq('status', 'pending')
      .eq('evolution_instances.connection_status', 'connected')

    if (followUpsError) {
      console.error('❌ [ERROR] Error fetching follow-ups:', followUpsError)
      throw followUpsError
    }

    console.log('✅ [DEBUG] Found follow-ups:', followUps?.length)

    const results = []
    
    for (const followUp of (followUps || [])) {
      try {
        console.log('🔄 [DEBUG] Processing follow-up:', followUp)

        // Update follow-up status to in_progress
        const { error: updateError } = await supabase
          .from('follow_ups')
          .update({
            status: 'in_progress',
            updated_at: now.toISOString()
          })
          .eq('id', followUp.id)

        if (updateError) {
          console.error('❌ [ERROR] Error updating follow-up:', updateError)
          throw updateError
        }

        // Fetch pending contacts for this instance
        const { data: contacts, error: contactsError } = await supabase
          .from('follow_up_contacts')
          .select('*')
          .eq('follow_up_id', followUp.id)
          .eq('status', 'pending')
          .limit(50)

        if (contactsError) {
          console.error('❌ [ERROR] Error fetching contacts:', contactsError)
          throw contactsError
        }

        results.push({
          success: true,
          followUpId: followUp.id,
          contactsCount: contacts?.length || 0,
          executionDetails: {
            executionTime: now.toISOString(),
            status: 'in_progress'
          }
        })

      } catch (error) {
        console.error(`❌ [ERROR] Error processing follow-up ${followUp.id}:`, error)
        results.push({
          success: false,
          followUpId: followUp.id,
          error: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        timestamp: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ [ERROR] Unhandled error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
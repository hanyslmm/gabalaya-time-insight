import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all admin users without full names
    const { data: adminUsers, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('id, username, full_name')
      .or('full_name.is.null,full_name.eq.')

    if (adminError) {
      throw adminError
    }

    console.log('Found admin users without full names:', adminUsers?.length || 0)

    const updates = []

    // For each admin user without a full name, try to get it from employees table
    for (const adminUser of adminUsers || []) {
      const { data: employee, error: empError } = await supabaseAdmin
        .from('employees')
        .select('full_name')
        .eq('staff_id', adminUser.username)
        .maybeSingle()

      if (!empError && employee?.full_name) {
        // Update admin user with full name
        const { error: updateError } = await supabaseAdmin
          .from('admin_users')
          .update({ full_name: employee.full_name })
          .eq('id', adminUser.id)

        if (!updateError) {
          updates.push({
            username: adminUser.username,
            full_name: employee.full_name
          })
          console.log(`Updated ${adminUser.username} with full name: ${employee.full_name}`)
        } else {
          console.error(`Failed to update ${adminUser.username}:`, updateError)
        }
      } else {
        console.log(`No employee record found for admin user: ${adminUser.username}`)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${updates.length} admin users with full names`,
        updates: updates
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Update admin names error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

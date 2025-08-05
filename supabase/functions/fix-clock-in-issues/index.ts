import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, staff_id } = await req.json()
    console.log('Clock in issues fix requested:', { action, staff_id });

    // Create Supabase client with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (action === 'force_clock_out') {
      // Force clock out any active entries for the user
      console.log(`Force clocking out active entries for staff_id: ${staff_id}`);

      // Find the employee ID first
      const { data: employeeData, error: employeeError } = await supabaseAdmin
        .from('employees')
        .select('id, full_name')
        .eq('staff_id', staff_id)
        .single();

      if (employeeError || !employeeData) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Employee not found',
            details: `No employee found with staff_id: ${staff_id}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      // Find all active entries (where clock_out_time is null)
      const { data: activeEntries, error: activeError } = await supabaseAdmin
        .from('timesheet_entries')
        .select('*')
        .eq('employee_id', employeeData.id)
        .is('clock_out_time', null);

      if (activeError) {
        console.error('Error finding active entries:', activeError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to find active entries',
            details: activeError.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      const results = [];

      // Force clock out each active entry
      for (const entry of activeEntries || []) {
        const clockInDateTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}`);
        const now = new Date();
        const totalHours = (now.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);

        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('timesheet_entries')
          .update({
            clock_out_date: new Date().toISOString().split('T')[0],
            clock_out_time: new Date().toTimeString().split(' ')[0],
            clock_out_location: 'Auto-corrected',
            total_hours: Math.round(totalHours * 100) / 100,
            updated_at: new Date().toISOString()
          })
          .eq('id', entry.id)
          .select();

        if (updateError) {
          console.error(`Error updating entry ${entry.id}:`, updateError);
          results.push({
            entry_id: entry.id,
            status: 'error',
            error: updateError.message
          });
        } else {
          console.log(`Successfully closed entry ${entry.id}`);
          results.push({
            entry_id: entry.id,
            status: 'success',
            clock_in_date: entry.clock_in_date,
            clock_in_time: entry.clock_in_time,
            total_hours: Math.round(totalHours * 100) / 100
          });
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Force clock out completed for ${employeeData.full_name}`,
          entries_closed: results.length,
          results: results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Default action: Fix general clock-in issues
    console.log('Starting general clock in issues fix...');

    const results = [];

    // 1. Fix empty company_settings table
    console.log('1. Fixing company_settings table...');
    const { data: companySettingsResult, error: companyError } = await supabaseAdmin
      .from('company_settings')
      .upsert({
        id: 1,
        timezone: 'Africa/Cairo',
        motivational_message: 'Keep up the great work! Your dedication and effort make a real difference to our team.',
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select();

    if (companyError) {
      console.error('Company settings error:', companyError);
      results.push({ step: 'company_settings', status: 'error', error: companyError.message });
    } else {
      console.log('Company settings fixed successfully');
      results.push({ step: 'company_settings', status: 'success', data: companySettingsResult });
    }

    // 2. Find and fix orphaned active entries
    console.log('2. Finding orphaned active entries...');
    const { data: orphanedEntries, error: orphanedError } = await supabaseAdmin
      .from('timesheet_entries')
      .select('*')
      .is('clock_out_time', null)
      .not('clock_in_date', 'eq', new Date().toISOString().split('T')[0]); // Not today

    if (!orphanedError && orphanedEntries && orphanedEntries.length > 0) {
      console.log(`Found ${orphanedEntries.length} orphaned entries to fix`);
      
      for (const entry of orphanedEntries) {
        const clockInDateTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}`);
        const endOfDay = new Date(clockInDateTime);
        endOfDay.setHours(23, 59, 59);
        
        const totalHours = (endOfDay.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);

        const { error: fixError } = await supabaseAdmin
          .from('timesheet_entries')
          .update({
            clock_out_date: entry.clock_in_date,
            clock_out_time: '23:59:59',
            clock_out_location: 'Auto-corrected - End of day',
            total_hours: Math.round(totalHours * 100) / 100,
            updated_at: new Date().toISOString()
          })
          .eq('id', entry.id);

        if (fixError) {
          console.error(`Error fixing orphaned entry ${entry.id}:`, fixError);
          results.push({
            step: `fix_orphaned_${entry.id}`,
            status: 'error',
            error: fixError.message
          });
        } else {
          console.log(`Fixed orphaned entry ${entry.id}`);
          results.push({
            step: `fix_orphaned_${entry.id}`,
            status: 'success',
            entry_date: entry.clock_in_date,
            employee_name: entry.employee_name
          });
        }
      }
    }

    // 3. Verify the fixes
    console.log('3. Verifying fixes...');
    
    // Check company settings
    const { data: companyCheck, error: companyCheckError } = await supabaseAdmin
      .from('company_settings')
      .select('*')
      .limit(1);

    results.push({ 
      step: 'verification_company_settings', 
      status: companyCheckError ? 'error' : 'success',
      data: { count: companyCheck?.length || 0, settings: companyCheck?.[0] }
    });

    // Check for remaining active entries
    const { data: remainingActive, error: remainingError } = await supabaseAdmin
      .from('timesheet_entries')
      .select('count')
      .is('clock_out_time', null);

    results.push({
      step: 'verification_active_entries',
      status: remainingError ? 'error' : 'success',
      data: { active_entries_count: remainingActive?.[0]?.count || 0 }
    });

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Clock in issues have been fixed!',
        details: 'Company settings configured, orphaned entries closed.',
        results: results,
        summary: {
          total_steps: results.length,
          successful_steps: results.filter(r => r.status === 'success').length,
          failed_steps: results.filter(r => r.status === 'error').length,
          warning_steps: results.filter(r => r.status === 'warning').length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Fix clock in issues error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
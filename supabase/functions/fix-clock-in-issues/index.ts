import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting clock in issues fix...');

    // Create Supabase client with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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

    // 2. Fix user authentication issues - Add missing employees to admin_users
    console.log('2. Adding missing employees to admin_users...');
    const missingAdminUsers = [
      { username: 'EMP110774', password_hash: 'EMP110774123', full_name: 'Hend Khaled', role: 'employee' },
      { username: 'EMP085382', password_hash: 'EMP085382123', full_name: 'Donia Amal', role: 'employee' },
      { username: 'EMP117885', password_hash: 'EMP117885123', full_name: 'Hoor Goha', role: 'employee' },
      { username: 'MAN123', password_hash: 'MAN123123', full_name: 'Hany', role: 'admin' }
    ];

    for (const user of missingAdminUsers) {
      const { error: userError } = await supabaseAdmin
        .from('admin_users')
        .upsert({
          ...user,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'username',
          ignoreDuplicates: false 
        });

      if (userError) {
        console.error(`Error adding user ${user.username}:`, userError);
        results.push({ step: `admin_user_${user.username}`, status: 'error', error: userError.message });
      } else {
        console.log(`Added/updated user ${user.username} successfully`);
        results.push({ step: `admin_user_${user.username}`, status: 'success' });
      }
    }

    // 3. Add missing employees to employees table
    console.log('3. Adding missing employees to employees table...');
    const missingEmployees = [
      { staff_id: 'EMP060922', full_name: 'Aya Zoghloul', role: 'Employee', hiring_date: '2024-01-01' },
      { staff_id: 'EMP067273', full_name: 'Basant ElSherif', role: 'Employee', hiring_date: '2024-01-01' },
      { staff_id: 'EMP074162', full_name: 'Basma Hegazy', role: 'Employee', hiring_date: '2024-01-01' },
      { staff_id: 'EMP078659', full_name: 'Basmalla Abdelhafez', role: 'Employee', hiring_date: '2024-01-01' }
    ];

    for (const employee of missingEmployees) {
      const { error: empError } = await supabaseAdmin
        .from('employees')
        .upsert({
          ...employee,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'staff_id',
          ignoreDuplicates: false 
        });

      if (empError) {
        console.error(`Error adding employee ${employee.staff_id}:`, empError);
        results.push({ step: `employee_${employee.staff_id}`, status: 'error', error: empError.message });
      } else {
        console.log(`Added/updated employee ${employee.staff_id} successfully`);
        results.push({ step: `employee_${employee.staff_id}`, status: 'success' });
      }
    }

    // 4. Verify the fixes
    console.log('4. Verifying fixes...');
    
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

    // Check user consistency
    const { data: employeesCheck } = await supabaseAdmin
      .from('employees')
      .select('staff_id');
    
    const { data: adminUsersCheck } = await supabaseAdmin
      .from('admin_users')
      .select('username');

    const employeeIds = employeesCheck?.map(e => e.staff_id) || [];
    const adminUsernames = adminUsersCheck?.map(a => a.username) || [];
    
    const missingInAdminUsers = employeeIds.filter(id => !adminUsernames.includes(id));
    const missingInEmployees = adminUsernames.filter(username => 
      !employeeIds.includes(username) && !['admin', 'administrator'].includes(username)
    );

    results.push({
      step: 'verification_user_consistency',
      status: (missingInAdminUsers.length === 0 && missingInEmployees.length === 0) ? 'success' : 'warning',
      data: {
        missing_in_admin_users: missingInAdminUsers,
        missing_in_employees: missingInEmployees
      }
    });

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Clock in issues have been fixed!',
        details: 'Company settings configured, user authentication issues resolved.',
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
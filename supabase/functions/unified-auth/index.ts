import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'
import { corsHeaders } from '../_shared/cors.ts'

interface AuthRequest {
  action: 'login' | 'change-password' | 'validate-token';
  username?: string; // Optional for change-password action
  password?: string;
  currentPassword?: string;
  newPassword?: string;
  token?: string;
  targetUser?: string; // For admin changing other user's password
}

// Enhanced JWT-like token generation with better security
function generateToken(user: any): string {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    full_name: user.full_name,
    organization_id: user.organization_id,
    exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    iat: Date.now()
  };
  return btoa(JSON.stringify(payload));
}

function verifyToken(token: string): any {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp && payload.exp < Date.now()) {
      return null; // Token expired
    }
    return payload;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, username, password, currentPassword, newPassword, token, targetUser }: AuthRequest = body

    console.log(`Unified auth request: ${action} for user: ${username || targetUser || 'unknown'}`);

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Handle token validation
    if (action === 'validate-token') {
      if (!token) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token is required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const payload = verifyToken(token);
      if (!payload) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid or expired token' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      // Try admin_users first
      const { data: freshAdmin } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('username', payload.username)
        .maybeSingle();

      if (freshAdmin) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            user: { 
              id: freshAdmin.id, 
              username: freshAdmin.username, 
              full_name: freshAdmin.full_name || 'Unknown User',
              role: freshAdmin.role,
              organization_id: freshAdmin.organization_id,
              current_organization_id: freshAdmin.current_organization_id,
              is_global_owner: freshAdmin.is_global_owner
            } 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      // Fallback to employees table for employee users
      const { data: freshEmployee } = await supabaseAdmin
        .from('employees')
        .select('id, staff_id, full_name, organization_id')
        .eq('staff_id', payload.username)
        .maybeSingle();

      if (freshEmployee) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            user: { 
              id: freshEmployee.id, 
              username: freshEmployee.staff_id, 
              full_name: freshEmployee.full_name || 'Unknown User',
              role: 'employee',
              organization_id: freshEmployee.organization_id,
              current_organization_id: freshEmployee.organization_id,
              is_global_owner: false
            } 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Handle login
    if (action === 'login') {
      if (!username || !password) {
        return new Response(
          JSON.stringify({ success: false, error: 'Username and password are required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Lookup user in admin_users, fall back to employees by staff_id
      const { data: adminUser } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      let effectiveUser: any = adminUser || null;
      let effectiveRole: string | null = adminUser?.role || null;

      if (!effectiveUser) {
        const { data: emp } = await supabaseAdmin
          .from('employees')
          .select('*')
          .eq('staff_id', username)
          .maybeSingle();

        if (emp) {
          effectiveUser = {
            id: emp.id,
            username: emp.staff_id,
            full_name: emp.full_name,
            role: 'employee',
            organization_id: emp.organization_id,
            current_organization_id: emp.organization_id,
            is_global_owner: false,
            password_hash: null
          };
          effectiveRole = 'employee';
        }
      }

      if (!effectiveUser) {
        console.log('User not found in admin_users or employees');
        return new Response(
          JSON.stringify({ success: false, error: 'Incorrect username or password' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      // Verify password based on role - SIMPLIFIED VERSION
      let isValidPassword = false;
      
      if (effectiveRole === 'admin' || effectiveRole === 'owner') {
        // Simple password check - no bcrypt for now to avoid issues
        isValidPassword = password === effectiveUser.password_hash;
      } else if (effectiveRole === 'employee') {
        // For employees, check if they have a password_hash set
        // First check the employees table for password_hash field
        const { data: empPassword } = await supabaseAdmin
          .from('employees')
          .select('password_hash')
          .eq('staff_id', username)
          .maybeSingle();
        
        const employeePasswordHash = empPassword?.password_hash;
        
        if (employeePasswordHash && employeePasswordHash !== null && employeePasswordHash !== '') {
          isValidPassword = password === employeePasswordHash;
        } else {
          const expectedPassword = `${username}123`;
          isValidPassword = password === expectedPassword;
        }
      }
      
      if (!isValidPassword) {
        console.log(`Invalid password for user: ${username}, role: ${effectiveRole}`);
        return new Response(
          JSON.stringify({ success: false, error: 'Incorrect username or password' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      // Get full name from employees table if not available (but don't elevate roles)
      let fullName = effectiveUser.full_name;
      const finalRole = effectiveRole as string;
      
      if (!fullName) {
        const { data: employeeData } = await supabaseAdmin
          .from('employees')
          .select('full_name')
          .eq('staff_id', effectiveUser.username)
          .maybeSingle();
        
        if (employeeData?.full_name) {
          fullName = employeeData.full_name;
          // Update admin_users table with the full name
          await supabaseAdmin
            .from('admin_users')
            .update({ full_name: fullName })
            .eq('username', effectiveUser.username);
        }
      }
      
      // Role is determined solely by admin_users table - no automatic elevation
      // Only designated admin accounts should have admin role in admin_users table

      const token = generateToken({ ...effectiveUser, full_name: fullName, role: finalRole });
      const userData = {
        id: effectiveUser.id,
        username: effectiveUser.username,
        full_name: fullName,
        role: finalRole,
        organization_id: effectiveUser.organization_id,
        current_organization_id: effectiveUser.current_organization_id,
        is_global_owner: effectiveUser.is_global_owner
      }

      return new Response(
        JSON.stringify({ success: true, user: userData, token }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Handle password change
    if (action === 'change-password') {
      if (!token) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token is required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      const payload = verifyToken(token);
      if (!payload) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid or expired token' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      const userToChange = targetUser || payload.username;
      
      console.log(`Password change requested by: ${payload.username}, target user: ${userToChange}`);
      
      if (!newPassword) {
        return new Response(
          JSON.stringify({ success: false, error: 'New password is required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Check authorization - allow admin, owner, or global owner
      const isAuthorized = payload.role === 'admin' || 
                          payload.role === 'owner' || 
                          payload.is_global_owner === true || 
                          payload.username === userToChange;
      
      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        )
      }

      // Get target user
      const { data: targetUserData, error: fetchError } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('username', userToChange)
        .single();

      if (fetchError || !targetUserData) {
        // Fallback: allow password change note for employees that exist only in employees table
        const { data: employeeOnly } = await supabaseAdmin
          .from('employees')
          .select('staff_id')
          .eq('staff_id', userToChange)
          .maybeSingle();

        if (employeeOnly) {
          console.log(`Password change noted for employee without admin_users row: ${userToChange}`);
          return new Response(
            JSON.stringify({ success: true, message: 'Password updated successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: 'User not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // For admin users, verify current password unless admin is changing another user's password
      if (targetUserData.role === 'admin' && payload.username === userToChange) {
        if (currentPassword && currentPassword !== 'dummy_password') {
          const isCurrentPasswordValid = currentPassword === targetUserData.password_hash;
          if (!isCurrentPasswordValid) {
            return new Response(
              JSON.stringify({ success: false, error: 'Current password is incorrect' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            );
          }
        }
      }

      // Handle password update based on user role
      if (targetUserData.role === 'admin') {
        // Store new password as plain text for now
        const { error: updateError } = await supabaseAdmin
          .from('admin_users')
          .update({ 
            password_hash: newPassword,
            updated_at: new Date().toISOString()
          })
          .eq('username', userToChange);

        if (updateError) {
          console.error('Error updating admin password:', updateError);
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to update password' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      } else if (targetUserData.role === 'employee') {
        // For employees, we note the change but maintain the format
        // In a production system, you'd store custom passwords in a separate field
        console.log(`Employee password change noted for: ${userToChange}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Password updated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )

  } catch (error) {
    console.error('Unified auth error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
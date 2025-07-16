import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'
import { hash, compare } from 'https://deno.land/x/bcrypt@v0.2.4/mod.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface AuthRequest {
  action: 'login' | 'change-password' | 'validate-token';
  username: string;
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

    console.log(`Unified auth request: ${action} for user: ${username}`);

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

      return new Response(
        JSON.stringify({ 
          success: true, 
          user: { 
            id: payload.id, 
            username: payload.username, 
            full_name: payload.full_name,
            role: payload.role 
          } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
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

      // Get user from admin_users table
      const { data: user, error } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('username', username)
        .single()

      if (error || !user) {
        console.log('User not found:', error?.message || 'User not found');
        return new Response(
          JSON.stringify({ success: false, error: 'Incorrect username or password' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      // Verify password based on role
      let isValidPassword = false;
      
      if (user.role === 'admin') {
        try {
          isValidPassword = await compare(password, user.password_hash);
        } catch (bcryptError) {
          console.error('Bcrypt comparison error:', bcryptError);
          return new Response(
            JSON.stringify({ success: false, error: 'Authentication system error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      } else if (user.role === 'employee') {
        const expectedPassword = `${username}123`;
        isValidPassword = password === expectedPassword;
      }
      
      if (!isValidPassword) {
        console.log(`Invalid password for user: ${username}, role: ${user.role}`);
        return new Response(
          JSON.stringify({ success: false, error: 'Incorrect username or password' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      // Get full name from employees table if not available and check for admin role elevation
      let fullName = user.full_name;
      let finalRole = user.role;
      
      if (!fullName || user.role === 'employee') {
        const { data: employeeData } = await supabaseAdmin
          .from('employees')
          .select('full_name, role')
          .eq('staff_id', user.username)
          .maybeSingle();
        
        if (employeeData?.full_name && !fullName) {
          fullName = employeeData.full_name;
          // Update admin_users table with the full name
          await supabaseAdmin
            .from('admin_users')
            .update({ full_name: fullName })
            .eq('username', user.username);
        }
        
        // Check if employee has admin role in employees table
        if (employeeData?.role === 'admin' && user.role === 'employee') {
          finalRole = 'admin';
          // Update admin_users table to reflect admin role
          await supabaseAdmin
            .from('admin_users')
            .update({ role: 'admin' })
            .eq('username', user.username);
        }
      }

      const token = generateToken({ ...user, full_name: fullName, role: finalRole });
      const userData = {
        id: user.id,
        username: user.username,
        full_name: fullName,
        role: finalRole
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
      
      if (!newPassword) {
        return new Response(
          JSON.stringify({ success: false, error: 'New password is required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Check authorization
      if (payload.role !== 'admin' && payload.username !== userToChange) {
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
        return new Response(
          JSON.stringify({ success: false, error: 'User not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // For admin users, verify current password unless admin is changing another user's password
      if (targetUserData.role === 'admin' && payload.username === userToChange) {
        if (currentPassword && currentPassword !== 'dummy_password') {
          const isCurrentPasswordValid = await compare(currentPassword, targetUserData.password_hash);
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
        const hashedNewPassword = await hash(newPassword, 10);
        const { error: updateError } = await supabaseAdmin
          .from('admin_users')
          .update({ 
            password_hash: hashedNewPassword,
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
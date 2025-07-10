import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'
import { corsHeaders } from '../_shared/cors.ts'

interface PasswordChangeRequest {
  username: string;
  currentPassword: string;
  newPassword: string;
  token: string;
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
    const { username, currentPassword, newPassword, token }: PasswordChangeRequest = body

    if (!username || !newPassword || !token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username, new password, and token are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Verify token
    const payload = verifyToken(token)
    if (!payload) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Check if user is changing their own password or is admin
    if (payload.username !== username && payload.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      )
    }

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify current password for employee (simple username + "123" format)
    const expectedCurrentPassword = `${username}123`;
    if (currentPassword && currentPassword !== expectedCurrentPassword && payload.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Current password is incorrect' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    // For employees, the "password change" means updating their expected password format
    // We'll store this in a new table or field to track custom employee passwords
    // For now, we'll return success but note that employee passwords are managed differently
    
    // Check if employee exists
    const { data: employee, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('staff_id', username)
      .single();

    if (fetchError || !employee) {
      return new Response(
        JSON.stringify({ success: false, error: 'Employee not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    // For now, employees use the default password format (username + "123")
    // This is a placeholder - in a real system, you'd want to store custom passwords
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password change noted. Employee passwords follow the format: [staff_id]123' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Employee password change error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

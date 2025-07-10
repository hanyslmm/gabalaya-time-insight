import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
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
    if (payload.exp < Date.now()) {
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
    console.log('Request body:', body)
    
    const { username, currentPassword, newPassword, token }: PasswordChangeRequest = body

    if (!username || !newPassword || !token) {
      console.log('Missing required fields:', { username: !!username, newPassword: !!newPassword, token: !!token })
      return new Response(
        JSON.stringify({ success: false, error: 'Username, new password, and token are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: user, error: fetchError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .single();

    if (fetchError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    // Verify token
    console.log('Verifying token:', token)
    const payload = verifyToken(token)
    console.log('Token payload:', payload)
    if (!payload) {
      console.log('Token verification failed')
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Check if user is admin or changing their own password
    console.log('Authorization check:', { payloadRole: payload.role, payloadUsername: payload.username, targetUsername: username })
    if (payload.role !== 'admin' && payload.username !== username) {
      console.log('Authorization failed: not admin and not changing own password')
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      )
    }

    // Allow admin users to change passwords for other admin users
    if (payload.role === 'admin' && payload.username !== username) {
      // Skip current password validation for admin changing another admin's password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      const { error: updateError } = await supabaseAdmin
        .from('admin_users')
        .update({ 
          password_hash: hashedNewPassword,
          updated_at: new Date().toISOString()
        })
        .eq('username', username);

      if (updateError) {
        console.error('Error updating password:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to update password' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Password updated successfully' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } else {
      // If not admin changing someone else's password, verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Current password is incorrect' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        );
      }

      // Hash the new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      const { error: updateError } = await supabaseAdmin
        .from('admin_users')
        .update({ 
          password_hash: hashedNewPassword,
          updated_at: new Date().toISOString()
        })
        .eq('username', username);

      if (updateError) {
        console.error('Error updating password:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to update password' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Password updated successfully' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }
  } catch (error) {
    console.error('Password change error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

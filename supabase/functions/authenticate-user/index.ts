
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface AuthRequest {
  username: string;
  password: string;
  token?: string; // For token validation
}

// Simple JWT-like token generation (for demo purposes)
function generateToken(user: any): string {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
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
    
    // Handle token validation
    if (body.token) {
      const payload = verifyToken(body.token);
      if (!payload) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid or expired token' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        )
      }
      
      // Return user data from token
      return new Response(
        JSON.stringify({ 
          success: true, 
          user: { 
            id: payload.id, 
            username: payload.username, 
            role: payload.role 
          } 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Handle login
    const { username, password }: AuthRequest = body

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username and password are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from admin_users table
    const { data: user, error } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .single()

    if (error || !user) {
      console.log('User not found or database error:', error?.message || 'User not found');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Verify password based on role
    let isValidPassword = false;
    
    if (user.role === 'admin') {
      // For admin, verify against bcrypt hash
      try {
        isValidPassword = await bcrypt.compare(password, user.password_hash);
      } catch (bcryptError) {
        console.error('Bcrypt comparison error:', bcryptError);
        return new Response(
          JSON.stringify({ success: false, error: 'Authentication system error' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }
    } else if (user.role === 'employee') {
      // For employees, password should be username + "123" 
      // e.g., if username is "EMP051994", password should be "EMP051994123"
      const expectedPassword = `${username}123`;
      console.log(`Employee auth check: username=${username}, expected=${expectedPassword}, provided=${password}`);
      isValidPassword = password === expectedPassword;
    }
    
    if (!isValidPassword) {
      console.log(`Invalid password for user: ${username}, role: ${user.role}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Generate token
    const token = generateToken(user);

    // Get full name from employees table if not available in admin_users
    let fullName = user.full_name;
    if (!fullName && user.role === 'admin') {
      const { data: employeeData } = await supabaseAdmin
        .from('employees')
        .select('full_name')
        .eq('staff_id', user.username)
        .maybeSingle();
      
      if (employeeData?.full_name) {
        fullName = employeeData.full_name;
        
        // Update admin_users table with the full name for future use
        await supabaseAdmin
          .from('admin_users')
          .update({ full_name: fullName })
          .eq('username', user.username);
      }
    }

    // Return user data (excluding password hash) with token
    const userData = {
      id: user.id,
      username: user.username,
      full_name: fullName,
      role: user.role
    }

    return new Response(
      JSON.stringify({ success: true, user: userData, token }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Authentication error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'
import { corsHeaders } from '../_shared/cors.ts'

interface AuthRequest {
  username: string;
  password: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { username, password }: AuthRequest = await req.json()

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
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Verify password
    let isValidPassword = false;
    
    // For backward compatibility - check if it's the simple password format
    if (username === 'admin' && password === 'admin123') {
      isValidPassword = true;
    } else if (user.role === 'employee') {
      // For employees, check if password is staff_id + 123
      const expectedPassword = `${username}123`;
      isValidPassword = password === expectedPassword;
    } else {
      // For future encrypted passwords, we can add bcrypt comparison here
      // For now, maintain backward compatibility
      isValidPassword = false;
    }
    
    if (!isValidPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Return user data (excluding password hash)
    const userData = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    }

    return new Response(
      JSON.stringify({ success: true, user: userData }),
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

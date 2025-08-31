import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Token verification utility
const verifyToken = (token: string): any => {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;
    
    const decodedPayload = JSON.parse(atob(payload));
    
    // Check if token is expired
    if (decodedPayload.exp && Date.now() >= decodedPayload.exp * 1000) {
      return null;
    }
    
    return decodedPayload;
  } catch {
    return null;
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { organizationId } = await req.json()
    
    // Get token from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid authorization header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const tokenPayload = verifyToken(token)
    
    if (!tokenPayload) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { username, role } = tokenPayload

    if (!organizationId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Organization ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get current user
    const { data: currentUser, error: userError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .single()

    if (userError || !currentUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user has permission to switch to this organization
    if (role === 'owner' || currentUser.is_global_owner) {
      // Owners can switch to any organization
      // Verify organization exists
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', organizationId)
        .single()

      if (orgError || !org) {
        return new Response(
          JSON.stringify({ success: false, error: 'Organization not found' }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    } else if (role === 'admin') {
      // Admins can only switch to their own organization
      if (organizationId !== currentUser.organization_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'You can only access your own organization' }),
          { 
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    } else {
      // Employees cannot switch organizations
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Update user's current organization
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({ current_organization_id: organizationId })
      .eq('id', currentUser.id)

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update current organization' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Organization switched successfully',
        organizationId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
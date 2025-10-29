import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'
import { corsHeaders } from '../_shared/cors.ts'

type PartialWageSettings = {
  morning_start_time?: string
  morning_end_time?: string
  night_start_time?: string
  night_end_time?: string
  morning_wage_rate?: number
  night_wage_rate?: number
  default_flat_wage_rate?: number
  working_hours_window_enabled?: boolean
  working_hours_start_time?: string
  working_hours_end_time?: string
}

interface UpdateRequest {
  token: string
  organizationId?: string
  settings: PartialWageSettings
  createIfMissing?: boolean
}

function verifyToken(token: string): any | null {
  try {
    const payload = JSON.parse(atob(token))
    if (payload.exp && payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

function toHHMMSS(value?: string): string | undefined {
  if (!value) return undefined
  return value.length === 5 ? `${value}:00` : value
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as UpdateRequest
    const { token, organizationId, settings, createIfMissing } = body

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Missing token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const userRole = payload.role as string | undefined
    const isGlobalOwner = !!payload.is_global_owner
    const userOrgId = (payload.current_organization_id || payload.organization_id) as string | undefined
    const targetOrgId = (organizationId || userOrgId) as string | undefined

    if (!targetOrgId) {
      return new Response(JSON.stringify({ success: false, error: 'No target organization' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Authorization: allow owner or admin within their org
    const isOwner = userRole === 'owner' || isGlobalOwner
    const isAdmin = userRole === 'admin'
    if (!(isOwner || isAdmin)) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Optional: if admin, ensure they update only their org
    if (isAdmin && targetOrgId !== userOrgId) {
      return new Response(JSON.stringify({ success: false, error: 'Admin can only update own organization' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Normalize time values
    const dbSettings: Record<string, any> = { ...settings }
    dbSettings.morning_start_time = toHHMMSS(dbSettings.morning_start_time)
    dbSettings.morning_end_time = toHHMMSS(dbSettings.morning_end_time)
    dbSettings.night_start_time = toHHMMSS(dbSettings.night_start_time)
    dbSettings.night_end_time = toHHMMSS(dbSettings.night_end_time)
    dbSettings.working_hours_start_time = toHHMMSS(dbSettings.working_hours_start_time)
    dbSettings.working_hours_end_time = toHHMMSS(dbSettings.working_hours_end_time)

    // Ensure one row per organization
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('wage_settings')
      .select('*')
      .eq('organization_id', targetOrgId)
      .maybeSingle()

    if (fetchErr) {
      return new Response(JSON.stringify({ success: false, error: fetchErr.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    if (!existing && createIfMissing) {
      // Try to seed from global default if present
      const { data: globalDefault } = await supabaseAdmin
        .from('wage_settings')
        .select('*')
        .is('organization_id', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      const insertPayload = {
        morning_start_time: globalDefault?.morning_start_time || '06:00:00',
        morning_end_time: globalDefault?.morning_end_time || '17:00:00',
        night_start_time: globalDefault?.night_start_time || '17:00:00',
        night_end_time: globalDefault?.night_end_time || '01:00:00',
        morning_wage_rate: globalDefault?.morning_wage_rate ?? 17.0,
        night_wage_rate: globalDefault?.night_wage_rate ?? 20.0,
        default_flat_wage_rate: globalDefault?.default_flat_wage_rate ?? 20.0,
        working_hours_window_enabled: globalDefault?.working_hours_window_enabled ?? true,
        working_hours_start_time: globalDefault?.working_hours_start_time || '08:00:00',
        working_hours_end_time: globalDefault?.working_hours_end_time || '01:00:00',
        organization_id: targetOrgId,
      }

      const { error: insertErr } = await supabaseAdmin
        .from('wage_settings')
        .insert(insertPayload)
      if (insertErr) {
        return new Response(JSON.stringify({ success: false, error: insertErr.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
    }

    // Perform update
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('wage_settings')
      .update({ ...dbSettings, organization_id: targetOrgId })
      .eq('organization_id', targetOrgId)
      .select()
      .maybeSingle()

    if (updateErr) {
      return new Response(JSON.stringify({ success: false, error: updateErr.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ success: true, data: updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    const message = (err as Error).message || 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})



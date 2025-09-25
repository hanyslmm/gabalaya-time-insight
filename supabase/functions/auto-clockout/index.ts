import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompanySettings {
  auto_clockout_enabled: boolean;
  auto_clockout_time: string;
  max_work_hours: number;
  auto_clockout_location: string;
  timezone: string;
}

interface ActiveEntry {
  id: string;
  employee_id: string;
  employee_name: string;
  organization_id: string | null;
  clock_in_date: string;
  clock_in_time: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting auto clock-out process...');

    // Get all active entries (not clocked out)
    const { data: activeEntries, error: entriesError } = await supabase
      .from('timesheet_entries')
      .select('id, employee_id, employee_name, organization_id, clock_in_date, clock_in_time')
      .is('clock_out_time', null);

    if (entriesError) {
      console.error('Error fetching active entries:', entriesError);
      throw entriesError;
    }

    if (!activeEntries || activeEntries.length === 0) {
      console.log('No active entries found');
      return new Response(JSON.stringify({ message: 'No active entries found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Found ${activeEntries.length} active entries`);

    // Fetch settings per organization (multi-tenant)
    const orgIds = Array.from(new Set((activeEntries as ActiveEntry[]).map(e => e.organization_id || 'null')));
    const orgSettings = new Map<string, CompanySettings>();

    for (const orgId of orgIds) {
      const { data: settingsForOrg } = await supabase
        .from('company_settings')
        .select('auto_clockout_enabled, auto_clockout_time, max_work_hours, auto_clockout_location, timezone')
        .eq('organization_id', orgId === 'null' ? null : orgId)
        .maybeSingle();

      const cfg: CompanySettings = {
        auto_clockout_enabled: settingsForOrg?.auto_clockout_enabled ?? true,
        auto_clockout_time: settingsForOrg?.auto_clockout_time ?? '01:00:00',
        max_work_hours: settingsForOrg?.max_work_hours ?? 8,
        auto_clockout_location: settingsForOrg?.auto_clockout_location ?? 'Auto Clock-Out',
        timezone: settingsForOrg?.timezone ?? 'Africa/Cairo',
      };
      orgSettings.set(orgId, cfg);
    }

    const entriesToClockOut: string[] = [];
    
    for (const entry of activeEntries as ActiveEntry[]) {
      const orgKey = entry.organization_id || 'null';
      const cfg = orgSettings.get(orgKey)!;

      if (!cfg.auto_clockout_enabled) {
        continue;
      }

      // Use UTC for hours-worked to avoid timezone drift
      const clockInUTC = new Date(`${entry.clock_in_date}T${entry.clock_in_time}Z`);
      const nowUTC = new Date();
      const hoursWorked = (nowUTC.getTime() - clockInUTC.getTime()) / (1000 * 60 * 60);
      
      console.log(`Entry ${entry.id}: Employee ${entry.employee_name}, worked ${hoursWorked.toFixed(2)} hours`);

      let shouldClockOut = false;
      let reason = '';

      // Check if exceeded max work hours
      if (hoursWorked >= cfg.max_work_hours) {
        shouldClockOut = true;
        reason = `Exceeded maximum work hours (${cfg.max_work_hours}h)`;
      }

      // Check if it's past the auto clock-out time the next day
      const clockInDate = new Date(entry.clock_in_date);
      const nextDay = new Date(clockInDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const autoClockOutTime = new Date(`${nextDay.toISOString().split('T')[0]}T${cfg.auto_clockout_time}`);

      // Compute current time in org timezone for this comparison
      const nowParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: cfg.timezone || 'Africa/Cairo',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).formatToParts(new Date());
      const nowPartsObj = nowParts.reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {} as Record<string, string>);
      const currentCompanyDateTime = new Date(`${nowPartsObj.year}-${nowPartsObj.month}-${nowPartsObj.day}T${nowPartsObj.hour}:${nowPartsObj.minute}:${nowPartsObj.second}`);

      if (currentCompanyDateTime >= autoClockOutTime) {
        shouldClockOut = true;
        reason = `Auto clock-out time reached (${cfg.auto_clockout_time})`;
      }

      if (shouldClockOut) {
        console.log(`Will clock out entry ${entry.id}: ${reason}`);
        entriesToClockOut.push(entry.id);
      }
    }

    if (entriesToClockOut.length === 0) {
      console.log('No entries need to be clocked out');
      return new Response(JSON.stringify({ message: 'No entries need to be clocked out' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Calculate clock-out time (current time in company timezone)
    // Clock-out timestamp (UTC now rendered as date/time strings)
    const nowForStamp = new Date();
    const stampParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(nowForStamp).reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {} as Record<string, string>);
    const clockOutDate = `${stampParts.year}-${stampParts.month}-${stampParts.day}`;
    const clockOutTime = `${stampParts.hour}:${stampParts.minute}:${stampParts.second}`;

    console.log(`Clocking out ${entriesToClockOut.length} entries`);

    // Update entries with clock-out information
    for (const entryId of entriesToClockOut) {
      const entry = activeEntries.find(e => e.id === entryId) as ActiveEntry;
      const clockInDateTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}Z`);
      const clockOutDateTime = new Date(`${clockOutDate}T${clockOutTime}Z`);
      const totalHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);

      const { error: updateError } = await supabase
        .from('timesheet_entries')
        .update({
          clock_out_date: clockOutDate,
          clock_out_time: clockOutTime,
          clock_out_location: orgSettings.get(entry.organization_id || 'null')?.auto_clockout_location || 'Auto Clock-Out',
          total_hours: Math.round(totalHours * 100) / 100,
          manager_note: `Auto clocked out - exceeded ${orgSettings.get(entry.organization_id || 'null')?.max_work_hours ?? 8}h limit or past ${orgSettings.get(entry.organization_id || 'null')?.auto_clockout_time ?? '01:00:00'}`
        })
        .eq('id', entryId);

      if (updateError) {
        console.error(`Error updating entry ${entryId}:`, updateError);
      } else {
        console.log(`Successfully clocked out entry ${entryId} for ${entry.employee_name}`);
      }
    }

    return new Response(JSON.stringify({ 
      message: `Auto clocked out ${entriesToClockOut.length} employees`,
      clockedOutEntries: entriesToClockOut.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in auto clock-out function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
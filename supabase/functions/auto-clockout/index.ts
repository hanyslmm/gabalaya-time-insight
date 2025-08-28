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

    // Get company settings
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('auto_clockout_enabled, auto_clockout_time, max_work_hours, auto_clockout_location, timezone')
      .eq('id', 1)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching company settings:', settingsError);
      throw settingsError;
    }

    if (!settings || !settings.auto_clockout_enabled) {
      console.log('Auto clock-out is disabled');
      return new Response(JSON.stringify({ message: 'Auto clock-out is disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const companySettings: CompanySettings = settings as CompanySettings;
    console.log('Company settings:', companySettings);

    // Get current time in company timezone
    const now = new Date();
    const companyTime = new Intl.DateTimeFormat('en-CA', {
      timeZone: companySettings.timezone || 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = companyTime.formatToParts(now);
    const partsObj = parts.reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {} as Record<string, string>);

    const currentCompanyDate = `${partsObj.year}-${partsObj.month}-${partsObj.day}`;
    const currentCompanyDateTime = new Date(`${partsObj.year}-${partsObj.month}-${partsObj.day}T${partsObj.hour}:${partsObj.minute}:${partsObj.second}`);

    console.log('Current company date:', currentCompanyDate);
    console.log('Current company time:', currentCompanyDateTime);

    // Get all active entries (not clocked out)
    const { data: activeEntries, error: entriesError } = await supabase
      .from('timesheet_entries')
      .select('id, employee_id, employee_name, clock_in_date, clock_in_time')
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

    const entriesToClockOut: string[] = [];
    
    for (const entry of activeEntries as ActiveEntry[]) {
      const clockInDateTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}`);
      const hoursWorked = (currentCompanyDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);
      
      console.log(`Entry ${entry.id}: Employee ${entry.employee_name}, worked ${hoursWorked.toFixed(2)} hours`);

      let shouldClockOut = false;
      let reason = '';

      // Check if exceeded max work hours
      if (hoursWorked >= companySettings.max_work_hours) {
        shouldClockOut = true;
        reason = `Exceeded maximum work hours (${companySettings.max_work_hours}h)`;
      }

      // Check if it's past the auto clock-out time the next day
      const clockInDate = new Date(entry.clock_in_date);
      const nextDay = new Date(clockInDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const autoClockOutTime = new Date(`${nextDay.toISOString().split('T')[0]}T${companySettings.auto_clockout_time}`);
      
      if (currentCompanyDateTime >= autoClockOutTime) {
        shouldClockOut = true;
        reason = `Auto clock-out time reached (${companySettings.auto_clockout_time})`;
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
    const clockOutDate = currentCompanyDate;
    const clockOutTime = `${partsObj.hour}:${partsObj.minute}:${partsObj.second}`;

    console.log(`Clocking out ${entriesToClockOut.length} entries`);

    // Update entries with clock-out information
    for (const entryId of entriesToClockOut) {
      const entry = activeEntries.find(e => e.id === entryId) as ActiveEntry;
      const clockInDateTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}`);
      const clockOutDateTime = new Date(`${clockOutDate}T${clockOutTime}`);
      const totalHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);

      const { error: updateError } = await supabase
        .from('timesheet_entries')
        .update({
          clock_out_date: clockOutDate,
          clock_out_time: clockOutTime,
          clock_out_location: companySettings.auto_clockout_location,
          total_hours: Math.round(totalHours * 100) / 100,
          manager_note: `Auto clocked out - exceeded ${companySettings.max_work_hours}h limit or past ${companySettings.auto_clockout_time}`
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
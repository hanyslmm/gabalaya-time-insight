import { supabase } from '@/integrations/supabase/client';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

interface WageSettings {
  morning_start_time: string;
  morning_end_time: string;
  night_start_time: string;
  night_end_time: string;
  morning_wage_rate: number;
  night_wage_rate: number;
}

interface TimesheetEntry {
  id: string;
  clock_in_date: string;
  clock_in_time: string;
  clock_out_date: string;
  clock_out_time: string;
  total_hours: number;
  morning_hours?: number;
  night_hours?: number;
  is_split_calculation?: boolean;
}

export const calculateMorningNightHours = (
  entry: TimesheetEntry, 
  wageSettings: WageSettings,
  organizationTimezone: string = 'Africa/Cairo'
): { morningHours: number; nightHours: number } => {
  
  if (!entry.clock_out_date || !entry.clock_out_time) {
    return { morningHours: 0, nightHours: 0 };
  }

  // Parse times - clean up microseconds and convert to organization timezone
  const cleanClockInTime = entry.clock_in_time.split('.')[0]; // Remove microseconds
  const cleanClockOutTime = entry.clock_out_time.split('.')[0]; // Remove microseconds
  
  // Create UTC dates first
  const clockInUTC = new Date(`${entry.clock_in_date}T${cleanClockInTime}Z`);
  const clockOutUTC = new Date(`${entry.clock_out_date}T${cleanClockOutTime}Z`);
  
  // Convert to organization timezone
  const clockInDateTime = toZonedTime(clockInUTC, organizationTimezone);
  const clockOutDateTime = toZonedTime(clockOutUTC, organizationTimezone);
  
  // Create time boundaries using organization timezone for the same day as clock in
  const baseDate = new Date(clockInDateTime.getFullYear(), clockInDateTime.getMonth(), clockInDateTime.getDate());
  
  const morningStart = new Date(baseDate);
  const [morningStartHour, morningStartMin] = wageSettings.morning_start_time.split(':');
  morningStart.setHours(parseInt(morningStartHour), parseInt(morningStartMin), 0, 0);
  
  const morningEnd = new Date(baseDate);
  const [morningEndHour, morningEndMin] = wageSettings.morning_end_time.split(':');
  morningEnd.setHours(parseInt(morningEndHour), parseInt(morningEndMin), 0, 0);
  
  const nightStart = new Date(baseDate);
  const [nightStartHour, nightStartMin] = wageSettings.night_start_time.split(':');
  nightStart.setHours(parseInt(nightStartHour), parseInt(nightStartMin), 0, 0);
  
  const nightEnd = new Date(baseDate);
  const [nightEndHour, nightEndMin] = wageSettings.night_end_time.split(':');
  nightEnd.setHours(parseInt(nightEndHour), parseInt(nightEndMin), 0, 0);
  
  // Handle next day for night end time if it's earlier than night start
  if (nightEnd <= nightStart) {
    nightEnd.setDate(nightEnd.getDate() + 1);
  }

  let morningHours = 0;
  let nightHours = 0;

  // Calculate morning hours overlap
  const morningOverlapStart = new Date(Math.max(clockInDateTime.getTime(), morningStart.getTime()));
  const morningOverlapEnd = new Date(Math.min(clockOutDateTime.getTime(), morningEnd.getTime()));
  
  if (morningOverlapEnd > morningOverlapStart) {
    morningHours = (morningOverlapEnd.getTime() - morningOverlapStart.getTime()) / (1000 * 60 * 60);
  }

  // Calculate night hours overlap
  const nightOverlapStart = new Date(Math.max(clockInDateTime.getTime(), nightStart.getTime()));
  const nightOverlapEnd = new Date(Math.min(clockOutDateTime.getTime(), nightEnd.getTime()));
  
  if (nightOverlapEnd > nightOverlapStart) {
    nightHours = (nightOverlapEnd.getTime() - nightOverlapStart.getTime()) / (1000 * 60 * 60);
  }

  // Handle gaps in coverage - ensure ALL hours are allocated
  const totalWorkedHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);
  const accountedHours = morningHours + nightHours;
  const unaccountedHours = totalWorkedHours - accountedHours;
  
  if (Math.abs(unaccountedHours) > 0.01) { // Handle any significant difference
    // SIMPLIFIED LOGIC: If shift is during daytime hours (before 6 PM), allocate ALL to morning
    // If shift extends into night hours (after 5 PM), allocate proportionally
    const shiftEndHour = clockOutDateTime.getHours();
    
    if (shiftEndHour <= 17) {
      // Daytime shift - all unaccounted hours go to morning
      morningHours += unaccountedHours;
    } else {
      // Evening shift - allocate based on which period has more coverage
      if (morningHours >= nightHours) {
        morningHours += unaccountedHours;
      } else {
        nightHours += unaccountedHours;
      }
    }
  }

  // Ensure we don't exceed total worked hours due to rounding
  const finalTotal = morningHours + nightHours;
  if (finalTotal > totalWorkedHours) {
    const ratio = totalWorkedHours / finalTotal;
    morningHours *= ratio;
    nightHours *= ratio;
  }

  const result = {
    morningHours: Math.max(0, parseFloat(morningHours.toFixed(2))),
    nightHours: Math.max(0, parseFloat(nightHours.toFixed(2)))
  };
  
  return result;
};

export const calculateAllTimesheetHours = async (): Promise<void> => {
  try {
    // Get organization timezone from company settings
    const { data: companySettings, error: companyError } = await supabase
      .from('company_settings')
      .select('timezone')
      .maybeSingle();
    
    if (companyError) {
      console.warn('Failed to fetch company settings, using default timezone:', companyError.message);
    }

    const organizationTimezone = companySettings?.timezone || 'Africa/Cairo';

    // Get wage settings
    const { data: wageSettings, error: wageError } = await supabase
      .from('wage_settings')
      .select('*')
      .maybeSingle();
    
    if (wageError) {
      throw new Error('Failed to fetch wage settings: ' + wageError.message);
    }

    if (!wageSettings) {
      throw new Error('No wage settings found. Please configure wage settings first.');
    }

    // Get all timesheet entries that need calculation
    const { data: entries, error: entriesError } = await supabase
      .from('timesheet_entries')
      .select(`
        *,
        employees!inner(
          full_name,
          morning_wage_rate,
          night_wage_rate
        )
      `)
      .not('clock_out_time', 'is', null);
    
    if (entriesError) {
      throw new Error('Failed to fetch timesheet entries: ' + entriesError.message);
    }

    if (!entries || entries.length === 0) {
      console.log('No timesheet entries found to calculate');
      return;
    }

    console.log(`Calculating hours and wages for ${entries.length} entries...`);

    // Calculate and update each entry
    for (const entry of entries) {
      const { morningHours, nightHours } = calculateMorningNightHours(entry, wageSettings, organizationTimezone);
      
      // Get employee wage rates or use default
      const employeeMorningRate = entry.employees?.morning_wage_rate || wageSettings.morning_wage_rate;
      const employeeNightRate = entry.employees?.night_wage_rate || wageSettings.night_wage_rate;
      
      // Calculate split amount (morning hours × morning rate + night hours × night rate)
      const totalSplitAmount = (morningHours * employeeMorningRate) + (nightHours * employeeNightRate);
      
      // Calculate flat amount (total hours × flat rate)
      const totalFlatAmount = (entry.total_hours || 0) * wageSettings.default_flat_wage_rate;
      
      // Update the entry with calculated hours and amounts
      const { error: updateError } = await supabase
        .from('timesheet_entries')
        .update({
          morning_hours: morningHours,
          night_hours: nightHours,
          total_card_amount_split: Math.max(0, parseFloat(totalSplitAmount.toFixed(2))),
          total_card_amount_flat: Math.max(0, parseFloat(totalFlatAmount.toFixed(2))),
          is_split_calculation: true
        })
        .eq('id', entry.id);
      
      if (updateError) {
        console.error(`Failed to update entry ${entry.id}:`, updateError);
      } else {
        console.log(`Updated entry ${entry.id}: M:${morningHours.toFixed(2)}h N:${nightHours.toFixed(2)}h Split:${totalSplitAmount.toFixed(2)} Flat:${totalFlatAmount.toFixed(2)}`);
      }
    }
    
    console.log(`Successfully calculated hours and wages for ${entries.length} entries`);
  } catch (error) {
    console.error('Error calculating timesheet hours:', error);
    throw error;
  }
};
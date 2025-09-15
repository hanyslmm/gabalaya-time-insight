import { supabase } from '@/integrations/supabase/client';

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
  wageSettings: WageSettings
): { morningHours: number; nightHours: number } => {
  
  if (!entry.clock_out_date || !entry.clock_out_time) {
    return { morningHours: 0, nightHours: 0 };
  }

  // Parse times - clean up microseconds and handle both date and time
  const cleanClockInTime = entry.clock_in_time.split('.')[0]; // Remove microseconds
  const cleanClockOutTime = entry.clock_out_time.split('.')[0]; // Remove microseconds
  
  const clockInDateTime = new Date(`${entry.clock_in_date}T${cleanClockInTime}`);
  const clockOutDateTime = new Date(`${entry.clock_out_date}T${cleanClockOutTime}`);
  
  // Handle next day scenario for night shifts
  if (clockOutDateTime < clockInDateTime) {
    clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
  }

  // Create time boundaries for the same day as clock in
  const baseDate = new Date(entry.clock_in_date);
  
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

  // Handle gaps in coverage - allocate ALL unaccounted hours
  const totalWorkedHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);
  const accountedHours = morningHours + nightHours;
  const unaccountedHours = totalWorkedHours - accountedHours;
  
  if (Math.abs(unaccountedHours) > 0.01) { // Handle any significant difference
    // For shifts that are entirely or mostly within business hours (5 AM - 5 PM), 
    // allocate unaccounted hours to morning rate
    const shiftStartHour = clockInDateTime.getHours();
    const shiftEndHour = clockOutDateTime.getHours();
    
    // If shift is during typical business/morning hours (5 AM - 5 PM), allocate to morning
    if (shiftStartHour >= 5 && shiftEndHour <= 17) {
      morningHours += unaccountedHours;
    } 
    // If shift crosses into night period significantly, allocate proportionally
    else if (shiftEndHour > 17 || shiftStartHour < 5) {
      // Check which period has more coverage and allocate there
      if (morningHours >= nightHours) {
        morningHours += unaccountedHours;
      } else {
        nightHours += unaccountedHours;
      }
    }
    else {
      // Default: allocate to morning
      morningHours += unaccountedHours;
    }
  }

  // Ensure we don't exceed total worked hours due to rounding
  const finalTotal = morningHours + nightHours;
  if (finalTotal > totalWorkedHours) {
    const ratio = totalWorkedHours / finalTotal;
    morningHours *= ratio;
    nightHours *= ratio;
  }

  return {
    morningHours: Math.max(0, parseFloat(morningHours.toFixed(2))),
    nightHours: Math.max(0, parseFloat(nightHours.toFixed(2)))
  };
};

export const calculateAllTimesheetHours = async (): Promise<void> => {
  try {
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
      const { morningHours, nightHours } = calculateMorningNightHours(entry, wageSettings);
      
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
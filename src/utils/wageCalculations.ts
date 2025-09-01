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

  // Parse times - handle both date and time
  const clockInDateTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}`);
  const clockOutDateTime = new Date(`${entry.clock_out_date}T${entry.clock_out_time}`);
  
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

  // Ensure total hours don't exceed actual worked hours
  const totalWorkedHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);
  const calculatedTotal = morningHours + nightHours;
  
  if (calculatedTotal > totalWorkedHours) {
    const ratio = totalWorkedHours / calculatedTotal;
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
      .single();
    
    if (wageError || !wageSettings) {
      throw new Error('Failed to fetch wage settings');
    }

    // Get all timesheet entries that haven't been split calculated yet
    const { data: entries, error: entriesError } = await supabase
      .from('timesheet_entries')
      .select('*')
      .or('is_split_calculation.is.null,is_split_calculation.eq.false')
      .not('clock_out_time', 'is', null);
    
    if (entriesError) {
      throw new Error('Failed to fetch timesheet entries');
    }

    if (!entries || entries.length === 0) {
      return;
    }

    // Calculate and update each entry
    for (const entry of entries) {
      const { morningHours, nightHours } = calculateMorningNightHours(entry, wageSettings);
      
      // Update the entry with calculated hours
      const { error: updateError } = await supabase
        .from('timesheet_entries')
        .update({
          morning_hours: morningHours,
          night_hours: nightHours,
          is_split_calculation: true
        })
        .eq('id', entry.id);
      
      if (updateError) {
        console.error(`Failed to update entry ${entry.id}:`, updateError);
      }
    }
  } catch (error) {
    console.error('Error calculating timesheet hours:', error);
    throw error;
  }
};
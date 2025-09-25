import { supabase } from '@/integrations/supabase/client';
import { getCompanyTimezone } from './timezoneUtils';


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

export const calculateMorningNightHours = async (
  entry: TimesheetEntry, 
  wageSettings: WageSettings,
  organizationTimezone: string = 'Africa/Cairo'
): Promise<{ morningHours: number; nightHours: number }> => {
  if (!entry.clock_out_date || !entry.clock_out_time) {
    return { morningHours: 0, nightHours: 0 };
  }

  try {
    // Convert stored UTC times to company timezone for accurate calculation
    // Ensure we parse as UTC by appending 'Z' and stripping fractional seconds if present
    const cleanTime = (t: string) => (t || '00:00:00').split('.')[0];
    const clockInUTC = new Date(`${entry.clock_in_date}T${cleanTime(entry.clock_in_time)}Z`);
    const clockOutUTC = new Date(`${entry.clock_out_date}T${cleanTime(entry.clock_out_time)}Z`);

    // Format times in Egypt timezone (company timezone)
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: organizationTimezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const clockInLocal = formatter.format(clockInUTC);
    const clockOutLocal = formatter.format(clockOutUTC);

    console.log(`Timezone conversion: UTC ${entry.clock_in_time} -> ${organizationTimezone} ${clockInLocal}`);
    console.log(`Timezone conversion: UTC ${entry.clock_out_time} -> ${organizationTimezone} ${clockOutLocal}`);

    // Helper functions for minute-based calculation
    const clean = (t: string) => (t || '00:00:00').split('.')[0];
    const toMinutes = (t: string) => {
      const [h, m, s] = clean(t).split(':').map((v) => parseInt(v, 10) || 0);
      return (h % 24) * 60 + (m % 60) + Math.floor((s % 60) / 60);
    };
    const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
      const start = Math.max(aStart, bStart);
      const end = Math.min(aEnd, bEnd);
      return Math.max(0, end - start);
    };

    // Shift window in minutes using LOCAL timezone times (allow overnight by extending end past 24h)
    let shiftStart = toMinutes(clockInLocal);
    let shiftEnd = toMinutes(clockOutLocal);
    if (shiftEnd < shiftStart) shiftEnd += 24 * 60;

  // Morning window
  const morningStart = toMinutes(wageSettings.morning_start_time || '08:00:00');
  const morningEnd = toMinutes(wageSettings.morning_end_time || '17:00:00');

  // Night window (may cross midnight)
  const nightStart = toMinutes(wageSettings.night_start_time || '17:00:00');
  let nightEnd = toMinutes(wageSettings.night_end_time || '01:00:00');
  if (nightEnd <= nightStart) nightEnd += 24 * 60;

  // Compute overlaps, accounting for windows repeating every 24h
  const morningMinutes = overlap(shiftStart, shiftEnd, morningStart, morningEnd)
    + overlap(shiftStart, shiftEnd, morningStart + 24 * 60, morningEnd + 24 * 60);

  const nightMinutes = overlap(shiftStart, shiftEnd, nightStart, nightEnd)
    + overlap(shiftStart, shiftEnd, nightStart + 24 * 60, nightEnd + 24 * 60);

  const totalWorkedMinutes = shiftEnd - shiftStart;
  let m = morningMinutes;
  let n = nightMinutes;

  // Allocate any remaining minutes to the dominant window (default to morning for daytime shifts)
  const accounted = m + n;
  if (accounted < totalWorkedMinutes) {
    const remainder = totalWorkedMinutes - accounted;
    if (m >= n) m += remainder; else n += remainder;
  }

  // Final sanity cap
  const cap = Math.max(1, totalWorkedMinutes);
  const total = m + n;
  if (total > cap) {
    const ratio = cap / total;
    m *= ratio; n *= ratio;
  }

    const result = {
      morningHours: Math.max(0, parseFloat((m / 60).toFixed(2))),
      nightHours: Math.max(0, parseFloat((n / 60).toFixed(2)))
    };

    console.log(`Calculation result for ${entry.clock_in_date}: Morning: ${result.morningHours}h, Night: ${result.nightHours}h`);
    return result;
  } catch (error) {
    console.error('Error in calculateMorningNightHours:', error);
    // Fallback to simple calculation without timezone conversion
    const clean = (t: string) => (t || '00:00:00').split('.')[0];
    const toMinutes = (t: string) => {
      const [h, m, s] = clean(t).split(':').map((v) => parseInt(v, 10) || 0);
      return (h % 24) * 60 + (m % 60) + Math.floor((s % 60) / 60);
    };
    
    let shiftStart = toMinutes(entry.clock_in_time);
    let shiftEnd = toMinutes(entry.clock_out_time);
    if (shiftEnd < shiftStart) shiftEnd += 24 * 60;
    
    const totalWorkedMinutes = shiftEnd - shiftStart;
    const morningStart = toMinutes(wageSettings.morning_start_time || '08:00:00');
    const morningEnd = toMinutes(wageSettings.morning_end_time || '17:00:00');
    
    // Simple fallback: if shift overlaps with morning hours, count as morning
    const morningHours = (shiftStart < morningEnd && shiftEnd > morningStart) ? 
      parseFloat((totalWorkedMinutes / 60).toFixed(2)) : 0;
    
    return { morningHours, nightHours: 0 };
  }
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
      const { morningHours, nightHours } = await calculateMorningNightHours(entry, wageSettings, organizationTimezone);
      
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
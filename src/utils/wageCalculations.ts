import { supabase } from '@/integrations/supabase/client';
import { getCompanyTimezone } from './timezoneUtils';


interface WageSettings {
  morning_start_time: string;
  morning_end_time: string;
  night_start_time: string;
  night_end_time: string;
  morning_wage_rate: number;
  night_wage_rate: number;
  working_hours_window_enabled: boolean;
  working_hours_start_time: string;
  working_hours_end_time: string;
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
    // Times in DB are stored as local time (without timezone info)
    // Parse them directly without treating as UTC
    const cleanTime = (t: string) => (t || '00:00:00').split('.')[0];
    
    // Parse date and time as local timezone values (not UTC)
    // Format: YYYY-MM-DD HH:MM:SS
    const clockInDateTime = `${entry.clock_in_date} ${cleanTime(entry.clock_in_time)}`;
    const clockOutDateTime = `${entry.clock_out_date} ${cleanTime(entry.clock_out_time)}`;
    
    console.log(`Processing timesheet: Clock In: ${clockInDateTime}, Clock Out: ${clockOutDateTime}`);
    console.log(`Using timezone: ${organizationTimezone}, Morning window: ${wageSettings.morning_start_time} - ${wageSettings.morning_end_time}`);

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

    // Use the times directly as they're already in local timezone
    let shiftStart = toMinutes(entry.clock_in_time);
    let shiftEnd = toMinutes(entry.clock_out_time);
    if (shiftEnd < shiftStart) shiftEnd += 24 * 60;

    // Apply working hours window filter if enabled
    let payableShiftStart = shiftStart;
    let payableShiftEnd = shiftEnd;
    
    if (wageSettings.working_hours_window_enabled) {
      const workingStart = toMinutes(wageSettings.working_hours_start_time || '08:00:00');
      let workingEnd = toMinutes(wageSettings.working_hours_end_time || '01:00:00');
      if (workingEnd <= workingStart) workingEnd += 24 * 60;
      
      // Clamp shift times to working hours window
      payableShiftStart = Math.max(shiftStart, workingStart);
      payableShiftEnd = Math.min(shiftEnd, workingEnd);
      
      // If no overlap with working hours window, return zero hours
      if (payableShiftStart >= payableShiftEnd) {
        console.log(`No overlap with working hours window (${wageSettings.working_hours_start_time} - ${wageSettings.working_hours_end_time})`);
        return { morningHours: 0, nightHours: 0 };
      }
      
      console.log(`Working hours window applied: ${wageSettings.working_hours_start_time} - ${wageSettings.working_hours_end_time}`);
      console.log(`Original shift: ${(shiftStart/60).toFixed(2)}h - ${(shiftEnd/60).toFixed(2)}h`);
      console.log(`Payable shift: ${(payableShiftStart/60).toFixed(2)}h - ${(payableShiftEnd/60).toFixed(2)}h`);
    }

  // Morning window
  const morningStart = toMinutes(wageSettings.morning_start_time || '08:00:00');
  const morningEnd = toMinutes(wageSettings.morning_end_time || '17:00:00');

  // Night window (may cross midnight)
  const nightStart = toMinutes(wageSettings.night_start_time || '17:00:00');
  let nightEnd = toMinutes(wageSettings.night_end_time || '01:00:00');
  if (nightEnd <= nightStart) nightEnd += 24 * 60;

  // Compute overlaps, accounting for windows repeating every 24h
  const morningMinutes = overlap(payableShiftStart, payableShiftEnd, morningStart, morningEnd)
    + overlap(payableShiftStart, payableShiftEnd, morningStart + 24 * 60, morningEnd + 24 * 60);

  const nightMinutes = overlap(payableShiftStart, payableShiftEnd, nightStart, nightEnd)
    + overlap(payableShiftStart, payableShiftEnd, nightStart + 24 * 60, nightEnd + 24 * 60);

  const totalWorkedMinutes = payableShiftEnd - payableShiftStart;
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

    console.log(`✓ Result for ${entry.clock_in_date} ${entry.clock_in_time}-${entry.clock_out_time}: Morning=${result.morningHours}h, Night=${result.nightHours}h (Total shift: ${((shiftEnd-shiftStart)/60).toFixed(2)}h, Payable: ${((payableShiftEnd-payableShiftStart)/60).toFixed(2)}h)`);
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
    
    // Apply working hours window filter if enabled (fallback version)
    let payableShiftStart = shiftStart;
    let payableShiftEnd = shiftEnd;
    
    if (wageSettings.working_hours_window_enabled) {
      const workingStart = toMinutes(wageSettings.working_hours_start_time || '08:00:00');
      let workingEnd = toMinutes(wageSettings.working_hours_end_time || '01:00:00');
      if (workingEnd <= workingStart) workingEnd += 24 * 60;
      
      payableShiftStart = Math.max(shiftStart, workingStart);
      payableShiftEnd = Math.min(shiftEnd, workingEnd);
      
      if (payableShiftStart >= payableShiftEnd) {
        return { morningHours: 0, nightHours: 0 };
      }
    }
    
    const totalWorkedMinutes = payableShiftEnd - payableShiftStart;
    const morningStart = toMinutes(wageSettings.morning_start_time || '08:00:00');
    const morningEnd = toMinutes(wageSettings.morning_end_time || '17:00:00');
    
    // Simple fallback: if shift overlaps with morning hours, count as morning
    const morningHours = (payableShiftStart < morningEnd && payableShiftEnd > morningStart) ? 
      parseFloat((totalWorkedMinutes / 60).toFixed(2)) : 0;
    
    return { morningHours, nightHours: 0 };
  }
};

export const calculateAllTimesheetHours = async (): Promise<void> => {
  try {
    console.log('🔄 Starting auto-calculate for all timesheets...');

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

    // Get working hours window settings from company_settings
    const { data: companySettings, error: companyError } = await supabase
      .from('company_settings')
      .select('working_hours_window_enabled, working_hours_start_time, working_hours_end_time')
      .maybeSingle();

    // Merge wage settings with working hours window settings
    const combinedSettings = {
      ...wageSettings,
      working_hours_window_enabled: companySettings?.working_hours_window_enabled ?? true,
      working_hours_start_time: companySettings?.working_hours_start_time ?? '08:00:00',
      working_hours_end_time: companySettings?.working_hours_end_time ?? '01:00:00'
    };

    // Get employees for wage rates (without INNER join to avoid RLS issues)
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, staff_id, full_name, morning_wage_rate, night_wage_rate');
    
    if (empError) {
      console.warn('Could not fetch employees:', empError);
    }

    // Create employee wage rate lookup
    const employeeRates = new Map();
    (employees || []).forEach(emp => {
      const rates = {
        morning: emp.morning_wage_rate || combinedSettings.morning_wage_rate,
        night: emp.night_wage_rate || combinedSettings.night_wage_rate
      };
      if (emp.id) employeeRates.set(emp.id, rates);
      if (emp.staff_id) employeeRates.set(emp.staff_id, rates);
      if (emp.full_name) employeeRates.set(emp.full_name, rates);
    });

    // Get all timesheet entries  
    const { data: entries, error: entriesError } = await supabase
      .from('timesheet_entries')
      .select('*')
      .not('clock_out_time', 'is', null)
      .gt('total_hours', 0);
    
    if (entriesError) {
      throw new Error('Failed to fetch timesheet entries: ' + entriesError.message);
    }

    if (!entries || entries.length === 0) {
      console.log('No entries found to calculate');
      return;
    }

    console.log(`📊 Processing ${entries.length} entries...`);

    // Helper: Parse time to minutes
    const parseTime = (timeStr: string) => {
      const [h, m] = (timeStr || '00:00:00').split(':').map(Number);
      return h * 60 + m;
    };

    // Process all entries
    const updates = entries.map((entry: any) => {
      // Simple local time calculation (no timezone conversion)
      const inMinutes = parseTime(entry.clock_in_time);
      const outMinutes = parseTime(entry.clock_out_time);
      
      // Morning window: 8 AM (480 min) - 5 PM (1020 min)
      const morningStart = parseTime(combinedSettings.morning_start_time || '08:00:00');
      const morningEnd = parseTime(combinedSettings.morning_end_time || '17:00:00');
      
      const shiftStart = inMinutes;
      const shiftEnd = outMinutes >= inMinutes ? outMinutes : outMinutes + 24 * 60;
      
      // Calculate morning overlap
      const morningOverlap = Math.max(0, Math.min(shiftEnd, morningEnd) - Math.max(shiftStart, morningStart));
      const morningHours = parseFloat((morningOverlap / 60).toFixed(2));
      const nightHours = parseFloat((entry.total_hours - morningHours).toFixed(2));

      // Get employee-specific rates
      const rates = employeeRates.get(entry.employee_id) || 
                   employeeRates.get(entry.employee_name) ||
                   { morning: combinedSettings.morning_wage_rate, night: combinedSettings.night_wage_rate };

      const splitAmount = (morningHours * rates.morning) + (nightHours * rates.night);

      return {
        id: entry.id,
        morning_hours: Math.max(0, morningHours),
        night_hours: Math.max(0, nightHours),
        total_card_amount_split: parseFloat(splitAmount.toFixed(2)),
        is_split_calculation: true
      };
    });

    // Batch update all entries
    console.log(`💾 Updating ${updates.length} entries...`);
    
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('timesheet_entries')
        .update(update)
        .eq('id', update.id);
      
      if (updateError) {
        console.error(`Failed to update entry ${update.id}:`, updateError);
      }
    }
    
    console.log(`✅ Successfully calculated ${updates.length} entries!`);
  } catch (error) {
    console.error('❌ Error calculating timesheet hours:', error);
    throw error;
  }
};
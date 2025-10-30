import { getCompanyTimezone } from './timezoneUtils';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

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
  employee_name: string;
  employee_id?: string;
  clock_in_date: string;
  clock_in_time: string;
  clock_out_date?: string | null;
  clock_out_time?: string | null;
  total_hours?: number;
  morning_hours?: number;
  night_hours?: number;
  is_split_calculation?: boolean;
  organization_id?: string;
}

interface VirtualTimesheetEntry extends TimesheetEntry {
  virtual_clock_out_time: string;
  virtual_clock_out_date: string;
  virtual_total_hours: number;
  virtual_morning_hours: number;
  virtual_night_hours: number;
  is_virtual_calculation: boolean;
}

/**
 * Calculate virtual hours for an active employee as if they clocked out now
 */
export const calculateVirtualHours = async (
  entry: TimesheetEntry,
  wageSettings: WageSettings,
  organizationTimezone: string = 'Africa/Cairo'
): Promise<VirtualTimesheetEntry> => {
  // If employee is already clocked out, return original entry
  if (entry.clock_out_time && entry.clock_out_time !== '00:00:00') {
    return {
      ...entry,
      virtual_clock_out_time: entry.clock_out_time,
      virtual_clock_out_date: entry.clock_out_date || entry.clock_in_date,
      virtual_total_hours: entry.total_hours || 0,
      virtual_morning_hours: entry.morning_hours || 0,
      virtual_night_hours: entry.night_hours || 0,
      is_virtual_calculation: false
    };
  }

  try {
    // Get current time in company timezone
    const now = new Date();
    const currentTimeInTimezone = formatInTimeZone(now, organizationTimezone, 'HH:mm:ss');
    const currentDateInTimezone = formatInTimeZone(now, organizationTimezone, 'yyyy-MM-dd');

    // Helper functions for minute-based calculation
    const cleanTime = (t: string) => (t || '00:00:00').split('.')[0];
    const toMinutes = (t: string) => {
      const [h, m, s] = cleanTime(t).split(':').map((v) => parseInt(v, 10) || 0);
      return (h % 24) * 60 + (m % 60) + Math.floor((s % 60) / 60);
    };
    const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
      const start = Math.max(aStart, bStart);
      const end = Math.min(aEnd, bEnd);
      return Math.max(0, end - start);
    };

    // Calculate shift duration using virtual clock-out time
    let shiftStart = toMinutes(entry.clock_in_time);
    let shiftEnd = toMinutes(currentTimeInTimezone);
    
    // Handle overnight shifts
    if (shiftEnd < shiftStart) {
      shiftEnd += 24 * 60;
    }

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
        return {
          ...entry,
          virtual_clock_out_time: currentTimeInTimezone,
          virtual_clock_out_date: currentDateInTimezone,
          virtual_total_hours: 0,
          virtual_morning_hours: 0,
          virtual_night_hours: 0,
          is_virtual_calculation: true
        };
      }
    }

    // Morning window
    const morningStart = toMinutes(wageSettings.morning_start_time || '06:00:00');
    const morningEnd = toMinutes(wageSettings.morning_end_time || '17:00:00');

    // Night window (may cross midnight)
    const nightStart = toMinutes(wageSettings.night_start_time || '17:00:00');
    let nightEnd = toMinutes(wageSettings.night_end_time || '06:00:00');
    if (nightEnd <= nightStart) nightEnd += 24 * 60;

    // Calculate overlaps
    const morningMinutes = overlap(payableShiftStart, payableShiftEnd, morningStart, morningEnd);
    const nightMinutes = overlap(payableShiftStart, payableShiftEnd, nightStart, nightEnd);

    // Convert to hours
    const morningHours = morningMinutes / 60;
    const nightHours = nightMinutes / 60;
    const totalHours = (payableShiftEnd - payableShiftStart) / 60;

    return {
      ...entry,
      virtual_clock_out_time: currentTimeInTimezone,
      virtual_clock_out_date: currentDateInTimezone,
      virtual_total_hours: Math.max(0, totalHours),
      virtual_morning_hours: Math.max(0, morningHours),
      virtual_night_hours: Math.max(0, nightHours),
      is_virtual_calculation: true
    };

  } catch (error) {
    console.error('Error calculating virtual hours:', error);
    return {
      ...entry,
      virtual_clock_out_time: '00:00:00',
      virtual_clock_out_date: entry.clock_in_date,
      virtual_total_hours: 0,
      virtual_morning_hours: 0,
      virtual_night_hours: 0,
      is_virtual_calculation: true
    };
  }
};

/**
 * Process an array of timesheet entries and calculate virtual hours for active employees
 */
export const processTimesheetsWithVirtualHours = async (
  timesheets: TimesheetEntry[],
  wageSettings: WageSettings,
  organizationTimezone: string = 'Africa/Cairo'
): Promise<VirtualTimesheetEntry[]> => {
  const processedEntries: VirtualTimesheetEntry[] = [];

  for (const entry of timesheets) {
    const virtualEntry = await calculateVirtualHours(entry, wageSettings, organizationTimezone);
    processedEntries.push(virtualEntry);
  }

  return processedEntries;
};

/**
 * Check if a timesheet entry represents an active employee (not clocked out)
 */
export const isActiveEmployee = (entry: TimesheetEntry): boolean => {
  return !entry.clock_out_time || entry.clock_out_time === '00:00:00' || entry.clock_out_time === null;
};
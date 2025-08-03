import { supabase } from '@/integrations/supabase/client';

// Cache for company timezone to avoid repeated database calls
let cachedTimezone: string | null = null;
let timezoneLastFetched = 0;
const TIMEZONE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get the company's configured timezone
 */
export async function getCompanyTimezone(): Promise<string> {
  const now = Date.now();
  
  // Return cached timezone if still valid
  if (cachedTimezone && (now - timezoneLastFetched) < TIMEZONE_CACHE_DURATION) {
    return cachedTimezone;
  }

  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('timezone')
      .eq('id', 1)
      .single();

    if (error || !data?.timezone) {
      console.warn('Could not fetch company timezone, using default:', error);
      cachedTimezone = 'Africa/Cairo';
    } else {
      cachedTimezone = data.timezone;
    }
    
    timezoneLastFetched = now;
    return cachedTimezone;
  } catch (error) {
    console.error('Error fetching company timezone:', error);
    return 'Africa/Cairo'; // Default to Egypt timezone
  }
}

/**
 * Convert a UTC date to the company's local timezone
 */
export async function convertUTCToCompanyTime(utcDate: Date): Promise<Date> {
  const timezone = await getCompanyTimezone();
  
  try {
    // Use Intl.DateTimeFormat to handle timezone conversion properly
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(utcDate);
    const partsObj = parts.reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {} as Record<string, string>);

    return new Date(
      `${partsObj.year}-${partsObj.month}-${partsObj.day}T${partsObj.hour}:${partsObj.minute}:${partsObj.second}`
    );
  } catch (error) {
    console.error('Error converting UTC to company time:', error);
    return utcDate; // Fallback to original date
  }
}

/**
 * Convert a local company time to UTC
 */
export async function convertCompanyTimeToUTC(localDate: Date): Promise<Date> {
  const timezone = await getCompanyTimezone();
  
  try {
    // Create a date string in the company timezone
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const seconds = String(localDate.getSeconds()).padStart(2, '0');
    
    const localDateString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    
    // Create a temporary date in UTC and adjust for timezone offset
    const tempDate = new Date(localDateString);
    const utcDate = new Date(tempDate.toLocaleString('en-US', { timeZone: 'UTC' }));
    const companyDate = new Date(tempDate.toLocaleString('en-US', { timeZone: timezone }));
    
    // Calculate the offset and adjust
    const offset = utcDate.getTime() - companyDate.getTime();
    return new Date(tempDate.getTime() + offset);
  } catch (error) {
    console.error('Error converting company time to UTC:', error);
    return localDate; // Fallback to original date
  }
}

/**
 * Get current time in company timezone
 */
export async function getCurrentCompanyTime(): Promise<Date> {
  const utcNow = new Date();
  return await convertUTCToCompanyTime(utcNow);
}

/**
 * Format date/time in company timezone
 */
export async function formatInCompanyTimezone(
  date: Date, 
  options: Intl.DateTimeFormatOptions = {}
): Promise<string> {
  const timezone = await getCompanyTimezone();
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options
  };

  return new Intl.DateTimeFormat('en-GB', defaultOptions).format(date);
}

/**
 * Get today's date string in company timezone (YYYY-MM-DD format)
 */
export async function getTodayInCompanyTimezone(): Promise<string> {
  const companyTime = await getCurrentCompanyTime();
  const year = companyTime.getFullYear();
  const month = String(companyTime.getMonth() + 1).padStart(2, '0');
  const day = String(companyTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a date/time string assuming it's in company timezone
 */
export async function parseCompanyDateTime(dateStr: string, timeStr?: string): Promise<Date> {
  const timezone = await getCompanyTimezone();
  
  try {
    let fullDateTimeStr = dateStr;
    if (timeStr) {
      fullDateTimeStr = `${dateStr}T${timeStr}`;
    }
    
    // If no time specified, assume start of day
    if (!timeStr && !dateStr.includes('T')) {
      fullDateTimeStr = `${dateStr}T00:00:00`;
    }
    
    // Parse as if it's in the company timezone
    const tempDate = new Date(fullDateTimeStr);
    return await convertCompanyTimeToUTC(tempDate);
  } catch (error) {
    console.error('Error parsing company date/time:', error);
    return new Date(dateStr); // Fallback
  }
}

/**
 * Clear timezone cache (useful for testing or when timezone changes)
 */
export function clearTimezoneCache(): void {
  cachedTimezone = null;
  timezoneLastFetched = 0;
}

/**
 * List of common timezones for Egypt and nearby regions
 */
export const COMMON_TIMEZONES = [
  { value: 'Africa/Cairo', label: 'Egypt (Cairo) - UTC+2/+3' },
  { value: 'Europe/Athens', label: 'Greece (Athens) - UTC+2/+3' },
  { value: 'Europe/Istanbul', label: 'Turkey (Istanbul) - UTC+3' },
  { value: 'Asia/Dubai', label: 'UAE (Dubai) - UTC+4' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia (Riyadh) - UTC+3' },
  { value: 'UTC', label: 'UTC (Universal Time)' },
  { value: 'Europe/London', label: 'UK (London) - UTC+0/+1' },
  { value: 'America/New_York', label: 'US East Coast - UTC-5/-4' },
  { value: 'America/Los_Angeles', label: 'US West Coast - UTC-8/-7' },
];
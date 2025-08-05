import { supabase } from '@/integrations/supabase/client';

// Cache for company timezone to avoid repeated database calls
// Use a more robust caching mechanism
let cachedTimezone: string | null = null;
let timezoneLastFetched = 0;
let fetchPromise: Promise<string> | null = null;
const TIMEZONE_CACHE_DURATION = 10 * 60 * 1000; // Increased to 10 minutes for better stability

/**
 * Get the company's configured timezone with improved caching and error handling
 */
export async function getCompanyTimezone(): Promise<string> {
  const now = Date.now();
  
  // Return cached timezone if still valid
  if (cachedTimezone && (now - timezoneLastFetched) < TIMEZONE_CACHE_DURATION) {
    console.log('Using cached timezone:', cachedTimezone);
    return cachedTimezone;
  }

  // If there's already a fetch in progress, wait for it
  if (fetchPromise) {
    console.log('Waiting for existing timezone fetch...');
    return fetchPromise;
  }

  // Create a new fetch promise
  fetchPromise = (async () => {
    try {
      console.log('Fetching company timezone from database...');
      const { data, error } = await supabase
        .from('company_settings')
        .select('timezone')
        .eq('id', 1)
        .single();

      if (error) {
        console.warn('Error fetching company timezone:', error);
        // Try to get the first available record if single fails
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('company_settings')
          .select('timezone')
          .limit(1);
        
        if (fallbackError || !fallbackData || fallbackData.length === 0) {
          console.warn('No company timezone found, using default Africa/Cairo');
          console.warn('ADMIN ACTION REQUIRED: Please insert company settings into the database');
          
          // Try to auto-fix by inserting default settings
          try {
            const { error: insertError } = await supabase
              .from('company_settings')
              .insert({
                id: 1,
                timezone: 'Africa/Cairo',
                motivational_message: 'Keep up the great work! Your dedication makes a difference.',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            
            if (!insertError) {
              console.log('✅ Auto-fixed: Default company settings inserted');
              cachedTimezone = 'Africa/Cairo';
            } else {
              console.warn('Could not auto-fix company settings:', insertError.message);
              cachedTimezone = 'Africa/Cairo';
            }
          } catch (autoFixError) {
            console.warn('Auto-fix failed, using fallback timezone');
            cachedTimezone = 'Africa/Cairo';
          }
        } else {
          cachedTimezone = fallbackData[0].timezone || 'Africa/Cairo';
          console.log('Using fallback timezone:', cachedTimezone);
        }
      } else {
        cachedTimezone = data?.timezone || 'Africa/Cairo';
        console.log('Successfully fetched timezone:', cachedTimezone);
      }
      
      timezoneLastFetched = now;
      fetchPromise = null; // Clear the promise
      return cachedTimezone;
    } catch (error) {
      console.error('Error in getCompanyTimezone:', error);
      fetchPromise = null; // Clear the promise even on error
      cachedTimezone = 'Africa/Cairo'; // Default fallback
      timezoneLastFetched = now;
      return cachedTimezone;
    }
  })();

  return fetchPromise;
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
    // Create a date string in ISO format
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const seconds = String(localDate.getSeconds()).padStart(2, '0');
    
    // The key insight: we need to find what UTC time would produce this local time in the company timezone
    // We'll use a more direct approach with Intl.DateTimeFormat
    
    // Create a reference date to calculate the timezone offset
    const referenceDate = new Date();
    
    // Get the offset in minutes for the company timezone
    const utcDate = new Date(referenceDate.toLocaleString('en-US', { timeZone: 'UTC' }));
    const companyDate = new Date(referenceDate.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMinutes = (utcDate.getTime() - companyDate.getTime()) / (1000 * 60);
    
    // Apply this offset to our local date
    const localDateTime = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
    return new Date(localDateTime.getTime() + (offsetMinutes * 60 * 1000));
    
  } catch (error) {
    console.error('Error converting company time to UTC:', error);
    
    // Fallback: assume Egypt timezone offset (UTC+2)
    const offsetHours = 2;
    const localDateTime = new Date(localDate);
    return new Date(localDateTime.getTime() - (offsetHours * 60 * 60 * 1000));
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
      fullDateTimeStr = `${dateStr} ${timeStr}`;
    }
    
    // If no time specified, assume start of day
    if (!timeStr && !dateStr.includes('T') && !dateStr.includes(' ')) {
      fullDateTimeStr = `${dateStr} 00:00:00`;
    }
    
    // Parse the date/time string and treat it as if it's in the company timezone
    // Use a more reliable approach that handles timezone conversion properly
    
    // First, parse the date components
    const dateTimeMatch = fullDateTimeStr.match(/(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})/);
    if (!dateTimeMatch) {
      throw new Error('Invalid date/time format');
    }
    
    const [, year, month, day, hours, minutes, seconds] = dateTimeMatch;
    
    // Create a date object in the local timezone first
    const localDate = new Date(
      parseInt(year),
      parseInt(month) - 1, // months are 0-indexed
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds)
    );
    
    // Now convert this local date to UTC, treating it as if it was in the company timezone
    return await convertCompanyTimeToUTC(localDate);
  } catch (error) {
    console.error('Error parsing company date/time:', error);
    // Fallback: try to parse as-is and hope for the best
    return new Date(fullDateTimeStr);
  }
}

/**
 * Clear timezone cache (useful for testing or when timezone changes)
 */
export function clearTimezoneCache(): void {
  cachedTimezone = null;
  timezoneLastFetched = 0;
  fetchPromise = null;
  console.log('Timezone cache cleared');
}

/**
 * Validate and ensure timezone consistency across the application
 */
export async function validateTimezone(): Promise<{ isValid: boolean; timezone: string; message: string }> {
  try {
    const timezone = await getCompanyTimezone();
    
    // Test if the timezone is valid by trying to use it
    const testDate = new Date();
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(testDate);
    
    console.log(`Timezone validation: ${timezone} -> ${formatted}`);
    
    return {
      isValid: true,
      timezone,
      message: `Timezone ${timezone} is valid and working correctly`
    };
  } catch (error) {
    console.error('Timezone validation failed:', error);
    return {
      isValid: false,
      timezone: 'Africa/Cairo',
      message: `Timezone validation failed: ${error}. Using fallback.`
    };
  }
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
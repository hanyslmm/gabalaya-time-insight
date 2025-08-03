// Utility functions for time formatting
import { getCompanyTimezone } from './timezoneUtils';

export const formatTimeToAMPM = (time24: string): string => {
  if (!time24) return '';
  
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const minute = parseInt(minutes, 10);
  
  if (hour === 0) {
    return `12:${minutes.padStart(2, '0')} AM`;
  } else if (hour < 12) {
    return `${hour}:${minutes.padStart(2, '0')} AM`;
  } else if (hour === 12) {
    return `12:${minutes.padStart(2, '0')} PM`;
  } else {
    return `${hour - 12}:${minutes.padStart(2, '0')} PM`;
  }
};

export const formatTime24ToAMPM = (time24: string): string => {
  return formatTimeToAMPM(time24);
};

export const formatAMPMTo24 = (timeAMPM: string): string => {
  if (!timeAMPM) return '';
  
  const timeParts = timeAMPM.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!timeParts) return timeAMPM; // Return original if format doesn't match
  
  let hour = parseInt(timeParts[1], 10);
  const minute = timeParts[2];
  const period = timeParts[3].toUpperCase();
  
  if (period === 'AM' && hour === 12) {
    hour = 0;
  } else if (period === 'PM' && hour !== 12) {
    hour += 12;
  }
  
  return `${hour.toString().padStart(2, '0')}:${minute}:00`;
};

/**
 * Format time with timezone information when needed
 */
export const formatTimeWithTimezone = async (time24: string, showTimezone = false): Promise<string> => {
  if (!time24) return '';
  
  const formattedTime = formatTimeToAMPM(time24);
  
  if (showTimezone) {
    try {
      const timezone = await getCompanyTimezone();
      const shortTimezone = timezone.split('/').pop() || timezone;
      return `${formattedTime} (${shortTimezone})`;
    } catch (error) {
      console.warn('Could not get timezone for time formatting:', error);
      return formattedTime;
    }
  }
  
  return formattedTime;
};

/**
 * Get timezone abbreviation for display
 */
export const getTimezoneAbbreviation = async (): Promise<string> => {
  try {
    const timezone = await getCompanyTimezone();
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(now);
    const timezonePart = parts.find(part => part.type === 'timeZoneName');
    return timezonePart?.value || timezone.split('/').pop() || 'Local';
  } catch (error) {
    console.warn('Could not get timezone abbreviation:', error);
    return 'Local';
  }
};
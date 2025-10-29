import { useEffect, useState, useCallback } from 'react';
import { getCompanyTimezone } from '@/utils/timezoneUtils';

export function useCompanyTimezone() {
  const [timezone, setTimezone] = useState<string>('Africa/Cairo');

  useEffect(() => {
    let mounted = true;
    
    const fetchTimezone = async () => {
      try {
        const override = typeof window !== 'undefined' ? localStorage.getItem('companyTimezoneOverride') : null;
        if (override) {
          if (mounted) setTimezone(override);
          return;
        }
        const tz = await getCompanyTimezone();
        if (mounted && tz) {
          setTimezone(tz);
        }
      } catch (error) {
        console.warn('Failed to fetch company timezone:', error);
      }
    };
    
    fetchTimezone();
    return () => {
      mounted = false;
    };
  }, []);

  const formatDate = useCallback(
    (dateStr: string) => {
      try {
        const date = new Date(`${dateStr}T00:00:00Z`);
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(date);
      } catch {
        return dateStr;
      }
    },
    [timezone]
  );

  const formatTimeAMPM = useCallback(
    (dateStr?: string, timeStr?: string | null) => {
      if (!dateStr || !timeStr) return '—';
      const timeClean = (timeStr || '').split('.')[0] || '00:00:00';

      // IMPORTANT: DB stores local company time (no timezone). Do NOT add 'Z' or
      // convert as UTC. Just render the string in 12-hour format.
      try {
        const [hh, mm] = timeClean.split(':').map((v) => parseInt(v, 10) || 0);
        const h12 = ((hh % 12) || 12);
        const period = hh < 12 ? 'AM' : 'PM';
        const mmStr = String(mm).padStart(2, '0');
        return `${h12}:${mmStr} ${period}`;
      } catch {
        return timeClean;
      }
    },
    [timezone]
  );

  const formatDateTime = useCallback(
    (dateStr?: string, timeStr?: string | null) => {
      if (!dateStr) return '';
      const timeClean = (timeStr || '00:00:00').split('.')[0];
      
      try {
        // Add 'Z' to treat DB time as UTC, then format in company timezone
        const utcDate = new Date(`${dateStr}T${timeClean}Z`);
        
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(utcDate);
      } catch {
        return `${dateStr} ${timeStr || ''}`;
      }
    },
    [timezone]
  );

  return { timezone, formatDate, formatTimeAMPM, formatDateTime };
}

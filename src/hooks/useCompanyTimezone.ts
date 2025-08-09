import { useEffect, useState, useCallback } from 'react';
import { getCompanyTimezone } from '@/utils/timezoneUtils';

export function useCompanyTimezone() {
  const [timezone, setTimezone] = useState<string>('Africa/Cairo');

  useEffect(() => {
    let mounted = true;
    getCompanyTimezone()
      .then((tz) => {
        if (mounted && tz) setTimezone(tz);
      })
      .catch(() => {});
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
      const dt = new Date(`${dateStr}T${timeClean}Z`);
      try {
        return new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(dt);
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
      const dt = new Date(`${dateStr}T${timeClean}Z`);
      try {
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(dt);
      } catch {
        return `${dateStr} ${timeStr || ''}`;
      }
    },
    [timezone]
  );

  return { timezone, formatDate, formatTimeAMPM, formatDateTime };
}


export const formatDate = (dateValue: any): string | null => {
  if (!dateValue) return null;
  
  try {
    let date: Date;
    
    if (typeof dateValue === 'number') {
      // Excel date serial number
      date = new Date((dateValue - 25569) * 86400 * 1000);
    } else if (typeof dateValue === 'string') {
      // Try to parse string date
      date = new Date(dateValue);
    } else {
      return null;
    }
    
    if (isNaN(date.getTime())) return null;
    
    // Format as YYYY-MM-DD
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
};

export const formatTime = (timeValue: any): string | null => {
  if (!timeValue) return null;
  
  try {
    if (typeof timeValue === 'number') {
      // Excel time serial number (fraction of a day)
      const totalMinutes = Math.round(timeValue * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    } else if (typeof timeValue === 'string') {
      // Try to parse string time
      const timeMatch = timeValue.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
        const ampm = timeMatch[4];
        
        if (ampm) {
          if (ampm.toLowerCase() === 'pm' && hours !== 12) {
            hours += 12;
          } else if (ampm.toLowerCase() === 'am' && hours === 12) {
            hours = 0;
          }
        }
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error formatting time:', error);
    return null;
  }
};

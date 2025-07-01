
import { formatDate, formatTime } from './dateTimeFormatters';

export const processTimesheetData = (rawData: any[]): any[] => {
  console.log('Raw data received:', rawData);
  
  return rawData
    .filter(row => row && (row['Name'] || row['Employee Name'] || row['name']))
    .map((row: any) => {
      console.log('Processing row:', row);
      
      const employeeName = row['Name'] || row['Employee Name'] || row['name'] || 'Unknown';
      const clockInDate = formatDate(row['Clock in date'] || row['clock_in_date']);
      const clockInTime = formatTime(row['Clock in time'] || row['clock_in_time']);
      const clockOutDate = formatDate(row['Clock out date'] || row['clock_out_date']);
      const clockOutTime = formatTime(row['Clock out time'] || row['clock_out_time']);
      
      // Calculate total hours
      let totalHours = 0;
      if (clockInDate && clockInTime && clockOutDate && clockOutTime) {
        const clockInDateTime = new Date(`${clockInDate} ${clockInTime}`);
        const clockOutDateTime = new Date(`${clockOutDate} ${clockOutTime}`);
        
        // Handle next day scenario
        if (clockOutDateTime < clockInDateTime) {
          clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
        }
        
        totalHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);
      }
      
      // Use actual hours if provided, otherwise use calculated
      const actualHours = parseFloat(row['Actual hours'] || row['actual_hours']) || totalHours;
      
      const processedRow = {
        employee_name: employeeName,
        clock_in_date: clockInDate,
        clock_in_time: clockInTime,
        clock_out_date: clockOutDate,
        clock_out_time: clockOutTime,
        total_hours: Math.max(0, actualHours),
        total_card_amount_flat: Math.max(0, actualHours) * 20, // Default 20 LE/hr
        break_start: formatTime(row['Break start'] || row['break_start']) || null,
        break_end: formatTime(row['Break end'] || row['break_end']) || null,
        break_length: parseFloat(row['Break length'] || row['break_length']) || null,
        break_type: row['Break type'] || row['break_type'] || null,
        payroll_id: row['Payroll ID'] || row['payroll_id'] || null,
        actual_hours: actualHours || null,
        no_show_reason: row['No show reason'] || row['no_show_reason'] || null,
        employee_note: row['Employee note'] || row['employee_note'] || null,
        manager_note: row['Manager note'] || row['manager_note'] || null,
        is_split_calculation: false
      };
      
      console.log('Processed row:', processedRow);
      return processedRow;
    })
    .filter(row => row.clock_in_date && row.clock_in_time && row.clock_out_date && row.clock_out_time);
};

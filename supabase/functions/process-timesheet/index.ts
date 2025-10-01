import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'
import { corsHeaders } from '../_shared/cors.ts'

interface TimesheetData {
  employee_name: string;
  clock_in_date: string;
  clock_in_time: string;
  clock_out_date: string;
  clock_out_time: string;
  total_hours?: number;
  actual_hours?: number;
  break_start?: string;
  break_end?: string;
  break_length?: number;
  break_type?: string;
  payroll_id?: string;
  no_show_reason?: string;
  employee_note?: string;
  manager_note?: string;
}

interface ProcessTimesheetRequest {
  data: TimesheetData[];
  validateOnly?: boolean;
  overwriteExisting?: boolean;
  deleteExistingData?: boolean;
}

// Enhanced date/time formatting functions
function formatDate(dateInput: any): string | null {
  if (!dateInput) return null;
  
  try {
    // Handle various date formats
    let date: Date;
    
    if (typeof dateInput === 'number') {
      // Excel date serial number
      date = new Date((dateInput - 25569) * 86400 * 1000);
    } else if (typeof dateInput === 'string') {
      // Try parsing as various formats
      const patterns = [
        /^\d{4}-\d{2}-\d{2}$/,
        /^\d{2}\/\d{2}\/\d{4}$/,
        /^\d{2}-\d{2}-\d{4}$/
      ];
      
      if (patterns[0].test(dateInput)) {
        date = new Date(dateInput);
      } else if (patterns[1].test(dateInput)) {
        const [month, day, year] = dateInput.split('/');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else if (patterns[2].test(dateInput)) {
        const [day, month, year] = dateInput.split('-');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        date = new Date(dateInput);
      }
    } else {
      date = new Date(dateInput);
    }
    
    if (isNaN(date.getTime())) return null;
    
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Date formatting error:', error);
    return null;
  }
}

function formatTime(timeInput: any): string | null {
  if (!timeInput) return null;
  
  try {
    if (typeof timeInput === 'number') {
      // Excel time serial number (fraction of a day)
      const totalMinutes = timeInput * 24 * 60;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.floor(totalMinutes % 60);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    } else if (typeof timeInput === 'string') {
      // Parse various time formats
      const timeRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i;
      const match = timeInput.trim().match(timeRegex);
      
      if (match) {
        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const seconds = match[3] ? parseInt(match[3]) : 0;
        const period = match[4];
        
        if (period) {
          if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
          if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
        }
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Time formatting error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { data: rawData, validateOnly = false, overwriteExisting = false, deleteExistingData = false }: ProcessTimesheetRequest = body

    console.log(`Processing ${rawData.length} timesheet entries (validate only: ${validateOnly})`);

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )


    // Fetch all employees for name mapping
    const { data: employees, error: employeesError } = await supabaseAdmin
      .from('employees')
      .select('staff_id, full_name');

    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch employee data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Create employee mapping
    const employeeMap = new Map();
    employees?.forEach(emp => {
      employeeMap.set(emp.staff_id, emp.full_name);
    });

    // Get default wage rate
    const { data: wageSettings } = await supabaseAdmin
      .from('wage_settings')
      .select('default_flat_wage_rate, morning_wage_rate, night_wage_rate, morning_start_time, morning_end_time, night_start_time, night_end_time')
      .single();

    const defaultWageRate = wageSettings?.default_flat_wage_rate || 20;

    // Process and validate data
    const processedData = [];
    const errors = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      
      try {
        // Skip header rows, empty rows, and summary rows
        if (!row || typeof row !== 'object') continue;
        
        // Get the first column value to check row type
        const firstCol = row['El Gabalaya'] || row['Name'] || row[Object.keys(row)[0]];
        
        // Skip if it's a header row, empty row, or summary row
        if (!firstCol || 
            firstCol === 'Payroll Period' || 
            firstCol === 'Name' || 
            firstCol === '' || 
            firstCol === '-' ||
            firstCol.toString().toLowerCase().includes('total') ||
            typeof firstCol !== 'string') {
          continue;
        }
        
        // Map the Excel columns to our expected format
        const employeeName = firstCol; // First column is employee name
        const clockInDate = row[''] || row[Object.keys(row)[1]]; // Second column
        const clockInTime = row['_1'] || row[Object.keys(row)[2]]; // Third column  
        const clockOutDate = row['_2'] || row[Object.keys(row)[3]]; // Fourth column
        const clockOutTime = row['_3'] || row[Object.keys(row)[4]]; // Fifth column
        const actualHours = row['_9'] || row[Object.keys(row)[10]]; // Actual hours column
        
        // Skip if essential data is missing
        if (!employeeName || !clockInDate || !clockInTime || !clockOutDate || !clockOutTime) {
          continue;
        }
        
        // Extract employee identifier
        const employeeIdentifier = employeeName;
        const employeeNameForDB = employeeMap.get(employeeIdentifier) || employeeIdentifier;
        
        // Format dates and times
        const clockInDateFormatted = formatDate(clockInDate);
        const clockInTimeFormatted = formatTime(clockInTime);
        const clockOutDateFormatted = formatDate(clockOutDate);
        const clockOutTimeFormatted = formatTime(clockOutTime);

        // Validate required fields
        if (!clockInDateFormatted || !clockInTimeFormatted || !clockOutDateFormatted || !clockOutTimeFormatted) {
          errors.push(`Row ${i + 1}: Missing required date/time fields for ${employeeIdentifier}`);
          continue;
        }

        // Calculate total hours
        let totalHours = 0;
        const clockInDateTime = new Date(`${clockInDateFormatted}T${clockInTimeFormatted}`);
        const clockOutDateTime = new Date(`${clockOutDateFormatted}T${clockOutTimeFormatted}`);
        
        // Handle next day scenario
        if (clockOutDateTime < clockInDateTime) {
          clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
        }
        
        totalHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);

        // Use actual hours if provided, otherwise use calculated
        const finalHours = actualHours ? parseFloat(actualHours.toString()) : totalHours;
        
        // Calculate morning and night hours using wage settings
        let morningHours = 0;
        let nightHours = 0;
        
        if (wageSettings && finalHours > 0) {
          const morningStart = wageSettings.morning_start_time || '08:00:00';
          const morningEnd = wageSettings.morning_end_time || '17:00:00';
          const nightStart = wageSettings.night_start_time || '17:00:00';
          const nightEnd = wageSettings.night_end_time || '01:00:00';
          
          // Apply working hours window filter if enabled
          let payableClockInTime = clockInTimeFormatted;
          let payableClockOutTime = clockOutTimeFormatted;
          
          if (wageSettings.working_hours_window_enabled) {
            const workingStart = wageSettings.working_hours_start_time || '08:00:00';
            const workingEnd = wageSettings.working_hours_end_time || '01:00:00';
            
            // Convert to minutes for comparison
            const clockInMinutes = timeToMinutes(clockInTimeFormatted);
            const clockOutMinutes = timeToMinutes(clockOutTimeFormatted);
            const workingStartMinutes = timeToMinutes(workingStart);
            let workingEndMinutes = timeToMinutes(workingEnd);
            
            // Handle working hours window crossing midnight
            if (workingEndMinutes < workingStartMinutes) {
              workingEndMinutes += 24 * 60;
            }
            
            // Handle shift crossing midnight
            let actualClockOutMinutes = clockOutMinutes;
            if (clockOutMinutes < clockInMinutes) {
              actualClockOutMinutes = clockOutMinutes + 24 * 60;
            }
            
            // Clamp to working hours window
            const payableStartMinutes = Math.max(clockInMinutes, workingStartMinutes);
            const payableEndMinutes = Math.min(actualClockOutMinutes, workingEndMinutes);
            
            // If no overlap with working hours window, skip this entry
            if (payableStartMinutes >= payableEndMinutes) {
              console.log(`No overlap with working hours window (${workingStart} - ${workingEnd})`);
              morningHours = 0;
              nightHours = 0;
            } else {
              // Convert back to time format
              payableClockInTime = `${Math.floor(payableStartMinutes / 60).toString().padStart(2, '0')}:${(payableStartMinutes % 60).toString().padStart(2, '0')}`;
              const payableEndMinutesNormalized = payableEndMinutes > 24 * 60 ? payableEndMinutes - 24 * 60 : payableEndMinutes;
              payableClockOutTime = `${Math.floor(payableEndMinutesNormalized / 60).toString().padStart(2, '0')}:${(payableEndMinutesNormalized % 60).toString().padStart(2, '0')}`;
              
              console.log(`Working hours window applied: ${workingStart} - ${workingEnd}`);
              console.log(`Original: ${clockInTimeFormatted} - ${clockOutTimeFormatted}`);
              console.log(`Payable: ${payableClockInTime} - ${payableClockOutTime}`);
            }
          }
          
          console.log(`Calculating hours for shift ${clockInTimeFormatted} to ${clockOutTimeFormatted}`);
          console.log(`Morning period: ${morningStart} to ${morningEnd}`);
          console.log(`Night period: ${nightStart} to ${nightEnd}`);
          
          // Helper function to convert time string to minutes from midnight
          const timeToMinutes = (timeStr: string): number => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
          };
          
          // Convert shift times to minutes from midnight (use payable times if working hours window is applied)
          const shiftStartMinutes = timeToMinutes(payableClockInTime);
          const shiftEndMinutes = timeToMinutes(payableClockOutTime);
          
          // Convert period times to minutes
          const morningStartMinutes = timeToMinutes(morningStart);
          const morningEndMinutes = timeToMinutes(morningEnd);
          const nightStartMinutes = timeToMinutes(nightStart);
          let nightEndMinutes = timeToMinutes(nightEnd);
          
          // Handle overnight shifts and night periods that cross midnight
          let actualShiftEndMinutes = shiftEndMinutes;
          if (shiftEndMinutes < shiftStartMinutes) {
            actualShiftEndMinutes = shiftEndMinutes + (24 * 60); // Add 24 hours
          }
          
          // If night period crosses midnight (e.g., 17:00 to 01:00)
          if (nightEndMinutes < nightStartMinutes) {
            nightEndMinutes = nightEndMinutes + (24 * 60); // Add 24 hours
          }
          
          // Calculate morning hours overlap
          const morningOverlapStart = Math.max(shiftStartMinutes, morningStartMinutes);
          const morningOverlapEnd = Math.min(actualShiftEndMinutes, morningEndMinutes);
          if (morningOverlapStart < morningOverlapEnd) {
            morningHours = (morningOverlapEnd - morningOverlapStart) / 60;
          }
          
          // Calculate night hours overlap (handling overnight periods)
          const nightOverlapStart = Math.max(shiftStartMinutes, nightStartMinutes);
          const nightOverlapEnd = Math.min(actualShiftEndMinutes, nightEndMinutes);
          
          // Handle the case where shift spans midnight and night period also spans midnight
          if (nightEndMinutes > (24 * 60)) {
            // Night period crosses midnight
            if (actualShiftEndMinutes > (24 * 60)) {
              // Shift also crosses midnight - calculate overlap
              if (nightOverlapStart < nightOverlapEnd) {
                nightHours = (nightOverlapEnd - nightOverlapStart) / 60;
              }
            } else {
              // Shift doesn't cross midnight but night period does
              // Check overlap before midnight
              const beforeMidnightEnd = Math.min(actualShiftEndMinutes, 24 * 60);
              if (nightOverlapStart < beforeMidnightEnd) {
                nightHours += (beforeMidnightEnd - nightOverlapStart) / 60;
              }
              // Check overlap after midnight (if shift extends past midnight)
              if (actualShiftEndMinutes > (24 * 60)) {
                const afterMidnightStart = Math.max(0, shiftStartMinutes - (24 * 60));
                const afterMidnightEnd = Math.min(actualShiftEndMinutes - (24 * 60), nightEndMinutes - (24 * 60));
                if (afterMidnightStart < afterMidnightEnd) {
                  nightHours += (afterMidnightEnd - afterMidnightStart) / 60;
                }
              }
            }
          } else {
            // Night period doesn't cross midnight
            if (nightOverlapStart < nightOverlapEnd) {
              nightHours = (nightOverlapEnd - nightOverlapStart) / 60;
            }
          }
          
          console.log(`Calculated morning hours: ${morningHours}`);
          console.log(`Calculated night hours: ${nightHours}`);
          
          // Ensure we don't exceed total hours and handle any remaining hours
          const totalCalculated = morningHours + nightHours;
          if (totalCalculated > finalHours) {
            const ratio = finalHours / totalCalculated;
            morningHours *= ratio;
            nightHours *= ratio;
          } else if (totalCalculated < finalHours) {
            // Assign remaining hours to the appropriate period based on when most of the shift occurred
            const remainingHours = finalHours - totalCalculated;
            if (morningHours > nightHours) {
              morningHours += remainingHours;
            } else {
              nightHours += remainingHours;
            }
          }
        }

        // Calculate wage amounts
        const totalCardAmountFlat = Math.max(0, finalHours) * defaultWageRate;
        const morningWageRate = wageSettings?.morning_wage_rate || 17;
        const nightWageRate = wageSettings?.night_wage_rate || 20;
        const totalCardAmountSplit = (morningHours * morningWageRate) + (nightHours * nightWageRate);

        const processedEntry = {
          employee_name: employeeIdentifier, // Keep original ID for database consistency
          clock_in_date: clockInDateFormatted,
          clock_in_time: clockInTimeFormatted,
          clock_out_date: clockOutDateFormatted,
          clock_out_time: clockOutTimeFormatted,
          total_hours: Math.max(0, finalHours),
          morning_hours: Math.max(0, morningHours),
          night_hours: Math.max(0, nightHours),
          total_card_amount_flat: totalCardAmountFlat,
          total_card_amount_split: totalCardAmountSplit,
          break_start: null,
          break_end: null,
          break_length: null,
          break_type: null,
          payroll_id: null,
          actual_hours: finalHours || null,
          no_show_reason: null,
          employee_note: null,
          manager_note: null,
          is_split_calculation: true
        };

        processedData.push(processedEntry);
        
      } catch (error) {
        console.error(`Error processing row ${i + 1}:`, error);
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    // If validation only, return results without inserting
    if (validateOnly) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          validEntries: processedData.length,
          errors: errors,
          preview: processedData.slice(0, 5) // First 5 entries for preview
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Handle auto-deletion of existing data if requested
    if (deleteExistingData && processedData.length > 0 && !validateOnly) {
      console.log('Auto-deleting existing timesheets for import dates...');
      
      // Get unique dates from processed data
      const importDates = [...new Set(processedData.map(entry => entry.clock_in_date))];
      console.log('Deleting existing entries for dates:', importDates);
      
      // Delete all existing entries for the import dates at once
      const { error: deleteError } = await supabaseAdmin
        .from('timesheet_entries')
        .delete()
        .in('clock_in_date', importDates);

      if (deleteError) {
        console.error('Error deleting existing timesheets:', deleteError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to delete existing timesheets', details: deleteError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      console.log(`Deleted existing entries for dates: ${importDates.join(', ')}`);
    }

    // Insert processed data into database
    if (processedData.length > 0) {
      // If deleteExistingData was used, we already deleted by date, so insert directly
      // If overwriteExisting, delete by employee+date combination
      if (overwriteExisting && !deleteExistingData) {
        for (const entry of processedData) {
          await supabaseAdmin
            .from('timesheet_entries')
            .delete()
            .eq('employee_name', entry.employee_name)
            .eq('clock_in_date', entry.clock_in_date);
        }
      } else if (!deleteExistingData) {
        // Only check for duplicates if we didn't already delete by date
        const filteredData = [];
        for (const entry of processedData) {
          const { data: existing } = await supabaseAdmin
            .from('timesheet_entries')
            .select('id')
            .eq('employee_name', entry.employee_name)
            .eq('clock_in_date', entry.clock_in_date)
            .maybeSingle();

          if (!existing) {
            filteredData.push(entry);
          } else {
            errors.push(`Duplicate entry skipped for ${entry.employee_name} on ${entry.clock_in_date}`);
          }
        }
        processedData.splice(0, processedData.length, ...filteredData);
      }

      if (processedData.length > 0) {
        const { data: insertedData, error: insertError } = await supabaseAdmin
          .from('timesheet_entries')
          .insert(processedData)
          .select();

        if (insertError) {
          console.error('Error inserting timesheet data:', insertError);
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to insert timesheet data', details: insertError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        console.log(`Successfully inserted ${insertedData?.length || 0} timesheet entries`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedData.length,
        errors: errors,
        message: `Successfully processed ${processedData.length} timesheet entries`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Timesheet processing error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})
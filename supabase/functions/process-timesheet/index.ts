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
  deletePeriod?: {
    fromDate: string;
    toDate: string;
  } | null;
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
    const { data: rawData, validateOnly = false, overwriteExisting = false, deletePeriod }: ProcessTimesheetRequest = body

    console.log(`Processing ${rawData.length} timesheet entries (validate only: ${validateOnly})`);

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Handle period deletion if requested
    if (deletePeriod && deletePeriod.fromDate && deletePeriod.toDate && !validateOnly) {
      console.log(`Deleting existing timesheets from ${deletePeriod.fromDate} to ${deletePeriod.toDate}`);
      
      const { error: deleteError, count } = await supabaseAdmin
        .from('timesheet_entries')
        .delete()
        .gte('clock_in_date', deletePeriod.fromDate)
        .lte('clock_in_date', deletePeriod.toDate);

      if (deleteError) {
        console.error('Error deleting existing timesheets:', deleteError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to delete existing timesheets', details: deleteError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log(`Successfully deleted ${count || 0} existing timesheet entries`);
    }

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
        
        // Calculate wage amount
        const totalCardAmountFlat = Math.max(0, finalHours) * defaultWageRate;

        const processedEntry = {
          employee_name: employeeIdentifier, // Keep original ID for database consistency
          clock_in_date: clockInDateFormatted,
          clock_in_time: clockInTimeFormatted,
          clock_out_date: clockOutDateFormatted,
          clock_out_time: clockOutTimeFormatted,
          total_hours: Math.max(0, finalHours),
          total_card_amount_flat: totalCardAmountFlat,
          break_start: null,
          break_end: null,
          break_length: null,
          break_type: null,
          payroll_id: null,
          actual_hours: finalHours || null,
          no_show_reason: null,
          employee_note: null,
          manager_note: null,
          is_split_calculation: false
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

    // Insert processed data into database
    if (processedData.length > 0) {
      // If overwriting, delete existing entries first
      if (overwriteExisting) {
        for (const entry of processedData) {
          await supabaseAdmin
            .from('timesheet_entries')
            .delete()
            .eq('employee_name', entry.employee_name)
            .eq('clock_in_date', entry.clock_in_date);
        }
      } else {
        // Check for duplicates and skip them
        const filteredData = [];
        for (const entry of processedData) {
          const { data: existing } = await supabaseAdmin
            .from('timesheet_entries')
            .select('id')
            .eq('employee_name', entry.employee_name)
            .eq('clock_in_date', entry.clock_in_date)
            .single();

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
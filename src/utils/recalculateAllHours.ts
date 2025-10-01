import { supabase } from '@/integrations/supabase/client';

export const recalculateAllTimesheetHours = async () => {
  console.log('🔄 Starting recalculation of ALL timesheet hours...');
  
  try {
    // Fetch all timesheet entries
    const { data: entries, error } = await supabase
      .from('timesheet_entries')
      .select('*')
      .not('clock_in_time', 'is', null)
      .not('clock_out_time', 'is', null);
    
    if (error) {
      console.error('Error fetching entries:', error);
      throw error;
    }
    
    if (!entries || entries.length === 0) {
      console.log('No entries to recalculate');
      return { success: true, count: 0 };
    }
    
    console.log(`Found ${entries.length} entries to recalculate`);
    
    // Helper functions
    const timeToMinutes = (timeStr: string): number => {
      const clean = (timeStr || '00:00:00').split('.')[0];
      const [h, m] = clean.split(':').map((v) => parseInt(v, 10) || 0);
      return (h % 24) * 60 + (m % 60);
    };
    
    const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): number => {
      const start = Math.max(aStart, bStart);
      const end = Math.min(aEnd, bEnd);
      return Math.max(0, end - start);
    };
    
    // Process each entry
    let successCount = 0;
    let errorCount = 0;
    
    for (const entry of entries) {
      try {
        if (!entry.clock_in_time || !entry.clock_out_time) {
          continue;
        }
        
        let shiftStart = timeToMinutes(entry.clock_in_time);
        let shiftEnd = timeToMinutes(entry.clock_out_time);
        
        // Handle overnight shifts
        if (shiftEnd < shiftStart) {
          shiftEnd += 24 * 60;
        }
        
        // Morning: 6 AM (360 min) to 5 PM (1020 min)
        const morningStart = 360; // 6 AM
        const morningEnd = 1020; // 5 PM
        const morningMinutes = overlap(shiftStart, shiftEnd, morningStart, morningEnd);
        
        // Night: 5 PM (1020 min) to 6 AM next day (1800 min)
        const nightStart = 1020; // 5 PM
        const nightEnd = 1440 + 360; // 6 AM next day (24 hours + 6 hours)
        const nightMinutes = overlap(shiftStart, shiftEnd, nightStart, nightEnd);
        
        const morningHours = Math.round((morningMinutes / 60) * 100) / 100;
        const nightHours = Math.round((nightMinutes / 60) * 100) / 100;
        
        // Update the entry
        const { error: updateError } = await supabase
          .from('timesheet_entries')
          .update({
            morning_hours: morningHours,
            night_hours: nightHours,
            is_split_calculation: true
          })
          .eq('id', entry.id);
        
        if (updateError) {
          console.error(`Error updating entry ${entry.id}:`, updateError);
          errorCount++;
        } else {
          successCount++;
          if (successCount % 10 === 0) {
            console.log(`✅ Updated ${successCount} entries...`);
          }
        }
        
      } catch (entryError) {
        console.error(`Error processing entry ${entry.id}:`, entryError);
        errorCount++;
      }
    }
    
    console.log(`✅ Recalculation complete!`);
    console.log(`   - Success: ${successCount} entries`);
    console.log(`   - Errors: ${errorCount} entries`);
    
    // Verify unassigned hours
    const { data: summary } = await supabase
      .from('timesheet_entries')
      .select('total_hours, morning_hours, night_hours')
      .not('clock_in_time', 'is', null)
      .not('clock_out_time', 'is', null);
    
    if (summary) {
      const totalHours = summary.reduce((sum, e) => sum + (e.total_hours || 0), 0);
      const totalMorning = summary.reduce((sum, e) => sum + (e.morning_hours || 0), 0);
      const totalNight = summary.reduce((sum, e) => sum + (e.night_hours || 0), 0);
      const unassigned = totalHours - (totalMorning + totalNight);
      
      console.log(`📊 Summary after recalculation:`);
      console.log(`   - Total Hours: ${totalHours.toFixed(2)}`);
      console.log(`   - Morning Hours: ${totalMorning.toFixed(2)}`);
      console.log(`   - Night Hours: ${totalNight.toFixed(2)}`);
      console.log(`   - Unassigned Hours: ${unassigned.toFixed(2)}`);
    }
    
    return {
      success: true,
      count: successCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error('Fatal error during recalculation:', error);
    throw error;
  }
};


import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useCompanyTimezone } from '@/hooks/useCompanyTimezone';

interface TimesheetExportProps {
  selectedRows?: string[];
}

const TimesheetExport: React.FC<TimesheetExportProps> = ({ selectedRows = [] }) => {
  const { t } = useTranslation();
  const { formatDate, formatTimeAMPM } = useCompanyTimezone();

  const { data: timesheetData } = useQuery({
    queryKey: ['export-timesheets', selectedRows],
    queryFn: async () => {
      let query = supabase
        .from('timesheet_entries')
        .select(`
          *,
          employees (
            full_name,
            staff_id,
            morning_wage_rate,
            night_wage_rate
          )
        `)
        .order('created_at', { ascending: false });

      if (selectedRows.length > 0) {
        query = query.in('id', selectedRows);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: selectedRows.length > 0
  });

  const exportToExcel = async () => {
    if (!timesheetData || timesheetData.length === 0) {
      toast.error('No data to export');
      return;
    }

    const exportData = timesheetData.map(entry => ({
      'Employee Name': entry.employee_name,
      'Staff ID': entry.employees?.staff_id || 'N/A',
      'Clock In Date': formatDate(entry.clock_in_date),
      'Clock In Time': formatTimeAMPM(entry.clock_in_date, entry.clock_in_time),
      'Clock Out Date': entry.clock_out_date ? formatDate(entry.clock_out_date) : '',
      'Clock Out Time': entry.clock_out_time ? formatTimeAMPM(entry.clock_out_date || entry.clock_in_date, entry.clock_out_time) : '',
      'Total Hours': entry.total_hours,
      'Morning Hours': entry.morning_hours || 0,
      'Night Hours': entry.night_hours || 0,
      'Morning Rate (LE/hr)': entry.employees?.morning_wage_rate || 17.00,
      'Night Rate (LE/hr)': entry.employees?.night_wage_rate || 20.00,
      'Total Amount (Flat)': entry.total_card_amount_flat,
      'Total Amount (Split)': entry.total_card_amount_split || 0,
      'Break Start': entry.break_start || '',
      'Break End': entry.break_end || '',
      'Break Length': entry.break_length || 0,
      'Payroll ID': entry.payroll_id || '',
      'Employee Note': entry.employee_note || '',
      'Manager Note': entry.manager_note || '',
      'Is Split Calculation': entry.is_split_calculation ? 'Yes' : 'No'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Timesheet Data');

    const fileName = `timesheet_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast.success(`Exported ${exportData.length} records to ${fileName}`);
  };

  return (
    <Button
      onClick={exportToExcel}
      disabled={!timesheetData || timesheetData.length === 0}
      variant="outline"
      className="flex items-center space-x-2"
    >
      <Download className="h-4 w-4" />
      <span>{t('exportSelected') || 'Export Selected'}</span>
    </Button>
  );
};

export default TimesheetExport;

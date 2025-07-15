
import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';

interface TimesheetEntry {
  id: string;
  employee_name: string;
  clock_in_date: string;
  clock_in_time: string;
  clock_out_date: string;
  clock_out_time: string;
  total_hours: number;
  morning_hours?: number;
  night_hours?: number;
  total_card_amount_flat: number;
  total_card_amount_split?: number;
  break_start?: string;
  break_end?: string;
  break_length?: number;
  break_type?: string;
  payroll_id?: string;
  actual_hours?: number;
  no_show_reason?: string;
  employee_note?: string;
  manager_note?: string;
  is_split_calculation: boolean;
}

interface DateRange {
  from: Date;
  to: Date;
}

export const useTimesheetTable = (
  data: TimesheetEntry[],
  selectedRows: string[],
  onSelectionChange: (selectedRows: string[]) => void,
  onDataChange: () => void,
  dateRange?: DateRange
) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('timesheet_entries')
        .delete()
        .in('id', ids);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('entriesDeleted') || 'Entries deleted successfully');
      onSelectionChange([]);
      onDataChange();
    },
    onError: (error) => {
      console.error('Error deleting entries:', error);
      toast.error(t('errorDeletingEntries') || 'Error deleting entries');
    }
  });

  const filteredData = useMemo(() => {
    return data.filter(entry => {
      // Date range filter with proper inclusive boundaries
      if (dateRange && dateRange.from && dateRange.to) {
        const entryDate = parseISO(entry.clock_in_date);
        const fromDate = startOfDay(dateRange.from);
        const toDate = endOfDay(dateRange.to);
        
        const isWithinRange = isWithinInterval(entryDate, { start: fromDate, end: toDate });
        
        if (!isWithinRange) {
          return false;
        }
      }

      // Global search
      const matchesGlobalSearch = Object.values(entry).some(value => 
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (!matchesGlobalSearch) return false;
      
      // Column-specific filters
      return Object.entries(columnFilters).every(([column, filter]) => {
        if (!filter) return true;
        const value = entry[column as keyof TimesheetEntry];
        return value?.toString().toLowerCase().includes(filter.toLowerCase());
      });
    });
  }, [data, searchTerm, columnFilters, dateRange]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(filteredData.map(entry => entry.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedRows, id]);
    } else {
      onSelectionChange(selectedRows.filter(rowId => rowId !== id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedRows.length > 0) {
      deleteMutation.mutate(selectedRows);
    }
  };

  const updateColumnFilter = (column: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  return {
    searchTerm,
    setSearchTerm,
    columnFilters,
    updateColumnFilter,
    filteredData,
    handleSelectAll,
    handleSelectRow,
    handleDeleteSelected,
    deleteMutation
  };
};

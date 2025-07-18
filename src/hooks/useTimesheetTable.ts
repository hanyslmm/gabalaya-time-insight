
import { useState, useMemo, useCallback } from 'react';
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
  employee_id?: string;
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
  dateRange?: DateRange,
  selectedEmployee?: string
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
    if (!data || data.length === 0) return [];
    
    return data.filter(entry => {
      try {
        // Employee filter - enhanced to work with both employee_id and employee_name
        if (selectedEmployee && selectedEmployee !== 'all') {
          const entryEmployeeId = entry.employee_id;
          const entryEmployeeName = entry.employee_name;
          
          // Check both employee_id and employee_name for match
          const matchesEmployeeId = entryEmployeeId === selectedEmployee;
          const matchesEmployeeName = entryEmployeeName === selectedEmployee;
          
          if (!matchesEmployeeId && !matchesEmployeeName) {
            return false;
          }
        }
        
        // Date range filter with proper inclusive boundaries
        if (dateRange && dateRange.from && dateRange.to) {
          try {
            const entryDate = parseISO(entry.clock_in_date);
            const fromDate = startOfDay(dateRange.from);
            const toDate = endOfDay(dateRange.to);
            
            const isWithinRange = isWithinInterval(entryDate, { start: fromDate, end: toDate });
            
            if (!isWithinRange) {
              return false;
            }
          } catch (dateError) {
            console.warn('Date parsing error for entry:', entry.id, dateError);
            return false;
          }
        }

        // Global search - handle null/undefined values safely
        if (searchTerm && searchTerm.trim() !== '') {
          const searchLower = searchTerm.toLowerCase();
          const matchesGlobalSearch = Object.values(entry).some(value => {
            if (value === null || value === undefined) return false;
            return value.toString().toLowerCase().includes(searchLower);
          });
          
          if (!matchesGlobalSearch) return false;
        }
        
        // Column-specific filters
        const matchesColumnFilters = Object.entries(columnFilters).every(([column, filter]) => {
          if (!filter || filter.trim() === '') return true;
          
          const value = entry[column as keyof TimesheetEntry];
          if (value === null || value === undefined) return false;
          
          return value.toString().toLowerCase().includes(filter.toLowerCase());
        });
        
        return matchesColumnFilters;
      } catch (error) {
        console.warn('Error filtering entry:', entry.id, error);
        return false;
      }
    });
  }, [data, searchTerm, columnFilters, dateRange, selectedEmployee]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      onSelectionChange(filteredData.map(entry => entry.id));
    } else {
      onSelectionChange([]);
    }
  }, [filteredData, onSelectionChange]);

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedRows, id]);
    } else {
      onSelectionChange(selectedRows.filter(rowId => rowId !== id));
    }
  }, [selectedRows, onSelectionChange]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedRows.length > 0) {
      deleteMutation.mutate(selectedRows);
    }
  }, [selectedRows, deleteMutation]);

  const updateColumnFilter = useCallback((column: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchTerm('');
    setColumnFilters({});
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    columnFilters,
    updateColumnFilter,
    clearAllFilters,
    filteredData,
    handleSelectAll,
    handleSelectRow,
    handleDeleteSelected,
    deleteMutation
  };
};

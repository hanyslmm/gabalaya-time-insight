
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

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

interface TimesheetTableProps {
  data: TimesheetEntry[];
  selectedRows: string[];
  onSelectionChange: (selectedRows: string[]) => void;
  onDataChange: () => void;
}

const TimesheetTable: React.FC<TimesheetTableProps> = ({ 
  data, 
  selectedRows, 
  onSelectionChange, 
  onDataChange 
}) => {
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

  const filteredData = data.filter(entry => {
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

  return (
    <div className="space-y-4">
      {/* Global Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('searchTimesheet') || 'Search timesheet entries...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {selectedRows.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                {t('deleteSelected') || 'Delete Selected'} ({selectedRows.length})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('confirmDelete') || 'Confirm Delete'}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('deleteConfirmation') || `Are you sure you want to delete ${selectedRows.length} selected entries? This action cannot be undone.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel') || 'Cancel'}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteSelected} className="bg-red-600 hover:bg-red-700">
                  {t('delete') || 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Data Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedRows.length === filteredData.length && filteredData.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>
                <div className="space-y-1">
                  <span>{t('name') || 'Name'}</span>
                  <Input
                    placeholder="Filter..."
                    value={columnFilters.employee_name || ''}
                    onChange={(e) => updateColumnFilter('employee_name', e.target.value)}
                    className="h-6 text-xs"
                  />
                </div>
              </TableHead>
              <TableHead>{t('clockInDate') || 'Clock In Date'}</TableHead>
              <TableHead>{t('clockInTime') || 'Clock In Time'}</TableHead>
              <TableHead>{t('clockOutDate') || 'Clock Out Date'}</TableHead>
              <TableHead>{t('clockOutTime') || 'Clock Out Time'}</TableHead>
              <TableHead>{t('totalHours') || 'Total Hours'}</TableHead>
              <TableHead>{t('morningHours') || 'Morning Hours'}</TableHead>
              <TableHead>{t('nightHours') || 'Night Hours'}</TableHead>
              <TableHead>{t('totalAmountFlat') || 'Total Amount (Flat)'}</TableHead>
              <TableHead>{t('totalAmountSplit') || 'Total Amount (Split)'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                  {t('noTimesheetData') || 'No timesheet data available'}
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.includes(entry.id)}
                      onCheckedChange={(checked) => handleSelectRow(entry.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{entry.employee_name}</TableCell>
                  <TableCell>{entry.clock_in_date}</TableCell>
                  <TableCell>{entry.clock_in_time}</TableCell>
                  <TableCell>{entry.clock_out_date}</TableCell>
                  <TableCell>{entry.clock_out_time}</TableCell>
                  <TableCell>{entry.total_hours.toFixed(2)}</TableCell>
                  <TableCell>{entry.morning_hours?.toFixed(2) || '-'}</TableCell>
                  <TableCell>{entry.night_hours?.toFixed(2) || '-'}</TableCell>
                  <TableCell>LE {entry.total_card_amount_flat.toFixed(2)}</TableCell>
                  <TableCell>{entry.total_card_amount_split ? `LE ${entry.total_card_amount_split.toFixed(2)}` : '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="text-sm text-gray-500">
        {t('showing') || 'Showing'} {filteredData.length} {t('of') || 'of'} {data.length} {t('entries') || 'entries'}
        {selectedRows.length > 0 && ` (${selectedRows.length} ${t('selected') || 'selected'})`}
      </div>
    </div>
  );
};

export default TimesheetTable;

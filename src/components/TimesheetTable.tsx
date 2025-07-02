import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTimesheetTable } from '@/hooks/useTimesheetTable';
import { useIsMobile } from '@/hooks/use-mobile';
import TimesheetTableFilters from './TimesheetTableFilters';
import TimesheetTableActions from './TimesheetTableActions';
import TimesheetMobileCard from './TimesheetMobileCard';
import TimesheetSummary from './TimesheetSummary';

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

interface TimesheetTableProps {
  data: TimesheetEntry[];
  selectedRows: string[];
  onSelectionChange: (selectedRows: string[]) => void;
  onDataChange: () => void;
  dateRange?: DateRange;
}

const TimesheetTable: React.FC<TimesheetTableProps> = ({ 
  data, 
  selectedRows, 
  onSelectionChange, 
  onDataChange,
  dateRange
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  
  const {
    searchTerm,
    setSearchTerm,
    columnFilters,
    updateColumnFilter,
    filteredData,
    handleSelectAll,
    handleSelectRow,
    handleDeleteSelected,
    deleteMutation
  } = useTimesheetTable(data, selectedRows, onSelectionChange, onDataChange, dateRange);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <TimesheetSummary data={filteredData} dateRange={dateRange} />

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
        <div className="flex-1 w-full sm:w-auto">
          <TimesheetTableFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            columnFilters={columnFilters}
            onColumnFilterChange={updateColumnFilter}
          />
        </div>
        <TimesheetTableActions
          selectedRowsCount={selectedRows.length}
          onDeleteSelected={handleDeleteSelected}
          isDeleting={deleteMutation.isPending}
        />
      </div>

      {/* Mobile View */}
      {isMobile ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
            <Checkbox
              checked={selectedRows.length === filteredData.length && filteredData.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm font-medium">Select All</span>
          </div>
          
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {t('noTimesheetData') || 'No timesheet data available'}
            </div>
          ) : (
            filteredData.map((entry) => (
              <TimesheetMobileCard
                key={entry.id}
                entry={entry}
                isSelected={selectedRows.includes(entry.id)}
                onSelect={(checked) => handleSelectRow(entry.id, checked)}
              />
            ))
          )}
        </div>
      ) : (
        /* Desktop View */
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
      )}
      
      <div className="text-sm text-gray-500">
        {t('showing') || 'Showing'} {filteredData.length} {t('of') || 'of'} {data.length} {t('entries') || 'entries'}
        {selectedRows.length > 0 && ` (${selectedRows.length} ${t('selected') || 'selected'})`}
      </div>
    </div>
  );
};

export default TimesheetTable;

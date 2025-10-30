
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Settings2 } from 'lucide-react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { useTimesheetTable } from '@/hooks/useTimesheetTable';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { Edit, List, BarChart3, Plus } from 'lucide-react';
import { useCompanyTimezone } from '@/hooks/useCompanyTimezone';
import { calculateMorningNightHours } from '@/utils/wageCalculations';
import TimesheetTableFilters from './TimesheetTableFilters';
import TimesheetTableActions from './TimesheetTableActions';
import TimesheetMobileCard from './TimesheetMobileCard';
import TimesheetSummary from './TimesheetSummary';
import TimesheetEditDialog from './TimesheetEditDialog';
import AggregatedTimesheetView from './AggregatedTimesheetView';

interface TimesheetEntry {
  id: string;
  employee_name: string;
  employee_id?: string;
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
  selectedEmployee?: string;
  wageSettings?: any;
  employees?: Array<{ id: string; full_name?: string; morning_wage_rate?: number; night_wage_rate?: number }>; 
}

const ITEMS_PER_PAGE = 10; // Changed from 20 to 10 for better pagination

const TimesheetTable: React.FC<TimesheetTableProps> = ({ 
  data, 
  selectedRows, 
  onSelectionChange, 
  onDataChange,
  dateRange,
  selectedEmployee,
  wageSettings,
  employees
}) => {
  const { user } = useAuth();
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'detailed' | 'aggregated'>('detailed');
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const { formatDate, formatTimeAMPM, timezone } = useCompanyTimezone();
  const [processedData, setProcessedData] = useState(data);
  const [rowDensity, setRowDensity] = useState<'comfortable' | 'compact' | 'ultra'>((localStorage.getItem('timesheetRowDensity') as any) || 'comfortable');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const stored = localStorage.getItem('timesheetVisibleColumns');
    return stored ? JSON.parse(stored) : {
      employee_name: true,
      clock_in_date: true,
      clock_in_time: true,
      clock_out_date: true,
      clock_out_time: true,
      total_hours: true,
      morning_hours: true,
      night_hours: true,
      amount: true,
      actions: true,
    };
  });

  // Process data for timezone-aware calculations
  useEffect(() => {
    if (!wageSettings || !timezone) {
      setProcessedData(data);
      return;
    }

    const processData = async () => {
      try {
        const processed = await Promise.all(
          data.map(async (entry) => {
            // Always compute using timezone-aware function to ensure correct display
            const { morningHours, nightHours } = await calculateMorningNightHours(
              entry,
              wageSettings,
              timezone
            );

            // Calculate total amount (prefer DB value if present and > 0)
            const employeeMorningRate = employees?.find(e => e.id === (entry as any).employee_id)?.morning_wage_rate || wageSettings.morning_wage_rate;
            const employeeNightRate = employees?.find(e => e.id === (entry as any).employee_id)?.night_wage_rate || wageSettings.night_wage_rate;
            const computedAmount = morningHours * employeeMorningRate + nightHours * employeeNightRate;
            const dbAmount = Number(entry.total_card_amount_split || entry.total_card_amount_flat || 0);
            const calculatedTotalAmount = dbAmount > 0 ? dbAmount : computedAmount;

            return {
              ...entry,
              morning_hours: morningHours,
              night_hours: nightHours,
              total_card_amount_split: parseFloat(calculatedTotalAmount.toFixed(2))
            };
          })
        );
        setProcessedData(processed);
      } catch (error) {
        console.error('Error processing timesheet data:', error);
        setProcessedData(data);
      }
    };

    processData();
  }, [data, wageSettings, timezone, employees]);

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setShowEditDialog(true);
  };

  const handleAddNew = () => {
    setEditingEntry(null);
    setShowEditDialog(true);
  };

  const handleEditClose = () => {
    setShowEditDialog(false);
    setEditingEntry(null);
  };
  
  const {
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
  } = useTimesheetTable(processedData, selectedRows, onSelectionChange, onDataChange, dateRange, selectedEmployee);

  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    const stored = localStorage.getItem('timesheetItemsPerPage');
    return stored ? parseInt(stored, 10) : 10;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when data changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filteredData.length]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1); // Reset to first page when changing items per page
    localStorage.setItem('timesheetItemsPerPage', value.toString());
  };

  const handleSelectAllPage = (checked: boolean) => {
    if (checked) {
      const pageIds = paginatedData.map(entry => entry.id);
      const newSelection = [...new Set([...selectedRows, ...pageIds])];
      onSelectionChange(newSelection);
    } else {
      const pageIds = paginatedData.map(entry => entry.id);
      onSelectionChange(selectedRows.filter(id => !pageIds.includes(id)));
    }
  };

  const isAllPageSelected = paginatedData.length > 0 && paginatedData.every(entry => selectedRows.includes(entry.id));

  // Check if any filters are active
  const hasActiveFilters = searchTerm.trim() !== '' || 
    Object.values(columnFilters).some(filter => filter.trim() !== '') ||
    (selectedEmployee && selectedEmployee !== 'all') ||
    (dateRange && dateRange.from && dateRange.to);

  // Format total hours with ability to clear/delete
  const formatTotalHours = (hours: number | null | undefined) => {
    if (hours === null || hours === undefined || hours === 0) {
      return '0.00';
    }
    return hours.toFixed(2);
  };

  // Helpers for split-hour calculations (Egypt timezone windows by default)
  const timeToMinutes = (timeStr?: string | null): number | null => {
    if (!timeStr) return null;
    const clean = (timeStr || '00:00:00').split('.')[0];
    const [h, m] = clean.split(':').map((v) => parseInt(v, 10));
    if (isNaN(h) || isNaN(m)) return null;
    return (h % 24) * 60 + (m % 60);
  };
  const overlapMinutes = (aStart: number, aEnd: number, bStart: number, bEnd: number): number => {
    const start = Math.max(aStart, bStart);
    const end = Math.min(aEnd, bEnd);
    return Math.max(0, end - start);
  };

  const getEmployeeRates = (empId?: string | null) => {
    const defaultMorning = wageSettings?.morning_wage_rate ?? 17;
    const defaultNight = wageSettings?.night_wage_rate ?? 20;
    const flatRate = wageSettings?.default_flat_wage_rate ?? 20;
    if (!empId || !employees) return { morning: defaultMorning, night: defaultNight, flat: flatRate };
    const emp = employees.find((e) => e.id === empId);
    return {
      morning: emp?.morning_wage_rate ?? defaultMorning,
      night: emp?.night_wage_rate ?? defaultNight,
      flat: flatRate,
    };
  };

  const computeDisplay = (entry: TimesheetEntry) => {
    // Check for virtual hours first (for active employees)
    const hasVirtualHours = (entry as any).virtual_morning_hours !== undefined || (entry as any).virtual_night_hours !== undefined;
    
    if (hasVirtualHours) {
      // Use virtual hours for active employees
      const morning = (entry as any).virtual_morning_hours ?? 0;
      const night = (entry as any).virtual_night_hours ?? 0;
      const rates = getEmployeeRates((entry as any).employee_id as string | undefined);
      const actualHours = (entry as any).virtual_total_hours ?? entry.total_hours ?? 0;
      
      const computedSplitAmount = morning * rates.morning + night * rates.night;
      const computedFlatAmount = actualHours * rates.flat;
      const isSplit = (morning + night > 0) && computedSplitAmount > 0;
      const amount = isSplit ? computedSplitAmount : computedFlatAmount;
      
      return {
        morningHours: morning,
        nightHours: night,
        amount,
        isSplit,
      };
    }
    
    // Original logic for completed entries
    // If DB already has values, use them; otherwise compute
    let inMins = timeToMinutes(entry.clock_in_time);
    let outMins = timeToMinutes(entry.clock_out_time);
    let morning = entry.morning_hours ?? 0;
    let night = entry.night_hours ?? 0;

    if ((morning === 0 && night === 0) && inMins !== null && outMins !== null) {
      if (outMins < inMins) outMins += 24 * 60; // overnight shift
      
      // No working hours window filter - use all time
      
      // Use organization-specific wage settings for boundaries
      const toMinutesLocal = (timeStr?: string) => {
        const clean = (timeStr || '00:00:00').split('.')[0];
        const [h, m] = clean.split(':').map((v) => parseInt(v, 10) || 0);
        return (h % 24) * 60 + (m % 60);
      };

      const morningStart = toMinutesLocal(wageSettings?.morning_start_time || '06:00:00');
      const morningEnd = toMinutesLocal(wageSettings?.morning_end_time || '17:00:00');
      const nightStart = toMinutesLocal(wageSettings?.night_start_time || '17:00:00');
      let nightEnd = toMinutesLocal(wageSettings?.night_end_time || '06:00:00');
      if (nightEnd < nightStart) nightEnd += 24 * 60;
      const morningMinutes = overlapMinutes(inMins, outMins, morningStart, morningEnd);
      const nightMinutes = overlapMinutes(inMins, outMins, nightStart, nightEnd);
      morning = morningMinutes / 60;
      night = nightMinutes / 60;
      // Guard rounding tiny decimals
      if (morning < 1e-6) morning = 0;
      if (night < 1e-6) night = 0;
    }

    const rates = getEmployeeRates((entry as any).employee_id as string | undefined);
    const actualHours = entry.actual_hours ?? entry.total_hours ?? 0;

    // Prefer DB amounts if present; otherwise calculate
    const dbAmount = Number(entry.total_card_amount_split || entry.total_card_amount_flat || 0);
    const computedSplitAmount = morning * rates.morning + night * rates.night;
    const computedFlatAmount = actualHours * rates.flat;

    const isSplit = (entry.is_split_calculation || (morning + night > 0)) && computedSplitAmount > 0;
    const amount = dbAmount > 0 ? dbAmount : (isSplit ? computedSplitAmount : computedFlatAmount);

    return {
      morningHours: morning,
      nightHours: night,
      amount,
      isSplit,
    };
  };

  // Keyboard shortcuts: / to focus name filter, f to focus global search, e to edit first selected
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' || (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey)) {
        const el = document.querySelector<HTMLInputElement>('input[placeholder="Filter by name..."]');
        if (el) { e.preventDefault(); el.focus(); }
      }
      if (e.key.toLowerCase() === 'e') {
        const first = paginatedData.find((entry) => selectedRows.includes(entry.id));
        if (first) { e.preventDefault(); handleEdit(first); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [paginatedData, selectedRows]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <TimesheetSummary data={filteredData} dateRange={dateRange} />

      {/* View Toggle and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'detailed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('detailed')}
            className="flex items-center space-x-1"
          >
            <List className="h-4 w-4" />
            <span>Detailed</span>
          </Button>
          <Button
            variant={viewMode === 'aggregated' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('aggregated')}
            className="flex items-center space-x-1"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Aggregated</span>
          </Button>
        </div>
        <div className="ml-auto flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Settings2 className="h-4 w-4 mr-1" /> View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Row Density</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => { setRowDensity('comfortable'); localStorage.setItem('timesheetRowDensity', 'comfortable'); }}>Comfortable</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setRowDensity('compact'); localStorage.setItem('timesheetRowDensity', 'compact'); }}>Compact</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setRowDensity('ultra'); localStorage.setItem('timesheetRowDensity', 'ultra'); }}>Ultra-compact</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              {Object.keys(visibleColumns).map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={visibleColumns[key]}
                  onCheckedChange={(v) => {
                    const next = { ...visibleColumns, [key]: !!v };
                    setVisibleColumns(next);
                    localStorage.setItem('timesheetVisibleColumns', JSON.stringify(next));
                  }}
                >
                  {key.replace(/_/g, ' ')}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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

      {/* Filter Status and Clear Button */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-blue-800">
                Filters Active: {filteredData.length} of {processedData.length} entries shown
              </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
            className="text-blue-600 border-blue-300 hover:bg-blue-100"
          >
            Clear All Filters
          </Button>
        </div>
      )}

      {/* Conditional View Rendering */}
      {viewMode === 'aggregated' ? (
        <AggregatedTimesheetView data={filteredData} onDataChange={onDataChange} />
      ) : (
        <>
          {/* Mobile View */}
          {isMobile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={isAllPageSelected}
                    onCheckedChange={handleSelectAllPage}
                  />
                  <span className="text-sm font-medium">Select Page</span>
                </div>
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
              </div>
              
              {paginatedData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {hasActiveFilters ? (
                    <div className="space-y-2">
                      <p>{t('noFilteredData') || 'No data matches your filters'}</p>
                      <Button variant="outline" onClick={clearAllFilters}>
                        Clear Filters
                      </Button>
                    </div>
                  ) : (
                    <p>{t('noTimesheetData') || 'No timesheet data available'}</p>
                  )}
                </div>
              ) : (
                paginatedData.map((entry) => (
                  <TimesheetMobileCard
                    key={entry.id}
                    entry={entry}
                    isSelected={selectedRows.includes(entry.id)}
                    onSelect={(checked) => handleSelectRow(entry.id, checked)}
                    onEdit={handleEdit}
                  />
                ))
              )}
            </div>
          ) : (
            /* Desktop View */
            <div className="table-wrapper mobile-scroll">
              <Table className={rowDensity !== 'comfortable' ? (rowDensity === 'compact' ? 'text-[13px]' : 'text-[12px]') : ''}>
                <TableHeader className="table-header">
                  <TableRow>
                    <TableHead className="w-12 sticky left-0 bg-background/95 backdrop-blur">
                      <Checkbox
                        checked={isAllPageSelected}
                        onCheckedChange={handleSelectAllPage}
                      />
                    </TableHead>
                    {visibleColumns.employee_name && (
                    <TableHead className="min-w-[150px] sticky left-12 bg-background/95 backdrop-blur">
                      <div className="space-y-1">
                        <span className="font-semibold">{t('name') || 'Employee Name'}</span>
                        <Input
                          placeholder="Filter by name..."
                          value={columnFilters.employee_name || ''}
                          onChange={(e) => updateColumnFilter('employee_name', e.target.value)}
                          className="h-6 text-xs"
                        />
                      </div>
                    </TableHead>
                    )}
                    {visibleColumns.clock_in_date && <TableHead className="min-w-[120px]">{t('clockInDate') || 'Clock In Date'}</TableHead>}
                    {visibleColumns.clock_in_time && <TableHead className="min-w-[100px]">{t('clockInTime') || 'Clock In Time'}</TableHead>}
                    {visibleColumns.clock_out_date && <TableHead className="min-w-[120px]">{t('clockOutDate') || 'Clock Out Date'}</TableHead>}
                    {visibleColumns.clock_out_time && <TableHead className="min-w-[100px]">{t('clockOutTime') || 'Clock Out Time'}</TableHead>}
                    {visibleColumns.total_hours && <TableHead className="min-w-[100px]">{t('totalHours') || 'Total Hours'}</TableHead>}
                    {visibleColumns.morning_hours && <TableHead className="min-w-[110px] hidden lg:table-cell">{t('morningHours') || 'Morning Hours'}</TableHead>}
                    {visibleColumns.night_hours && <TableHead className="min-w-[100px] hidden lg:table-cell">{t('nightHours') || 'Night Hours'}</TableHead>}
                    {visibleColumns.amount && <TableHead className="min-w-[120px]">{t('totalAmount') || 'Total Amount'}</TableHead>}
                    {isAdmin && visibleColumns.actions && (
                      <TableHead className="min-w-[100px]">
                        <div className="flex items-center justify-between">
                          <span>Actions</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddNew}
                            className="h-6 w-6 p-0"
                            title="Add new timesheet entry"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                 <TableBody>
                   {paginatedData.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={isAdmin ? 11 : 10} className="text-center py-12">
                         {hasActiveFilters ? (
                           <div className="space-y-3">
                             <div className="text-muted-foreground text-lg mb-2">No entries match your filters</div>
                             <div className="text-muted-foreground/70 text-sm mb-4">
                               {filteredData.length === 0 ? 'No data matches the current filters' : 'Try adjusting your filters or date range'}
                             </div>
                             <Button variant="outline" onClick={clearAllFilters}>
                               Clear All Filters
                             </Button>
                           </div>
                         ) : (
                           <div className="text-muted-foreground text-lg mb-2">No timesheet entries found</div>
                         )}
                       </TableCell>
                     </TableRow>
                  ) : (
                    paginatedData.map((entry) => {
                      const disp = computeDisplay(entry);
                      return (
                        <TableRow key={entry.id} className="table-row">
                          <TableCell className="sticky left-0 bg-background/95 backdrop-blur">
                            <Checkbox
                              checked={selectedRows.includes(entry.id)}
                              onCheckedChange={(checked) => handleSelectRow(entry.id, !!checked)}
                            />
                          </TableCell>
                          {visibleColumns.employee_name && (
                          <TableCell className="font-medium sticky left-12 bg-background/95 backdrop-blur min-w-0 z-10 p-2">
                            <div className="truncate pr-2 text-xs sm:text-sm" title={entry.employee_name}>
                              {entry.employee_name}
                            </div>
                          </TableCell>
                          )}
                          <TableCell>
                            <div className="font-medium text-xs sm:text-sm truncate" title={formatDate(entry.clock_in_date)}>
                              {formatDate(entry.clock_in_date)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-muted-foreground text-xs sm:text-sm truncate">
                              {formatTimeAMPM(entry.clock_in_date, entry.clock_in_time)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-fluid-sm">{entry.clock_out_date ? formatDate(entry.clock_out_date) : '—'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-muted-foreground text-fluid-sm">{entry.clock_out_time ? formatTimeAMPM(entry.clock_out_date || entry.clock_in_date, entry.clock_out_time) : '—'}</div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono font-bold text-primary">
                              {formatTotalHours((entry as any).virtual_total_hours !== undefined ? (entry as any).virtual_total_hours : entry.total_hours)}h
                            </span>
                          </TableCell>
                          {visibleColumns.morning_hours && (
                          <TableCell className="hidden lg:table-cell">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-fluid-xs">
                                    <div className="flex items-center gap-2 min-w-[120px]">
                                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full bg-orange-500" style={{ width: `${Math.min(100, (disp.morningHours / Math.max(0.001, (disp.morningHours + disp.nightHours))) * 100)}%` }} />
                                      </div>
                                      <span className="font-medium">{disp.morningHours.toFixed(2)}h</span>
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Calculated in {timezone}. Morning window {(wageSettings?.morning_start_time || '06:00').slice(0,5)}–{(wageSettings?.morning_end_time || '17:00').slice(0,5)}.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          )}
                          {visibleColumns.night_hours && (
                          <TableCell className="hidden lg:table-cell">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-fluid-xs">
                                    <div className="flex items-center gap-2 min-w-[120px]">
                                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, (disp.nightHours / Math.max(0.001, (disp.morningHours + disp.nightHours))) * 100)}%` }} />
                                      </div>
                                      <span className="font-medium">{disp.nightHours.toFixed(2)}h</span>
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Calculated in {timezone}. Night window {(wageSettings?.night_start_time || '17:00').slice(0,5)}–{(wageSettings?.night_end_time || '06:00').slice(0,5)}.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          )}
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-bold text-accent">
                                {disp.amount.toFixed(2)} LE
                              </div>
                              <div className="text-fluid-xs text-muted-foreground">
                                {disp.isSplit ? 'Split Rate' : 'Flat Rate'}
                              </div>
                            </div>
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleEdit(entry)}
                                className="hover:bg-primary hover:text-primary-foreground transition-colors"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Pagination - Always show pagination for consistency */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-4">
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-500">
            {t('showing') || 'Showing'} {filteredData.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} {t('entries') || 'entries'}
            {selectedRows.length > 0 && ` (${selectedRows.length} ${t('selected') || 'selected'})`}
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm text-gray-500">Show</span>
            <Select value={itemsPerPage.toString()} onValueChange={(value) => handleItemsPerPageChange(parseInt(value, 10))}>
              <SelectTrigger className="w-[70px] h-8">
                <SelectValue placeholder="10" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-500">per page</span>
          </div>
        </div>
        
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-gray-100'}
              />
            </PaginationItem>
            
            {Array.from({ length: Math.min(5, Math.max(1, totalPages)) }, (_, i) => {
              let pageNumber;
              if (totalPages <= 5) {
                pageNumber = i + 1;
              } else if (currentPage <= 3) {
                pageNumber = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + i;
              } else {
                pageNumber = currentPage - 2 + i;
              }
              
              return (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    onClick={() => handlePageChange(pageNumber)}
                    isActive={currentPage === pageNumber}
                    className="cursor-pointer"
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                className={currentPage === totalPages || totalPages === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-gray-100'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      <TimesheetEditDialog
        entry={editingEntry}
        isOpen={showEditDialog}
        onClose={handleEditClose}
        onUpdate={onDataChange}
        employees={employees}
        wageSettings={wageSettings}
      />
    </div>
  );
};

export default TimesheetTable;

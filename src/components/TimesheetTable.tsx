
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { useTimesheetTable } from '@/hooks/useTimesheetTable';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { Edit, List, BarChart3 } from 'lucide-react';
import { formatTimeToAMPM } from '@/utils/timeFormatter';
import TimesheetTableFilters from './TimesheetTableFilters';
import TimesheetTableActions from './TimesheetTableActions';
import TimesheetMobileCard from './TimesheetMobileCard';
import TimesheetSummary from './TimesheetSummary';
import TimesheetEditDialog from './TimesheetEditDialog';
import AggregatedTimesheetView from './AggregatedTimesheetView';

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
  selectedEmployee?: string;
}

const ITEMS_PER_PAGE = 20;

const TimesheetTable: React.FC<TimesheetTableProps> = ({ 
  data, 
  selectedRows, 
  onSelectionChange, 
  onDataChange,
  dateRange,
  selectedEmployee 
}) => {
  const { user } = useAuth();
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'detailed' | 'aggregated'>('detailed');
  const isAdmin = user?.role === 'admin';
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
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
    filteredData,
    handleSelectAll,
    handleSelectRow,
    handleDeleteSelected,
    deleteMutation
  } = useTimesheetTable(data, selectedRows, onSelectionChange, onDataChange, dateRange, selectedEmployee);

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset to first page when data changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filteredData.length]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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

  // Format total hours with ability to clear/delete
  const formatTotalHours = (hours: number | null | undefined) => {
    if (hours === null || hours === undefined || hours === 0) {
      return '0.00';
    }
    return hours.toFixed(2);
  };

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
                  {t('noTimesheetData') || 'No timesheet data available'}
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
              <Table>
                <TableHeader className="table-header">
                  <TableRow>
                    <TableHead className="w-12 sticky left-0 bg-background/95 backdrop-blur">
                      <Checkbox
                        checked={isAllPageSelected}
                        onCheckedChange={handleSelectAllPage}
                      />
                    </TableHead>
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
                    <TableHead className="min-w-[120px]">{t('clockInDate') || 'Clock In Date'}</TableHead>
                    <TableHead className="min-w-[100px]">{t('clockInTime') || 'Clock In Time'}</TableHead>
                    <TableHead className="min-w-[120px]">{t('clockOutDate') || 'Clock Out Date'}</TableHead>
                    <TableHead className="min-w-[100px]">{t('clockOutTime') || 'Clock Out Time'}</TableHead>
                    <TableHead className="min-w-[100px]">{t('totalHours') || 'Total Hours'}</TableHead>
                    <TableHead className="min-w-[110px] hidden lg:table-cell">{t('morningHours') || 'Morning Hours'}</TableHead>
                    <TableHead className="min-w-[100px] hidden lg:table-cell">{t('nightHours') || 'Night Hours'}</TableHead>
                    <TableHead className="min-w-[120px]">{t('totalAmount') || 'Total Amount'}</TableHead>
                    {isAdmin && <TableHead className="min-w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                 <TableBody>
                   {paginatedData.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={isAdmin ? 11 : 10} className="text-center py-12">
                         <div className="text-muted-foreground text-lg mb-2">No timesheet entries found</div>
                         <div className="text-muted-foreground/70 text-sm">
                           Try adjusting your filters or date range
                         </div>
                       </TableCell>
                     </TableRow>
                  ) : (
                    paginatedData.map((entry) => (
                      <TableRow key={entry.id} className="table-row">
                        <TableCell className="sticky left-0 bg-background/95 backdrop-blur">
                          <Checkbox
                            checked={selectedRows.includes(entry.id)}
                            onCheckedChange={(checked) => handleSelectRow(entry.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell className="font-medium sticky left-12 bg-background/95 backdrop-blur min-w-0">
                          <div className="truncate pr-2">{entry.employee_name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-fluid-sm">{entry.clock_in_date}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-muted-foreground text-fluid-sm">{formatTimeToAMPM(entry.clock_in_time)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-fluid-sm">{entry.clock_out_date}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-muted-foreground text-fluid-sm">{formatTimeToAMPM(entry.clock_out_time)}</div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-bold text-primary">
                            {formatTotalHours(entry.total_hours)}h
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="text-fluid-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">M:</span>
                              <span className="font-medium">{entry.morning_hours?.toFixed(2) || '0.00'}h</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="text-fluid-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">N:</span>
                              <span className="font-medium">{entry.night_hours?.toFixed(2) || '0.00'}h</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-bold text-accent">
                              {(entry.total_card_amount_split || entry.total_card_amount_flat)?.toFixed(2) || '0.00'} LE
                            </div>
                            <div className="text-fluid-xs text-muted-foreground">
                              {entry.is_split_calculation ? 'Split Rate' : 'Flat Rate'}
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <div className="text-sm text-gray-500">
            {t('showing') || 'Showing'} {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredData.length)} of {filteredData.length} {t('entries') || 'entries'}
            {selectedRows.length > 0 && ` (${selectedRows.length} ${t('selected') || 'selected'})`}
          </div>
          
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-gray-100'}
                />
              </PaginationItem>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-gray-100'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <TimesheetEditDialog
        entry={editingEntry}
        isOpen={showEditDialog}
        onClose={handleEditClose}
        onUpdate={onDataChange}
      />
    </div>
  );
};

export default TimesheetTable;

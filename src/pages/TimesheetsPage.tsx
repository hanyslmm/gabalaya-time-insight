
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, Split, Trash2 } from 'lucide-react';
import TimesheetUpload from '@/components/TimesheetUpload';
import TimesheetTable from '@/components/TimesheetTable';
import TimesheetDateFilter from '@/components/TimesheetDateFilter';
import WageCalculator from '@/components/WageCalculator';
import TimesheetExport from '@/components/TimesheetExport';

interface DateRange {
  from: Date;
  to: Date;
}

const TimesheetsPage: React.FC = () => {
  const { t } = useTranslation();
  const [showUpload, setShowUpload] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ 
    from: new Date(), 
    to: new Date() 
  });
  const [payPeriodEndDay, setPayPeriodEndDay] = useState(28);

  const { data: timesheets, isLoading, refetch } = useQuery({
    queryKey: ['timesheets'],
    queryFn: async () => {
      // Fetch timesheet entries and employees in parallel
      const [timesheetResult, employeesResult] = await Promise.all([
        supabase
          .from('timesheet_entries')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('employees')
          .select('staff_id, full_name')
      ]);
      
      if (timesheetResult.error) throw timesheetResult.error;
      if (employeesResult.error) throw employeesResult.error;
      
      // Create employee mapping
      const employeeMap = new Map();
      (employeesResult.data || []).forEach(emp => {
        employeeMap.set(emp.staff_id, emp.full_name);
      });
      
      // Map employee IDs to names in timesheet data
      const mappedData = (timesheetResult.data || []).map(entry => ({
        ...entry,
        employee_name: employeeMap.get(entry.employee_name) || entry.employee_name
      }));
      
      return mappedData;
    }
  });

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('timesheets')}</h1>
          <p className="mt-2 text-sm text-gray-600">Manage timesheet data and wage calculations</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
          <Button 
            onClick={() => setShowUpload(true)} 
            className="flex items-center justify-center space-x-2 w-full sm:w-auto"
          >
            <Upload className="h-4 w-4" />
            <span>{t('uploadTimesheet')}</span>
          </Button>
          <div className="w-full sm:w-auto">
            <TimesheetExport selectedRows={selectedRows} />
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <TimesheetDateFilter
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        payPeriodEndDay={payPeriodEndDay}
        onPayPeriodEndDayChange={setPayPeriodEndDay}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <Card className="lg:col-span-4 xl:col-span-3">
          <CardHeader>
            <CardTitle>Timesheet Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <TimesheetTable 
                data={timesheets || []} 
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                onDataChange={refetch}
                dateRange={dateRange}
              />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 xl:col-span-1">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <WageCalculator 
              selectedRows={selectedRows}
              onCalculationComplete={refetch}
            />
            
            <Button 
              variant="destructive" 
              size="sm" 
              className="w-full flex items-center space-x-2"
              disabled={selectedRows.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              <span>{t('deleteSelected')}</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {showUpload && (
        <TimesheetUpload
          onClose={() => setShowUpload(false)}
          onUploadComplete={refetch}
        />
      )}
    </div>
  );
};

export default TimesheetsPage;


import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, DollarSign, Users, TrendingUp } from 'lucide-react';
import { useCompanyTimezone } from '@/hooks/useCompanyTimezone';

interface TimesheetEntry {
  id: string;
  employee_name: string;
  total_hours: number;
  total_card_amount_flat: number;
  total_card_amount_split?: number;
  is_split_calculation: boolean;
}

interface TimesheetSummaryProps {
  data: TimesheetEntry[];
  dateRange?: {
    from: Date;
    to: Date;
  };
}

const TimesheetSummary: React.FC<TimesheetSummaryProps> = ({ data, dateRange }) => {
  const { timezone } = useCompanyTimezone();
  const summary = React.useMemo(() => {
    const totalHours = data.reduce((sum, entry) => sum + entry.total_hours, 0);
    const totalAmount = data.reduce((sum, entry) => sum + entry.total_card_amount_flat, 0);
    const totalSplitAmount = data.reduce((sum, entry) => sum + (entry.total_card_amount_split || 0), 0);
    const uniqueEmployees = new Set(data.map(entry => entry.employee_name)).size;
    const totalShifts = data.length;
    const averageHoursPerShift = totalShifts > 0 ? totalHours / totalShifts : 0;

    return {
      totalHours,
      totalAmount,
      totalSplitAmount,
      uniqueEmployees,
      totalShifts,
      averageHoursPerShift
    };
  }, [data]);

  const formatDateRange = () => {
    if (!dateRange) return "All Time";
    try {
      const fromStr = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dateRange.from);
      const toStr = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dateRange.to);
      return `${fromStr} - ${toStr}`;
    } catch {
      return `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`;
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Summary</span>
          <Badge variant="outline">{formatDateRange()}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">Total Hours</p>
              <p className="text-lg font-semibold">{summary.totalHours.toFixed(2)}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-lg font-semibold">LE {summary.totalAmount.toFixed(2)}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-purple-500" />
            <div>
              <p className="text-sm text-gray-600">Employees</p>
              <p className="text-lg font-semibold">{summary.uniqueEmployees}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-sm text-gray-600">Avg Hours/Shift</p>
              <p className="text-lg font-semibold">{summary.averageHoursPerShift.toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        {summary.totalSplitAmount > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              Split calculation total: <span className="font-semibold">LE {summary.totalSplitAmount.toFixed(2)}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TimesheetSummary;


import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon, Clock, Settings } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateRange {
  from: Date;
  to: Date;
}

interface TimesheetDateFilterProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  payPeriodEndDay: number;
  onPayPeriodEndDayChange: (day: number) => void;
}

const TimesheetDateFilter: React.FC<TimesheetDateFilterProps> = ({
  dateRange,
  onDateRangeChange,
  payPeriodEndDay,
  onPayPeriodEndDayChange
}) => {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);

  const getCurrentPayPeriod = (endDay: number = 28) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // If today is after the end day, we're in the next pay period
    if (today.getDate() > endDay) {
      const from = new Date(currentYear, currentMonth, endDay + 1);
      const to = new Date(currentYear, currentMonth + 1, endDay);
      return { from, to };
    } else {
      const from = new Date(currentYear, currentMonth - 1, endDay + 1);
      const to = new Date(currentYear, currentMonth, endDay);
      return { from, to };
    }
  };

  const setCurrentPayPeriod = () => {
    const payPeriod = getCurrentPayPeriod(payPeriodEndDay);
    onDateRangeChange(payPeriod);
  };

  const setPreviousPayPeriod = () => {
    const currentPayPeriod = getCurrentPayPeriod(payPeriodEndDay);
    const previousMonth = subMonths(currentPayPeriod.from, 1);
    const from = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), payPeriodEndDay + 1);
    const to = new Date(currentPayPeriod.from.getFullYear(), currentPayPeriod.from.getMonth(), payPeriodEndDay);
    onDateRangeChange({ from, to });
  };

  const setNextPayPeriod = () => {
    const currentPayPeriod = getCurrentPayPeriod(payPeriodEndDay);
    const nextMonth = addMonths(currentPayPeriod.to, 1);
    const from = new Date(currentPayPeriod.to.getFullYear(), currentPayPeriod.to.getMonth() + 1, payPeriodEndDay + 1);
    const to = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), payPeriodEndDay);
    onDateRangeChange({ from, to });
  };

  // Set current pay period on mount
  useEffect(() => {
    setCurrentPayPeriod();
  }, [payPeriodEndDay]);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Pay Period Filter</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Quick Period Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={setPreviousPayPeriod}>
              Previous Period
            </Button>
            <Button variant="default" size="sm" onClick={setCurrentPayPeriod}>
              Current Period
            </Button>
            <Button variant="outline" size="sm" onClick={setNextPayPeriod}>
              Next Period
            </Button>
          </div>

          {/* Date Range Display */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Label>From:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, "MMM dd, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => date && onDateRangeChange({ ...dateRange, from: date })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center space-x-2">
              <Label>To:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.to, "MMM dd, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => date && onDateRangeChange({ ...dateRange, to: date })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Pay Period Settings */}
          {showSettings && (
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2">
                <Label htmlFor="payPeriodEnd">Pay Period Ends on Day:</Label>
                <Input
                  id="payPeriodEnd"
                  type="number"
                  min="1"
                  max="31"
                  value={payPeriodEndDay}
                  onChange={(e) => onPayPeriodEndDayChange(parseInt(e.target.value) || 28)}
                  className="w-20"
                />
                <span className="text-sm text-gray-500">of each month</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TimesheetDateFilter;

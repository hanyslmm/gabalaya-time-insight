
import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Settings } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DateRange {
  from: Date;
  to: Date;
}

interface TimesheetDateFilterProps {
  dateRange: DateRange;
  onDateRangeChange: (dateRange: DateRange) => void;
  payPeriodEndDay: number;
  onPayPeriodEndDayChange: (day: number) => void;
  payPeriodMode?: 'fixed_day' | 'month_dynamic';
}

const TimesheetDateFilter: React.FC<TimesheetDateFilterProps> = ({
  dateRange,
  onDateRangeChange,
  payPeriodEndDay,
  onPayPeriodEndDayChange,
  payPeriodMode = 'fixed_day'
}) => {
  const calculatePayPeriod = (baseDate: Date, endDay: number, offsetMonths: number = 0) => {
    if (payPeriodMode === 'month_dynamic') {
      // Full calendar month mode
      const targetMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + offsetMonths, 1);
      return {
        from: startOfMonth(targetMonth),
        to: endOfMonth(targetMonth)
      };
    } else {
      // Fixed day mode (original logic)
      const today = new Date(baseDate);
      const currentDay = today.getDate();
      
      let endDate: Date;
      
      if (offsetMonths === 0) {
        if (currentDay <= endDay) {
          endDate = new Date(today.getFullYear(), today.getMonth(), endDay);
        } else {
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, endDay);
        }
      } else {
        const targetMonth = today.getMonth() + offsetMonths;
        if (currentDay <= endDay) {
          endDate = new Date(today.getFullYear(), targetMonth, endDay);
        } else {
          endDate = new Date(today.getFullYear(), targetMonth + 1, endDay);
        }
      }
      
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setDate(endDay + 1);
      
      return { from: startDate, to: endDate };
    }
  };

  const handlePeriodChange = (value: string) => {
    if (value === 'previous') {
      const previousPeriod = calculatePayPeriod(new Date(), payPeriodEndDay, -1);
      onDateRangeChange(previousPeriod);
    } else if (value === 'current') {
      const currentPeriod = calculatePayPeriod(new Date(), payPeriodEndDay, 0);
      onDateRangeChange(currentPeriod);
    } else if (value === 'today') {
      const today = new Date();
      onDateRangeChange({
        from: startOfDay(today),
        to: endOfDay(today)
      });
    }
  };

  const handleCustomDateChange = (field: 'from' | 'to', date: Date | undefined) => {
    if (date) {
      onDateRangeChange({
        ...dateRange,
        [field]: date
      });
    }
  };

  // Determine which period is currently selected
  const getCurrentPeriodType = () => {
    const currentPeriod = calculatePayPeriod(new Date(), payPeriodEndDay, 0);
    const previousPeriod = calculatePayPeriod(new Date(), payPeriodEndDay, -1);
    
    const isCurrent = dateRange.from.getTime() === currentPeriod.from.getTime() && 
                     dateRange.to.getTime() === currentPeriod.to.getTime();
    const isPrevious = dateRange.from.getTime() === previousPeriod.from.getTime() && 
                      dateRange.to.getTime() === previousPeriod.to.getTime();
    
    // Check if today is selected
    const today = new Date();
    const isToday = dateRange.from.getDate() === today.getDate() &&
                   dateRange.from.getMonth() === today.getMonth() &&
                   dateRange.from.getFullYear() === today.getFullYear() &&
                   dateRange.to.getDate() === today.getDate() &&
                   dateRange.to.getMonth() === today.getMonth() &&
                   dateRange.to.getFullYear() === today.getFullYear();
    
    if (isToday) return 'today';
    if (isCurrent) return 'current';
    if (isPrevious) return 'previous';
    return 'custom';
  };

  return (
    <div className="bg-card rounded-lg border p-6 mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Pay Period Filter
        </h3>
        
        {/* Removed inline settings - now configured in Settings page */}
      </div>

      <div className="space-y-2">
        <Label>Pay Period</Label>
        <Select value={getCurrentPeriodType()} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="current">Current Period</SelectItem>
            <SelectItem value="previous">Previous Period</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>From Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateRange.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? format(dateRange.from, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateRange.from}
                onSelect={(date) => handleCustomDateChange('from', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>To Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateRange.to && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.to ? format(dateRange.to, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateRange.to}
                onSelect={(date) => handleCustomDateChange('to', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          <strong>Selected Period:</strong> {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}
        </p>
      </div>
    </div>
  );
};

export default TimesheetDateFilter;

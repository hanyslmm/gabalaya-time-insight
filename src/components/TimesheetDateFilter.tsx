
import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Settings } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
    const today = new Date();
    
    if (value === 'previous') {
      const previousPeriod = calculatePayPeriod(new Date(), payPeriodEndDay, -1);
      onDateRangeChange(previousPeriod);
    } else if (value === 'current') {
      const currentPeriod = calculatePayPeriod(new Date(), payPeriodEndDay, 0);
      onDateRangeChange(currentPeriod);
    } else if (value === 'today') {
      onDateRangeChange({
        from: startOfDay(today),
        to: endOfDay(today)
      });
    } else if (value === 'thisWeek') {
      onDateRangeChange({
        from: startOfWeek(today),
        to: endOfWeek(today)
      });
    } else if (value === 'lastWeek') {
      const lastWeekStart = startOfWeek(subDays(today, 7));
      const lastWeekEnd = endOfWeek(subDays(today, 7));
      onDateRangeChange({ from: lastWeekStart, to: lastWeekEnd });
    } else if (value === 'thisMonth') {
      onDateRangeChange({
        from: startOfMonth(today),
        to: endOfMonth(today)
      });
    } else if (value === 'lastMonth') {
      const lastMonth = subMonths(today, 1);
      onDateRangeChange({
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth)
      });
    } else if (value === 'last7Days') {
      onDateRangeChange({
        from: subDays(today, 6),
        to: today
      });
    } else if (value === 'last30Days') {
      onDateRangeChange({
        from: subDays(today, 29),
        to: today
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

  // Quick date presets
  const quickPresets = [
    { key: 'today', label: t('today') || 'Today' },
    { key: 'thisWeek', label: t('thisWeek') || 'This Week' },
    { key: 'lastWeek', label: t('lastWeek') || 'Last Week' },
    { key: 'thisMonth', label: t('thisMonth') || 'This Month' },
    { key: 'lastMonth', label: t('lastMonth') || 'Last Month' },
    { key: 'last7Days', label: t('last7Days') || 'Last 7 Days' },
    { key: 'last30Days', label: t('last30Days') || 'Last 30 Days' },
    { key: 'current', label: t('currentPeriod') || 'Current Period' },
    { key: 'previous', label: t('previousPeriod') || 'Previous Period' }
  ];

  const getPresetKey = () => {
    const periodType = getCurrentPeriodType();
    if (periodType === 'custom') {
      // Check if it matches any quick preset
      const today = new Date();
      const isThisWeek = dateRange.from.getTime() === startOfWeek(today).getTime() && 
                        dateRange.to.getTime() === endOfWeek(today).getTime();
      const isLastWeek = dateRange.from.getTime() === startOfWeek(subDays(today, 7)).getTime() && 
                        dateRange.to.getTime() === endOfWeek(subDays(today, 7)).getTime();
      const isThisMonth = dateRange.from.getTime() === startOfMonth(today).getTime() && 
                         dateRange.to.getTime() === endOfMonth(today).getTime();
      const isLastMonth = dateRange.from.getTime() === startOfMonth(subMonths(today, 1)).getTime() && 
                         dateRange.to.getTime() === endOfMonth(subMonths(today, 1)).getTime();
      const isLast7Days = dateRange.from.getTime() === subDays(today, 6).getTime() && 
                          dateRange.to.getTime() === today.getTime();
      const isLast30Days = dateRange.from.getTime() === subDays(today, 29).getTime() && 
                           dateRange.to.getTime() === today.getTime();
      
      if (isThisWeek) return 'thisWeek';
      if (isLastWeek) return 'lastWeek';
      if (isThisMonth) return 'thisMonth';
      if (isLastMonth) return 'lastMonth';
      if (isLast7Days) return 'last7Days';
      if (isLast30Days) return 'last30Days';
    }
    return periodType;
  };

  return (
    <div className="bg-gradient-to-br from-card to-card/50 rounded-xl border-2 border-border/50 shadow-lg p-6 mb-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          <CalendarIcon className="h-5 w-5 text-primary" />
          {t('dateRange') || 'Date Range'}
        </h3>
      </div>

      {/* Quick Date Presets */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">{t('quickDatePresets') || 'Quick Date Presets'}</Label>
        <div className="flex flex-wrap gap-2">
          {quickPresets.map(preset => {
            const isActive = getPresetKey() === preset.key;
            return (
              <Button
                key={preset.key}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePeriodChange(preset.key)}
                className={cn(
                  "text-xs font-medium transition-all duration-200",
                  isActive && "shadow-md scale-105"
                )}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">{t('customRange') || 'Custom Range'}</Label>
        <Select value={getCurrentPeriodType()} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-full h-10">
            <SelectValue placeholder={t('selectPeriod') || 'Select period'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t('today') || 'Today'}</SelectItem>
            <SelectItem value="current">{t('currentPeriod') || 'Current Period'}</SelectItem>
            <SelectItem value="previous">{t('previousPeriod') || 'Previous Period'}</SelectItem>
            <SelectItem value="custom">{t('customRange') || 'Custom Range'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('fromDate') || 'From Date'}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-10 border-2 hover:border-primary/50 transition-colors",
                  !dateRange.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? format(dateRange.from, "PPP") : t('pickDate') || "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange.from}
                onSelect={(date) => handleCustomDateChange('from', date)}
                weekStartsOn={6}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('toDate') || 'To Date'}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-10 border-2 hover:border-primary/50 transition-colors",
                  !dateRange.to && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.to ? format(dateRange.to, "PPP") : t('pickDate') || "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange.to}
                onSelect={(date) => handleCustomDateChange('to', date)}
                weekStartsOn={6}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="pt-3 border-t border-border/50">
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('selectedPeriod') || 'Selected Period'}
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1} {t('days') || 'days'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimesheetDateFilter;

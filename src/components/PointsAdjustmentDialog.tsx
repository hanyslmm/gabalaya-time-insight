import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Trophy, Coins, AlertCircle, Sparkles, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOrganizationPointsBudget } from '@/hooks/useEmployeePoints';

interface PointsCatalogItem {
  id: string;
  label: string;
  points: number;
  category: 'reward' | 'penalty';
  description?: string;
}

interface TimesheetEntry {
  id: string;
  clock_in_date: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_hours: number | null;
}

interface PointsAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  timesheetEntryId?: string; // Optional: link points to specific timesheet entry
}

const PointsAdjustmentDialog: React.FC<PointsAdjustmentDialogProps> = ({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  timesheetEntryId: initialTimesheetEntryId
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

  const [selectedCatalogItem, setSelectedCatalogItem] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [occurrenceDate, setOccurrenceDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
  const [useCustomReason, setUseCustomReason] = useState(false);
  const [customPoints, setCustomPoints] = useState('');
  const [timesheetEntryId, setTimesheetEntryId] = useState<string | null>(initialTimesheetEntryId || null);
  const [showTimesheetSelector, setShowTimesheetSelector] = useState(false);

  // Fetch timesheet entry details if timesheetEntryId is provided
  const { data: timesheetEntry, error: timesheetEntryError } = useQuery({
    queryKey: ['timesheet-entry', timesheetEntryId],
    enabled: !!timesheetEntryId && open,
    queryFn: async () => {
      if (!timesheetEntryId) return null;
      try {
      const { data, error } = await supabase
          .from('timesheet_entries')
          .select('clock_in_date, clock_in_time, clock_out_time, total_hours')
          .eq('id', timesheetEntryId)
        .single();
      
        if (error) {
          console.error('Error fetching timesheet entry:', error);
          return null;
        }
        return data;
      } catch (err) {
        console.error('Error fetching timesheet entry:', err);
        return null;
      }
    },
    retry: false
  });

  // Set occurrence date from timesheet entry when it's selected or when dialog opens
  React.useEffect(() => {
    if (!open) return;
    
    if (timesheetEntry?.clock_in_date) {
      try {
        const date = new Date(timesheetEntry.clock_in_date);
        if (!isNaN(date.getTime())) {
          setOccurrenceDate(date);
        }
      } catch (err) {
        console.error('Error parsing timesheet entry date:', err);
      }
    } else if (!timesheetEntryId && !initialTimesheetEntryId) {
      setOccurrenceDate(new Date());
    }
  }, [open, timesheetEntry, timesheetEntryId, initialTimesheetEntryId]);

  // Reset timesheetEntryId when initialTimesheetEntryId changes
  React.useEffect(() => {
    if (open && initialTimesheetEntryId) {
      setTimesheetEntryId(initialTimesheetEntryId);
    } else if (open && !initialTimesheetEntryId) {
      setTimesheetEntryId(null);
    }
  }, [open, initialTimesheetEntryId]);

  const { data: budgetData } = useOrganizationPointsBudget();

  // Fetch employee's recent timesheet entries (for linking points to shifts)
  const { data: timesheetEntries = [], isLoading: isLoadingTimesheetEntries, error: timesheetEntriesError } = useQuery<TimesheetEntry[]>({
    queryKey: ['employee-timesheet-entries', employeeId],
    enabled: !!employeeId && open && showTimesheetSelector,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('timesheet_entries')
          .select('id, clock_in_date, clock_in_time, clock_out_time, total_hours')
          .eq('employee_id', employeeId)
          .eq('organization_id', activeOrganizationId)
          .order('clock_in_date', { ascending: false })
          .order('clock_in_time', { ascending: false })
          .limit(50);
        
        if (error) {
          console.error('Error fetching timesheet entries:', error);
          return [];
        }
        return (data || []) as TimesheetEntry[];
      } catch (err) {
        console.error('Error fetching timesheet entries:', err);
        return [];
      }
    },
    retry: false
  });

  // Fetch active catalog items
  const { data: catalogItems = [] } = useQuery<PointsCatalogItem[]>({
    queryKey: ['points-catalog', activeOrganizationId],
    enabled: !!activeOrganizationId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('points_catalog')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .eq('is_active', true)
        .order('category', { ascending: false })
        .order('points', { ascending: false });
      
      if (error) throw error;
      return (data || []) as PointsCatalogItem[];
    }
  });

  const selectedItem = catalogItems.find(item => item.id === selectedCatalogItem);
  const pointsToAward = useCustomReason && customPoints 
    ? parseInt(customPoints) 
    : selectedItem?.points || 0;

  const awardPointsMutation = useMutation({
    mutationFn: async () => {
      if (!occurrenceDate) {
        throw new Error('Please select an occurrence date');
      }

      const reason = useCustomReason ? customReason.trim() : (selectedItem?.label || '');
      if (!reason) {
        throw new Error('Please select a reason or enter a custom reason');
      }

      if (useCustomReason && !customPoints) {
        throw new Error('Please enter points value for custom reason');
      }

      const pointsValue = useCustomReason ? parseInt(customPoints) : (selectedItem?.points || 0);
      if (isNaN(pointsValue) || pointsValue === 0) {
        throw new Error('Points value must be a non-zero number');
      }

      // Check budget if awarding positive points
      if (pointsValue > 0 && budgetData && budgetData.budget < pointsValue) {
        throw new Error(`Insufficient budget. Available: ${budgetData.budget} points, Required: ${pointsValue} points`);
      }

      const { data, error } = await supabase.rpc('award_points_transaction' as any, {
        p_employee_id: employeeId,
        p_points: pointsValue,
        p_reason: reason,
        p_occurrence_date: format(occurrenceDate, 'yyyy-MM-dd'),
        p_catalog_item_id: useCustomReason ? null : selectedCatalogItem || null,
        p_notes: notes.trim() || null,
        p_timesheet_entry_id: timesheetEntryId || null
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        throw new Error(result.error || 'Failed to award points');
      }

      return result;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['employee-points', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['organization-points-budget', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['points-catalog', activeOrganizationId] });
      
      toast.success(
        pointsToAward > 0 ? t('pointsAwardedSuccessfully') : t('pointsDeductedSuccessfully'),
        {
          description: pointsToAward > 0 
            ? t('pointsAddedTo').replace('{amount}', Math.abs(pointsToAward).toString()).replace('{name}', employeeName)
            : t('pointsDeductedFrom').replace('{amount}', Math.abs(pointsToAward).toString()).replace('{name}', employeeName)
        }
      );

      // Reset form
      setSelectedCatalogItem('');
      setCustomReason('');
      setNotes('');
      setUseCustomReason(false);
      setCustomPoints('');
      try {
        if (timesheetEntry?.clock_in_date) {
          const date = new Date(timesheetEntry.clock_in_date);
          if (!isNaN(date.getTime())) {
            setOccurrenceDate(date);
          } else {
            setOccurrenceDate(new Date());
          }
        } else {
          setOccurrenceDate(new Date());
        }
      } catch (err) {
        console.error('Error setting occurrence date:', err);
        setOccurrenceDate(new Date());
      }
      setTimesheetEntryId(initialTimesheetEntryId || null);
      setShowTimesheetSelector(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(t('failedToAwardPoints'), {
        description: error.message || t('error')
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    awardPointsMutation.mutate();
  };

  const rewards = catalogItems.filter(item => item.category === 'reward');
  const penalties = catalogItems.filter(item => item.category === 'penalty');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            {t('awardPointsFor').replace('{name}', employeeName)}
          </DialogTitle>
          <DialogDescription>
            {t('awardOrDeductPoints')}
            {timesheetEntryId && timesheetEntry && (
              <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                <div className="font-medium">{t('linkedToShift')}</div>
                <div className="text-muted-foreground">
                  {timesheetEntry.clock_in_date && (
                    <>
                      {format(new Date(timesheetEntry.clock_in_date), 'MMM dd, yyyy')} • {timesheetEntry.clock_in_time?.substring(0, 5) || ''}
                      {timesheetEntry.clock_out_time && ` → ${timesheetEntry.clock_out_time.substring(0, 5)}`}
                      {timesheetEntry.total_hours && ` • ${timesheetEntry.total_hours.toFixed(1)}h`}
                    </>
                  )}
                </div>
              </div>
            )}
            {timesheetEntryId && timesheetEntryError && (
              <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                {t('error')}: {timesheetEntryError instanceof Error ? timesheetEntryError.message : 'Failed to load shift details'}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Budget Status */}
          {budgetData && (
            <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{t('availableBudget')}:</span>
                  </div>
                  <div className="text-right rtl:text-left">
                    <div className="text-lg font-bold text-primary">
                      {budgetData.budget} <span className="text-sm font-normal text-muted-foreground">{t('points')}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ≈ {budgetData.budget * budgetData.pointValue} {t('currencySymbol')}
                    </div>
                  </div>
                </div>
                {pointsToAward > 0 && budgetData.budget < pointsToAward && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{t('insufficientBudget').replace('{amount}', (pointsToAward - budgetData.budget).toString())}</span>
                  </div>
                )}
            </CardContent>
          </Card>
          )}

          {/* Link to Timesheet Entry (Optional) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('linkToTimesheetEntry')}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTimesheetSelector(!showTimesheetSelector)}
              >
                {showTimesheetSelector ? t('hide') : t('selectShift')}
              </Button>
            </div>
            {showTimesheetSelector && (
              <>
                {isLoadingTimesheetEntries ? (
                  <div className="text-sm text-muted-foreground p-2">{t('loading')}</div>
                ) : timesheetEntriesError ? (
                  <div className="text-sm text-destructive p-2">
                    {t('error')}: {timesheetEntriesError instanceof Error ? timesheetEntriesError.message : 'Failed to load shifts'}
                  </div>
                ) : (
                  <Select
                    value={timesheetEntryId || 'none'}
                    onValueChange={(value) => {
                      try {
                        const newId = value === 'none' ? null : value;
                        setTimesheetEntryId(newId);
                        
                        // If a timesheet entry is selected, find it in the list and set the date
                        if (newId && timesheetEntries.length > 0) {
                          const selectedEntry = timesheetEntries.find(e => e.id === newId);
                          if (selectedEntry?.clock_in_date) {
                            try {
                              const date = new Date(selectedEntry.clock_in_date);
                              if (!isNaN(date.getTime())) {
                                setOccurrenceDate(date);
                              }
                            } catch (err) {
                              console.error('Error parsing selected entry date:', err);
                            }
                          }
                        } else if (!newId) {
                          // Reset to today if "None" is selected
                          setOccurrenceDate(new Date());
                        }
                      } catch (err) {
                        console.error('Error handling timesheet selection:', err);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectAShift')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('noneGeneralPoints')}</SelectItem>
                      {timesheetEntries.map((entry) => {
                        try {
                          return (
                            <SelectItem key={entry.id} value={entry.id}>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                <span>
                                  {entry.clock_in_date ? format(new Date(entry.clock_in_date), 'MMM dd, yyyy') : 'Invalid date'} -{' '}
                                  {entry.clock_in_time?.substring(0, 5) || ''}
                                  {entry.clock_out_time && ` to ${entry.clock_out_time.substring(0, 5)}`}
                                  {entry.total_hours && ` (${entry.total_hours.toFixed(1)}h)`}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        } catch (err) {
                          console.error('Error rendering timesheet entry:', err, entry);
                          return (
                            <SelectItem key={entry.id} value={entry.id}>
                              {entry.clock_in_date || 'Invalid date'}
                            </SelectItem>
                          );
                        }
                      })}
                    </SelectContent>
                  </Select>
                )}
              </>
            )}
            {timesheetEntryId && (
              <p className="text-xs text-muted-foreground">
                {t('pointsWillBeLinked')}
              </p>
            )}
          </div>

          {/* Occurrence Date */}
          <div className="space-y-2">
            <Label>{t('occurrenceDate')} *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left rtl:text-right font-normal",
                    !occurrenceDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 rtl:mr-0 rtl:ml-2 h-4 w-4" />
                  {occurrenceDate ? format(occurrenceDate, "PPP") : t('pickADate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={occurrenceDate}
                  onSelect={(date) => date && setOccurrenceDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Custom Reason Toggle */}
          <div className="flex items-center justify-between">
            <Label>{t('useCustomReason')}</Label>
            <Button
              type="button"
              variant={useCustomReason ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setUseCustomReason(!useCustomReason);
                  setSelectedCatalogItem('');
                  setCustomReason('');
                  setCustomPoints('');
              }}
            >
              {useCustomReason ? t('usingCustom') : t('useCatalog')}
            </Button>
          </div>

          {useCustomReason ? (
            /* Custom Reason Form */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-reason">{t('reason')} *</Label>
                <Input
                  id="custom-reason"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder={t('customReason')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-points">{t('points')} *</Label>
                <Input
                  id="custom-points"
                  type="number"
                  value={customPoints}
                  onChange={(e) => setCustomPoints(e.target.value)}
                  placeholder={t('enterPointsValue')}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('positiveForRewards')}
                </p>
              </div>
            </div>
          ) : (
            /* Catalog Selection */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('selectFromCatalog')}</Label>
                {catalogItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-muted/50">
                    {t('noActiveCatalogItems')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Rewards Section */}
              {rewards.length > 0 && (
                <div>
                        <Label className="text-sm font-semibold mb-2 block flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-green-600" />
                          {t('rewards')}
                        </Label>
                        <div className="grid gap-2">
                    {rewards.map((item) => (
                      <Card
                        key={item.id}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                                selectedCatalogItem === item.id && "ring-2 ring-primary"
                        )}
                        onClick={() => setSelectedCatalogItem(item.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium">{item.label}</div>
                                    {item.description && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {item.description}
                                      </div>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 ml-2 rtl:ml-0 rtl:mr-2">
                                  +{item.points}
                                </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

                    {/* Penalties Section */}
              {penalties.length > 0 && (
                <div>
                        <Label className="text-sm font-semibold mb-2 block flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          {t('penalties')}
                        </Label>
                        <div className="grid gap-2">
                    {penalties.map((item) => (
                      <Card
                        key={item.id}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                                selectedCatalogItem === item.id && "ring-2 ring-primary"
                        )}
                        onClick={() => setSelectedCatalogItem(item.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium">{item.label}</div>
                                    {item.description && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {item.description}
                                      </div>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 ml-2">
                                  {item.points}
                                </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
                </div>
              )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">{t('additionalNotes')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('addAnyAdditionalContext')}
              rows={3}
            />
          </div>

          {/* Points Summary */}
          {pointsToAward !== 0 && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{pointsToAward > 0 ? t('pointsToAward') : t('pointsToDeduct')}:</span>
                  <span className={cn(
                    "text-2xl font-bold",
                    pointsToAward > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {pointsToAward > 0 ? '+' : ''}{pointsToAward}
                  </span>
                </div>
                {pointsToAward > 0 && budgetData && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t('remainingBudgetAfter').replace('{amount}', (budgetData.budget - pointsToAward).toString())} {t('points')}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={awardPointsMutation.isPending || !occurrenceDate || (!useCustomReason && !selectedCatalogItem) || (useCustomReason && (!customReason || !customPoints))}
            >
              {awardPointsMutation.isPending ? t('processing') : `${t('awardPoints')} ${pointsToAward > 0 ? '+' : ''}${pointsToAward} ${t('points')}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PointsAdjustmentDialog;

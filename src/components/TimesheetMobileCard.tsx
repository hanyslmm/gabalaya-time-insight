
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CalendarDays, DollarSign, User, Edit } from 'lucide-react';
import { formatTimeToAMPM } from '@/utils/timeFormatter';
import { useAuth } from '@/hooks/useAuth';
import TimesheetEditDialog from './TimesheetEditDialog';

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
  is_split_calculation: boolean;
}

interface TimesheetMobileCardProps {
  entry: TimesheetEntry;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit?: (entry: TimesheetEntry) => void;
}

const TimesheetMobileCard: React.FC<TimesheetMobileCardProps> = ({
  entry,
  isSelected,
  onSelect,
  onEdit
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [showEditDialog, setShowEditDialog] = React.useState(false);

  return (
    <Card className={`mb-2 transition-all duration-300 hover:shadow-elegant card-interactive ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/20'} rounded-lg border-border/30`}>
      <CardContent className="p-3 sm:p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="mt-0.5 flex-shrink-0"
            />
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <h3 className="font-semibold text-sm text-card-foreground break-words-enhanced line-clamp-1">
                {entry.employee_name}
              </h3>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <Badge 
              variant={entry.is_split_calculation ? "default" : "secondary"} 
              className="text-xs whitespace-nowrap"
            >
              {entry.is_split_calculation ? "Split" : "Flat"}
            </Badge>
            {isAdmin && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowEditDialog(true)}
                className="h-8 w-8 p-0 hover:bg-primary/10 hover:border-primary/50"
              >
                <Edit className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="space-y-3">
          {/* Time Info */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg border border-border/20">
            <div className="flex items-center space-x-2 min-w-0">
              <CalendarDays className="h-3 w-3 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-primary font-medium">Clock In</p>
                <p className="text-sm font-semibold line-clamp-1">{entry.clock_in_date}</p>
                <p className="text-xs text-muted-foreground">{formatTimeToAMPM(entry.clock_in_time)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 min-w-0">
              <CalendarDays className="h-3 w-3 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-primary font-medium">Clock Out</p>
                <p className="text-sm font-semibold line-clamp-1">{entry.clock_out_date}</p>
                <p className="text-xs text-muted-foreground">{formatTimeToAMPM(entry.clock_out_time)}</p>
              </div>
            </div>
          </div>

          {/* Hours & Payment */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center space-x-2 p-2 bg-success/5 rounded-lg border border-success/20 min-w-0">
              <Clock className="h-3 w-3 text-success flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-success font-medium">Total Hours</p>
                <p className="text-sm font-bold text-success line-clamp-1">{entry.total_hours.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 p-2 bg-accent/5 rounded-lg border border-accent/20 min-w-0">
              <DollarSign className="h-3 w-3 text-accent flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-accent font-medium">Amount</p>
                <p className="text-sm font-bold text-accent line-clamp-1">
                  LE {(entry.total_card_amount_split || entry.total_card_amount_flat).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Split Hours Details */}
          {(entry.morning_hours || entry.night_hours) && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 rounded-lg border border-border/30">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">🌅 Morning</p>
                <p className="text-fluid-sm font-semibold text-secondary line-clamp-1">{entry.morning_hours?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">🌙 Night</p>
                <p className="text-fluid-sm font-semibold text-secondary line-clamp-1">{entry.night_hours?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          )}

          {/* Split Amount */}
          {entry.total_card_amount_split && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-600 font-medium mb-1">Split Calculation Amount</p>
              <p className="text-lg font-bold text-blue-700">
                LE {entry.total_card_amount_split.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
      
      {showEditDialog && (
        <TimesheetEditDialog
          entry={entry}
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onUpdate={() => {
            setShowEditDialog(false);
            if (onEdit) onEdit(entry);
          }}
        />
      )}
    </Card>
  );
};

export default TimesheetMobileCard;

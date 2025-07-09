
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
    <Card className={`mb-4 transition-all duration-200 hover:shadow-md ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="mt-1"
            />
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-500" />
              <h3 className="font-semibold text-lg text-gray-900">{entry.employee_name}</h3>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={entry.is_split_calculation ? "default" : "secondary"} className="text-xs">
              {entry.is_split_calculation ? "Split Rate" : "Flat Rate"}
            </Badge>
            {isAdmin && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowEditDialog(true)}
                className="h-6 w-6 p-0"
              >
                <Edit className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="space-y-3">
          {/* Time Info */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
            <div className="flex items-center space-x-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Clock In</p>
                <p className="text-sm font-semibold">{entry.clock_in_date}</p>
                <p className="text-xs text-gray-600">{formatTimeToAMPM(entry.clock_in_time)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-600 font-medium">Clock Out</p>
              <p className="text-sm font-semibold">{entry.clock_out_date}</p>
              <p className="text-xs text-gray-600">{formatTimeToAMPM(entry.clock_out_time)}</p>
            </div>
          </div>

          {/* Hours & Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg border border-green-100">
              <Clock className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs text-green-600 font-medium">Total Hours</p>
                <p className="text-lg font-bold text-green-700">{entry.total_hours.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-xs text-emerald-600 font-medium">Amount</p>
                <p className="text-lg font-bold text-emerald-700">
                  LE {(entry.total_card_amount_split || entry.total_card_amount_flat).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Split Hours Details */}
          {(entry.morning_hours || entry.night_hours) && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border">
              <div>
                <p className="text-xs text-gray-600 font-medium">🌅 Morning Hours</p>
                <p className="text-sm font-semibold">{entry.morning_hours?.toFixed(2) || '0.00'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">🌙 Night Hours</p>
                <p className="text-sm font-semibold">{entry.night_hours?.toFixed(2) || '0.00'}</p>
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


import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

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
}

const TimesheetMobileCard: React.FC<TimesheetMobileCardProps> = ({
  entry,
  isSelected,
  onSelect
}) => {
  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
            />
            <h3 className="font-semibold text-lg">{entry.employee_name}</h3>
          </div>
          <Badge variant={entry.is_split_calculation ? "default" : "secondary"}>
            {entry.is_split_calculation ? "Split" : "Flat"}
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="font-medium text-gray-600">Clock In:</span>
            <p>{entry.clock_in_date} {entry.clock_in_time}</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Clock Out:</span>
            <p>{entry.clock_out_date} {entry.clock_out_time}</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Total Hours:</span>
            <p className="font-semibold">{entry.total_hours.toFixed(2)}</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Amount:</span>
            <p className="font-semibold text-green-600">
              LE {entry.total_card_amount_flat.toFixed(2)}
            </p>
          </div>
          {(entry.morning_hours || entry.night_hours) && (
            <>
              <div>
                <span className="font-medium text-gray-600">Morning:</span>
                <p>{entry.morning_hours?.toFixed(2) || '0.00'} hrs</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Night:</span>
                <p>{entry.night_hours?.toFixed(2) || '0.00'} hrs</p>
              </div>
            </>
          )}
          {entry.total_card_amount_split && (
            <div className="col-span-2">
              <span className="font-medium text-gray-600">Split Amount:</span>
              <p className="font-semibold text-blue-600">
                LE {entry.total_card_amount_split.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TimesheetMobileCard;

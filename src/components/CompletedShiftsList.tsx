import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmployeeStatusCard } from './EmployeeStatusCard';

interface EmployeeStatus {
  employee_name: string;
  clock_in_time: string;
  clock_in_date: string;
  clock_in_location?: string;
  clock_out_time?: string;
  clock_out_date?: string;
  clock_out_location?: string;
  duration_minutes?: number;
  is_active: boolean;
}

interface CompletedShiftsListProps {
  completedShifts: EmployeeStatus[];
  onLocationClick: (location: string) => void;
  formatDuration: (minutes: number) => string;
}

export const CompletedShiftsList: React.FC<CompletedShiftsListProps> = ({
  completedShifts,
  onLocationClick,
  formatDuration
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Completed Shifts Today ({completedShifts.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {completedShifts.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No completed shifts today</p>
        ) : (
          <div className="space-y-4">
            {completedShifts.map((status, index) => (
              <EmployeeStatusCard
                key={index}
                status={status}
                onLocationClick={onLocationClick}
                formatDuration={formatDuration}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
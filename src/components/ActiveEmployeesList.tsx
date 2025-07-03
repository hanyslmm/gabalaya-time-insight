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

interface ActiveEmployeesListProps {
  activeEmployees: EmployeeStatus[];
  onLocationClick: (location: string) => void;
  formatDuration: (minutes: number) => string;
}

export const ActiveEmployeesList: React.FC<ActiveEmployeesListProps> = ({
  activeEmployees,
  onLocationClick,
  formatDuration
}) => {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span>Currently Active ({activeEmployees.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeEmployees.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No employees currently clocked in</p>
        ) : (
          <div className="space-y-4">
            {activeEmployees.map((status, index) => (
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
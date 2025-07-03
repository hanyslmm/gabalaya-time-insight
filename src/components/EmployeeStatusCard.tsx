
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, User } from 'lucide-react';

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

interface EmployeeStatusCardProps {
  status: EmployeeStatus;
  onLocationClick: (location: string) => void;
  formatDuration: (minutes: number) => string;
}

export const EmployeeStatusCard: React.FC<EmployeeStatusCardProps> = ({
  status,
  onLocationClick,
  formatDuration
}) => {
  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-500" />
              <h3 className="font-semibold text-lg">{status.employee_name}</h3>
            </div>
          </div>
          <Badge variant={status.is_active ? "default" : "secondary"}>
            {status.is_active ? 'Active' : 'Completed'}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-green-600" />
              <div>
                <span className="text-gray-600">Clock In:</span>
                <div className="font-medium">{status.clock_in_time}</div>
                <div className="text-xs text-gray-500">{status.clock_in_date}</div>
              </div>
            </div>
            
            {status.clock_in_location && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onLocationClick(status.clock_in_location!)}
                className="flex items-center space-x-1 h-8 px-2"
              >
                <MapPin className="h-3 w-3" />
                <span className="text-xs">View Location</span>
              </Button>
            )}
          </div>
          
          {!status.is_active && status.clock_out_time && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-red-600" />
                <div>
                  <span className="text-gray-600">Clock Out:</span>
                  <div className="font-medium">{status.clock_out_time}</div>
                  <div className="text-xs text-gray-500">{status.clock_out_date}</div>
                </div>
              </div>
              
              {status.clock_out_location && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLocationClick(status.clock_out_location!)}
                  className="flex items-center space-x-1 h-8 px-2"
                >
                  <MapPin className="h-3 w-3" />
                  <span className="text-xs">View Location</span>
                </Button>
              )}
            </div>
          )}
        </div>
        
        {status.duration_minutes && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {status.is_active ? 'Working for:' : 'Total time:'}
              </span>
              <span className="font-semibold text-blue-600">
                {formatDuration(status.duration_minutes)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

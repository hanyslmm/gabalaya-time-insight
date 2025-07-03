import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, ExternalLink } from 'lucide-react';

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
  const isActive = status.is_active;

  return (
    <div className={`flex items-center justify-between p-4 border rounded-lg ${
      isActive ? 'bg-green-50 dark:bg-green-950/20' : ''
    }`}>
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Avatar>
            <AvatarImage src="" alt={status.employee_name} />
            <AvatarFallback>
              {status.employee_name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          {isActive && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
          )}
        </div>
        <div>
          <h3 className="font-medium">{status.employee_name}</h3>
          <p className="text-sm text-muted-foreground">
            {isActive 
              ? `Clocked in at ${status.clock_in_time}`
              : `${status.clock_in_time} - ${status.clock_out_time}`
            }
          </p>
          <div className={`flex space-x-4 mt-1 ${isActive ? '' : 'flex'}`}>
            {status.clock_in_location && (
              <div className="flex items-center space-x-1">
                {isActive ? (
                  <>
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Location</span>
                    <button
                      onClick={() => onLocationClick(status.clock_in_location!)}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    >
                      <span>View</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onLocationClick(status.clock_in_location!)}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <MapPin className="h-3 w-3" />
                    <span>In</span>
                  </button>
                )}
              </div>
            )}
            {!isActive && status.clock_out_location && (
              <button
                onClick={() => onLocationClick(status.clock_out_location!)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <MapPin className="h-3 w-3" />
                <span>Out</span>
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-green-600" : ""}>
          {isActive ? 'Active' : 'Completed'}
        </Badge>
        <p className="text-sm font-medium mt-2">
          {status.duration_minutes ? formatDuration(status.duration_minutes) : '0h 0m'}
        </p>
      </div>
    </div>
  );
};
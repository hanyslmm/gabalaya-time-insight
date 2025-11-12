import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Clock, User, DollarSign } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCompanyTimezone } from '@/hooks/useCompanyTimezone';
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
}

interface AggregatedEmployee {
  employee_name: string;
  total_hours: number;
  total_amount: number;
  shift_count: number;
  entries: TimesheetEntry[];
}

interface AggregatedTimesheetViewProps {
  data: TimesheetEntry[];
  onDataChange: () => void;
}

const AggregatedTimesheetView: React.FC<AggregatedTimesheetViewProps> = ({ data, onDataChange }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const { formatDate, formatTimeAMPM } = useCompanyTimezone();

  // Aggregate data by employee
  const aggregatedData = React.useMemo(() => {
    const aggregated: Record<string, AggregatedEmployee> = {};
    
    data.forEach(entry => {
      if (!aggregated[entry.employee_name]) {
        aggregated[entry.employee_name] = {
          employee_name: entry.employee_name,
          total_hours: 0,
          total_amount: 0,
          shift_count: 0,
          entries: []
        };
      }
      
      aggregated[entry.employee_name].total_hours += entry.total_hours;
      aggregated[entry.employee_name].total_amount += (entry.total_card_amount_split || entry.total_card_amount_flat);
      aggregated[entry.employee_name].shift_count += 1;
      aggregated[entry.employee_name].entries.push(entry);
    });
    
    return Object.values(aggregated).sort((a, b) => b.total_hours - a.total_hours);
  }, [data]);

  const toggleEmployee = (employeeName: string) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(employeeName)) {
      newExpanded.delete(employeeName);
    } else {
      newExpanded.add(employeeName);
    }
    setExpandedEmployees(newExpanded);
  };

  const handleEdit = (entry: TimesheetEntry) => {
    setEditingEntry(entry);
  };

  const handleEditClose = () => {
    setEditingEntry(null);
  };

  const totalHours = aggregatedData.reduce((sum, emp) => sum + emp.total_hours, 0);
  const totalAmount = aggregatedData.reduce((sum, emp) => sum + emp.total_amount, 0);
  const totalShifts = aggregatedData.reduce((sum, emp) => sum + emp.shift_count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Employee Summary
        </CardTitle>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <Clock className="h-4 w-4 text-blue-600" />
            <div>
              <div className="text-sm text-gray-600">Total Hours</div>
              <div className="font-bold text-blue-600">{totalHours.toFixed(2)}h</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <DollarSign className="h-4 w-4 text-green-600" />
            <div>
              <div className="text-sm text-gray-600">Total Amount</div>
              <div className="font-bold text-green-600">LE {totalAmount.toFixed(2)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
            <User className="h-4 w-4 text-purple-600" />
            <div>
              <div className="text-sm text-gray-600">Total Shifts</div>
              <div className="font-bold text-purple-600">{totalShifts}</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {aggregatedData.map((employee) => (
            <Collapsible key={employee.employee_name}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full h-auto p-4 justify-start hover:bg-gray-50"
                  onClick={() => toggleEmployee(employee.employee_name)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      {expandedEmployees.has(employee.employee_name) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <div className="text-left">
                        <div className="font-semibold">{employee.employee_name}</div>
                        <div className="text-sm text-gray-500">{employee.shift_count} shifts</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-600">{employee.total_hours.toFixed(2)}h</div>
                      <div className="text-sm text-green-600">LE {employee.total_amount.toFixed(2)}</div>
                    </div>
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-6 mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Morning</TableHead>
                        <TableHead>Night</TableHead>
                        <TableHead>Amount</TableHead>
                        {isAdmin && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employee.entries.map((entry) => (
                        <TableRow key={entry.id} className="hover:bg-gray-50">
                          <TableCell>{formatDate(entry.clock_in_date)}</TableCell>
                          <TableCell>{formatTimeAMPM(entry.clock_in_date, entry.clock_in_time)}</TableCell>
                          <TableCell>{entry.clock_out_time ? formatTimeAMPM(entry.clock_out_date || entry.clock_in_date, entry.clock_out_time) : '—'}</TableCell>
                          <TableCell>{entry.total_hours.toFixed(2)}h</TableCell>
                          <TableCell>{entry.morning_hours?.toFixed(2) || '0.00'}h</TableCell>
                          <TableCell>{entry.night_hours?.toFixed(2) || '0.00'}h</TableCell>
                          <TableCell className="font-medium text-green-600 dark:text-green-400">LE {(entry.total_card_amount_split || entry.total_card_amount_flat).toFixed(2)}</TableCell>
                          {isAdmin && (
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(entry)}
                              >
                                Edit
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </CardContent>

      <TimesheetEditDialog
        entry={editingEntry}
        isOpen={!!editingEntry}
        onClose={handleEditClose}
        onUpdate={onDataChange}
      />
    </Card>
  );
};

export default AggregatedTimesheetView;
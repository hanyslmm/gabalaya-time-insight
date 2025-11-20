import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  full_name: string;
  staff_id?: string;
}

interface EmployeeMultiSelectProps {
  employees: Employee[];
  selectedEmployeeIds: string[];
  onSelectionChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const EmployeeMultiSelect: React.FC<EmployeeMultiSelectProps> = ({
  employees,
  selectedEmployeeIds,
  onSelectionChange,
  placeholder,
  className
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmployees = employees.filter(emp =>
    emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.staff_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedEmployees = employees.filter(emp => selectedEmployeeIds.includes(emp.id));

  const toggleEmployee = (employeeId: string) => {
    if (selectedEmployeeIds.includes(employeeId)) {
      onSelectionChange(selectedEmployeeIds.filter(id => id !== employeeId));
    } else {
      onSelectionChange([...selectedEmployeeIds, employeeId]);
    }
  };

  const selectAll = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length) {
      onSelectionChange([]);
    } else {
      const allIds = filteredEmployees.map(emp => emp.id);
      onSelectionChange(allIds);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("w-full justify-between", className)}
        >
          <div className="flex items-center gap-2 flex-1 overflow-hidden">
            {selectedEmployees.length === 0 ? (
              <span className="text-muted-foreground">
                {placeholder || t('selectEmployees') || 'Select employees'}
              </span>
            ) : (
              <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                {selectedEmployees.length <= 2 ? (
                  selectedEmployees.map(emp => (
                    <Badge key={emp.id} variant="secondary" className="mr-1">
                      {emp.full_name}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary">
                    {selectedEmployees.length} {t('selected') || 'selected'}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchEmployees') || 'Search employees...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center justify-between px-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              className="h-7 text-xs"
            >
              {selectedEmployeeIds.length === filteredEmployees.length
                ? t('deselectAll') || 'Deselect All'
                : t('selectAll') || 'Select All'}
            </Button>
            {selectedEmployeeIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-7 text-xs text-destructive"
              >
                {t('clear') || 'Clear'}
              </Button>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {filteredEmployees.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {t('noEmployeesFound') || 'No employees found'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                    onClick={() => toggleEmployee(employee.id)}
                  >
                    <Checkbox
                      checked={selectedEmployeeIds.includes(employee.id)}
                      onCheckedChange={() => toggleEmployee(employee.id)}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{employee.full_name}</div>
                      {employee.staff_id && (
                        <div className="text-xs text-muted-foreground">{employee.staff_id}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};




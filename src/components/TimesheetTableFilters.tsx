
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface TimesheetTableFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  columnFilters: Record<string, string>;
  onColumnFilterChange: (column: string, value: string) => void;
}

const TimesheetTableFilters: React.FC<TimesheetTableFiltersProps> = ({
  searchTerm,
  onSearchChange,
  columnFilters,
  onColumnFilterChange
}) => {
  const { t } = useTranslation();

  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        placeholder={t('searchTimesheet') || 'Search timesheet entries...'}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-10"
      />
    </div>
  );
};

export default TimesheetTableFilters;

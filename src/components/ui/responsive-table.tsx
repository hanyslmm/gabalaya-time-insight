
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({ children, className }) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className={`space-y-4 ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <div className={`rounded-md border overflow-x-auto ${className}`}>
      <Table>
        {children}
      </Table>
    </div>
  );
};

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };

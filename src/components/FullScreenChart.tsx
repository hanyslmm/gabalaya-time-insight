
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Maximize2 } from 'lucide-react';

interface FullScreenChartProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const FullScreenChart: React.FC<FullScreenChartProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full h-full max-w-7xl max-h-[90vh] overflow-hidden animate-fade-in">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <CardTitle className="flex items-center gap-2">
            <Maximize2 className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6 h-full overflow-auto">
          <div className="h-full min-h-[500px]">
            {children}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FullScreenChart;

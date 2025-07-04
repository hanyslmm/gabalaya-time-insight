
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';
import FullScreenChart from './FullScreenChart';

interface InteractiveChartProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

const InteractiveChart: React.FC<InteractiveChartProps> = ({ title, children, className = "" }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <>
      <div className={`relative group ${className}`}>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
          onClick={() => setIsFullScreen(true)}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <div className="cursor-pointer" onClick={() => setIsFullScreen(true)}>
          {children}
        </div>
      </div>
      
      <FullScreenChart
        isOpen={isFullScreen}
        onClose={() => setIsFullScreen(false)}
        title={title}
      >
        {children}
      </FullScreenChart>
    </>
  );
};

export default InteractiveChart;

import React from 'react';
import { cn } from '@/lib/utils';

interface MobilePageWrapperProps {
  children: React.ReactNode;
  className?: string;
  showMobileIndicator?: boolean;
}

const MobilePageWrapper: React.FC<MobilePageWrapperProps> = ({ 
  children, 
  className = '',
  showMobileIndicator = false 
}) => {
  return (
    <div className={cn(
      // Mobile-first: ultra-compact layout
      "w-full h-full",
      "p-1 sm:p-3 md:p-4 lg:p-6",
      "space-y-1 sm:space-y-2 md:space-y-4",
      // Mobile visual indicator (optional)
      showMobileIndicator && "border-l-2 border-l-green-500 sm:border-l-0",
      className
    )}>
      {children}
    </div>
  );
};

// Section wrapper for consistent spacing
export const MobileSection: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
  spacing?: 'tight' | 'normal' | 'loose';
}> = ({ children, className = '', spacing = 'normal' }) => {
  const spacingClasses = {
    tight: 'space-y-0.5 sm:space-y-1',
    normal: 'space-y-1 sm:space-y-2 md:space-y-3',
    loose: 'space-y-2 sm:space-y-3 md:space-y-4'
  };

  return (
    <div className={cn(spacingClasses[spacing], className)}>
      {children}
    </div>
  );
};

// Card wrapper with mobile-optimized padding
export const MobileCard: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={cn(
      "bg-card border rounded-md sm:rounded-lg shadow-sm",
      "p-1.5 sm:p-3 md:p-4 lg:p-6",
      className
    )}>
      {children}
    </div>
  );
};

// Header wrapper for consistent mobile headers
export const MobileHeader: React.FC<{ 
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, actions, className = '' }) => {
  return (
    <div className={cn(
      "flex flex-col sm:flex-row justify-between items-start sm:items-center",
      "gap-1 sm:gap-2 md:gap-4",
      "mb-2 sm:mb-3 md:mb-4",
      className
    )}>
      <div className="min-w-0 flex-1">
        <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-0.5 sm:gap-1 md:gap-2">
          {actions}
        </div>
      )}
    </div>
  );
};

export default MobilePageWrapper;
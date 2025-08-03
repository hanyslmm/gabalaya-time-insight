import React from 'react';
import { cn } from '@/lib/utils';

interface MobilePageWrapperProps {
  children: React.ReactNode;
  className?: string;
  showMobileIndicator?: boolean;
  fullHeight?: boolean;
  noPadding?: boolean;
}

const MobilePageWrapper: React.FC<MobilePageWrapperProps> = ({
  children,
  className = '',
  showMobileIndicator = false,
  fullHeight = false,
  noPadding = false
}) => {
  return (
    <div className={cn(
      // Core mobile-first container
      "w-full mobile-container",
      
      // Height management
      fullHeight ? "h-full min-h-screen" : "min-h-0",
      
      // Progressive padding system
      noPadding ? "p-0" : "mobile-tight",
      
      // Progressive spacing
      "mobile-spacing",
      
      // Mobile visual indicator (optional for debugging)
      showMobileIndicator && "border-l-2 border-l-green-500 sm:border-l-0",
      
      // Fade in animation
      "mobile-fade-in",
      
      className
    )}>
      {children}
    </div>
  );
};

// Section wrapper for consistent spacing within pages
export const MobileSection: React.FC<{
  children: React.ReactNode;
  className?: string;
  spacing?: 'tight' | 'normal' | 'loose';
  noPadding?: boolean;
}> = ({ children, className = '', spacing = 'normal', noPadding = false }) => {
  const spacingClasses = {
    tight: 'space-y-0.5 sm:space-y-1',
    normal: 'space-y-1 sm:space-y-2 md:space-y-3',
    loose: 'space-y-2 sm:space-y-3 md:space-y-4'
  };

  return (
    <section className={cn(
      spacingClasses[spacing], 
      !noPadding && "mobile-tight",
      className
    )}>
      {children}
    </section>
  );
};

// Card wrapper with mobile-optimized padding and animations
export const MobileCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: boolean;
}> = ({ children, className = '', hover = true, gradient = true }) => {
  return (
    <div className={cn(
      "mobile-card",
      gradient && "mobile-gradient-card",
      hover && "mobile-hover mobile-glow",
      "mobile-scale-in",
      className
    )}>
      {children}
    </div>
  );
};

// Header wrapper for consistent mobile headers across all pages
export const MobileHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  compact?: boolean;
}> = ({ title, subtitle, actions, className = '', compact = false }) => {
  return (
    <header className={cn(
      "flex flex-col sm:flex-row justify-between items-start sm:items-center",
      "mobile-flex",
      compact ? "mb-1 sm:mb-2" : "mb-2 sm:mb-3 md:mb-4",
      "mobile-gradient-header rounded-md p-1 sm:p-2",
      className
    )}>
      <div className="min-w-0 flex-1">
        <h1 className={cn(
          "font-bold text-foreground truncate",
          compact ? "mobile-heading" : "mobile-title"
        )}>
          {title}
        </h1>
        {subtitle && (
          <p className="mobile-text text-muted-foreground mt-0.5 mobile-hide-text">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap mobile-flex mt-1 sm:mt-0">
          {actions}
        </div>
      )}
    </header>
  );
};

// Grid wrapper with responsive columns
export const MobileGrid: React.FC<{
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
}> = ({ children, cols = 2, className = '' }) => {
  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
  };

  return (
    <div className={cn(
      "mobile-grid",
      colClasses[cols],
      className
    )}>
      {children}
    </div>
  );
};

// Button wrapper with mobile optimizations
export const MobileButton: React.FC<{
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'default' | 'lg';
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ 
  children, 
  className = '', 
  variant = 'default',
  size = 'default',
  icon,
  onClick,
  disabled = false
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "mobile-button mobile-press mobile-focus-ring",
        "inline-flex items-center justify-center rounded-md transition-colors",
        "disabled:opacity-50 disabled:pointer-events-none",
        
        // Variants
        variant === 'default' && "bg-primary text-primary-foreground mobile-gradient-primary",
        variant === 'outline' && "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        variant === 'ghost' && "hover:bg-accent hover:text-accent-foreground",
        variant === 'destructive' && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        
        className
      )}
    >
      {icon && <span className="mobile-button-icon mr-1">{icon}</span>}
      <span className="mobile-text font-medium">{children}</span>
    </button>
  );
};

// Input wrapper with mobile optimizations
export const MobileInput: React.FC<{
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'number';
  className?: string;
  disabled?: boolean;
}> = ({ 
  placeholder, 
  value, 
  onChange, 
  type = 'text', 
  className = '',
  disabled = false
}) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      className={cn(
        "mobile-input mobile-focus-ring",
        "flex w-full rounded-md border border-input bg-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "placeholder:text-muted-foreground",
        className
      )}
    />
  );
};

// Form wrapper with mobile spacing
export const MobileForm: React.FC<{
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  className?: string;
}> = ({ children, onSubmit, className = '' }) => {
  return (
    <form 
      onSubmit={onSubmit}
      className={cn("mobile-form", className)}
    >
      {children}
    </form>
  );
};

// Loading wrapper
export const MobileLoading: React.FC<{
  className?: string;
  text?: string;
}> = ({ className = '', text = 'Loading...' }) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center mobile-tight text-center",
      className
    )}>
      <div className="mobile-loading w-8 h-8 rounded-full mb-2" />
      <p className="mobile-text text-muted-foreground">{text}</p>
    </div>
  );
};

// Empty state wrapper
export const MobileEmpty: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}> = ({ title, description, action, icon, className = '' }) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center mobile-tight",
      className
    )}>
      {icon && (
        <div className="mb-2 opacity-50">
          {icon}
        </div>
      )}
      <h3 className="mobile-heading font-semibold mb-1">{title}</h3>
      {description && (
        <p className="mobile-text text-muted-foreground mb-2">{description}</p>
      )}
      {action && action}
    </div>
  );
};

// Stats card for dashboards
export const MobileStatsCard: React.FC<{
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}> = ({ title, value, change, changeType = 'neutral', icon, className = '' }) => {
  return (
    <MobileCard className={cn("relative overflow-hidden", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="mobile-text text-muted-foreground font-medium truncate">{title}</p>
          <p className="mobile-title font-bold text-foreground mt-0.5">{value}</p>
          {change && (
            <p className={cn(
              "mobile-text font-medium mt-0.5",
              changeType === 'positive' && "text-green-600 dark:text-green-400",
              changeType === 'negative' && "text-red-600 dark:text-red-400",
              changeType === 'neutral' && "text-muted-foreground"
            )}>
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div className="ml-2 p-1.5 rounded-md bg-primary/10">
            <div className="mobile-button-icon text-primary">
              {icon}
            </div>
          </div>
        )}
      </div>
    </MobileCard>
  );
};

export default MobilePageWrapper;
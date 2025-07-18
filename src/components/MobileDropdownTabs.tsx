import React, { useCallback, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface Tab {
  value: string;
  label: string;
  content: React.ReactNode;
  badge?: string | number;
}

interface MobileDropdownTabsProps {
  tabs: Tab[];
  defaultValue?: string;
  className?: string;
  onTabChange?: (value: string) => void;
  showClearButton?: boolean;
  onClear?: () => void;
}

const MobileDropdownTabs: React.FC<MobileDropdownTabsProps> = ({ 
  tabs, 
  defaultValue, 
  className = "",
  onTabChange,
  showClearButton = false,
  onClear
}) => {
  const [activeTab, setActiveTab] = React.useState(defaultValue || tabs[0]?.value);
  
  const activeTabContent = tabs.find(tab => tab.value === activeTab)?.content;
  const activeTabLabel = tabs.find(tab => tab.value === activeTab)?.label;
  const activeTabBadge = tabs.find(tab => tab.value === activeTab)?.badge;

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    onTabChange?.(value);
  }, [onTabChange]);

  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
    }
  }, [onClear]);

  // Update active tab when defaultValue changes
  useEffect(() => {
    if (defaultValue && defaultValue !== activeTab) {
      setActiveTab(defaultValue);
    }
  }, [defaultValue, activeTab]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Mobile-friendly dropdown selector */}
      <Card className="shadow-sm border-border/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Select value={activeTab} onValueChange={handleTabChange}>
                <SelectTrigger className="w-full h-12 text-base font-medium bg-background border-border/30 shadow-sm hover:bg-accent/5 transition-colors">
                  <div className="flex items-center gap-2">
                    <SelectValue placeholder="Select section" />
                    {activeTabBadge && (
                      <Badge variant="secondary" className="text-xs">
                        {activeTabBadge}
                      </Badge>
                    )}
                  </div>
                </SelectTrigger>
                <SelectContent className="w-full max-h-64 overflow-y-auto bg-card/95 backdrop-blur-xl border-border/30 shadow-lg">
                  {tabs.map((tab) => (
                    <SelectItem 
                      key={tab.value} 
                      value={tab.value}
                      className="h-12 text-base font-medium hover:bg-accent/10 focus:bg-accent/10 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{tab.label}</span>
                        {tab.badge && (
                          <Badge variant="outline" className="text-xs ml-2">
                            {tab.badge}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Clear button */}
            {showClearButton && (
              <button
                onClick={handleClear}
                className="flex items-center justify-center h-12 w-12 rounded-lg border border-border/30 hover:bg-accent/10 transition-colors"
                title="Clear filters"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          
          {/* Active tab indicator */}
          <div className="mt-3 pt-3 border-t border-border/20">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Active:</span>
              <Badge variant="outline" className="text-xs">
                {activeTabLabel}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Active tab content with enhanced styling */}
      <div className="min-h-[400px] transition-all duration-300 ease-in-out">
        <div className="animate-in fade-in-0 duration-300">
          {activeTabContent}
        </div>
      </div>
    </div>
  );
};

export default MobileDropdownTabs;
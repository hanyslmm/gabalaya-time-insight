import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Tab {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface MobileDropdownTabsProps {
  tabs: Tab[];
  defaultValue?: string;
  className?: string;
}

const MobileDropdownTabs: React.FC<MobileDropdownTabsProps> = ({ 
  tabs, 
  defaultValue, 
  className = "" 
}) => {
  const [activeTab, setActiveTab] = React.useState(defaultValue || tabs[0]?.value);
  
  const activeTabContent = tabs.find(tab => tab.value === activeTab)?.content;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Mobile-friendly dropdown selector */}
      <div className="w-full">
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger className="w-full h-12 text-base font-medium bg-card border-border/30 shadow-sm">
            <SelectValue placeholder="Select section" />
          </SelectTrigger>
          <SelectContent className="w-full max-h-64 overflow-y-auto bg-card/95 backdrop-blur-xl border-border/30">
            {tabs.map((tab) => (
              <SelectItem 
                key={tab.value} 
                value={tab.value}
                className="h-12 text-base font-medium hover:bg-accent/10 focus:bg-accent/10 cursor-pointer transition-colors"
              >
                {tab.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Active tab content */}
      <div className="min-h-[400px]">
        {activeTabContent}
      </div>
    </div>
  );
};

export default MobileDropdownTabs;
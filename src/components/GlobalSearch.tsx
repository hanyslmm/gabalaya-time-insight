import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Clock, 
  User, 
  FileText, 
  Calendar,
  TrendingUp,
  History,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'employee' | 'timesheet' | 'report' | 'action';
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  relevance: number;
}

interface GlobalSearchProps {
  className?: string;
  placeholder?: string;
  onClose?: () => void;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ 
  className,
  placeholder = "Search employees, timesheets, reports...",
  onClose 
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recent-searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Search query with debouncing
  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: ['global-search', query, activeOrganizationId],
    enabled: query.length >= 2 && !!activeOrganizationId,
    queryFn: async () => {
      if (!query.trim()) return [];
      
      const results: SearchResult[] = [];
      
      // Search employees
      let empQuery = supabase
        .from('employees')
        .select('*')
        .ilike('full_name', `%${query}%`)
        .limit(5);
      if (activeOrganizationId) {
        empQuery = empQuery.eq('organization_id', activeOrganizationId);
      }
      const { data: employees } = await empQuery;
      
      if (employees) {
        results.push(...employees.map(emp => ({
          id: `employee-${emp.id}`,
          title: emp.full_name,
          subtitle: `Staff ID: ${emp.staff_id} • ${emp.role}`,
          type: 'employee' as const,
          href: `/employees?search=${emp.id}`,
          icon: User,
          relevance: emp.full_name.toLowerCase().indexOf(query.toLowerCase()) === 0 ? 100 : 50
        })));
      }
      
      // Search timesheets
      let tsQuery = supabase
        .from('timesheet_entries')
        .select('*, employees(full_name)')
        .ilike('employee_name', `%${query}%`)
        .limit(5);
      if (activeOrganizationId) {
        tsQuery = tsQuery.eq('organization_id', activeOrganizationId);
      }
      const { data: timesheets } = await tsQuery;
      
      if (timesheets) {
        results.push(...timesheets.map(ts => ({
          id: `timesheet-${ts.id}`,
          title: `${ts.employee_name} - ${ts.clock_in_date}`,
          subtitle: `${ts.total_hours}h worked`,
          type: 'timesheet' as const,
          href: `/timesheets?search=${ts.employee_name}`,
          icon: Clock,
          relevance: 75
        })));
      }
      
      // Add quick actions if query matches
      const quickActions = [
        { query: 'clock', title: 'Clock In/Out', href: '/clock-in-out', icon: Clock },
        { query: 'dashboard', title: 'Dashboard', href: '/dashboard', icon: TrendingUp },
        { query: 'employees', title: 'Employees', href: '/employees', icon: User },
        { query: 'reports', title: 'Reports', href: '/reports', icon: FileText },
        { query: 'timesheet', title: 'My Timesheet', href: '/my-timesheet', icon: Calendar },
      ];
      
      quickActions.forEach(action => {
        if (action.query.includes(query.toLowerCase())) {
          results.push({
            id: `action-${action.query}`,
            title: action.title,
            subtitle: 'Quick action',
            type: 'action',
            href: action.href,
            icon: action.icon,
            relevance: 90
          });
        }
      });
      
      // Sort by relevance
      return results.sort((a, b) => b.relevance - a.relevance);
    },
    staleTime: 30000, // 30 seconds
  });

  const handleSelect = (result: SearchResult) => {
    // Add to recent searches
    const newRecentSearches = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(newRecentSearches);
    localStorage.setItem('recent-searches', JSON.stringify(newRecentSearches));
    
    // Navigate to result
    navigate(result.href);
    
    // Close search
    setQuery('');
    setIsOpen(false);
    onClose?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
      onClose?.();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < searchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && searchResults[selectedIndex]) {
        handleSelect(searchResults[selectedIndex]);
      }
    }
  };

  const handleRecentSearch = (searchTerm: string) => {
    setQuery(searchTerm);
    inputRef.current?.focus();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent-searches');
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-12 pr-4 h-10 mobile-text focus-ring"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => setQuery('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 z-50 mt-2"
          >
            <Card className="max-h-96 overflow-y-auto bg-background/95 backdrop-blur-lg border-border/50">
              <CardContent className="p-0">
                {/* Loading state */}
                {isLoading && (
                  <div className="p-4 text-center">
                    <div className="animate-pulse flex items-center justify-center">
                      <Search className="h-4 w-4 mr-2" />
                      <span className="text-sm text-muted-foreground">Searching...</span>
                    </div>
                  </div>
                )}

                {/* Search results */}
                {!isLoading && searchResults.length > 0 && (
                  <div className="py-2">
                    {searchResults.map((result, index) => {
                      const Icon = result.icon;
                      return (
                        <button
                          key={result.id}
                          className={cn(
                            "w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors",
                            "flex items-center space-x-3 focus:bg-accent/50 focus:outline-none",
                            selectedIndex === index && "bg-accent/50"
                          )}
                          onClick={() => handleSelect(result)}
                        >
                          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {result.title}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {result.subtitle}
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {result.type}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Recent searches */}
                {!isLoading && !query && recentSearches.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Recent searches</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearRecentSearches}
                        className="h-6 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                    {recentSearches.map((search, index) => (
                      <button
                        key={index}
                        className="w-full px-4 py-2 text-left hover:bg-accent/50 transition-colors flex items-center space-x-3"
                        onClick={() => handleRecentSearch(search)}
                      >
                        <History className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{search}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* No results */}
                {!isLoading && query && searchResults.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No results found for "{query}"
                  </div>
                )}

                {/* Search tips */}
                {!query && recentSearches.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <p>Search for employees, timesheets, or use quick actions like:</p>
                    <div className="flex flex-wrap gap-2 mt-2 justify-center">
                      <Badge variant="outline">clock</Badge>
                      <Badge variant="outline">dashboard</Badge>
                      <Badge variant="outline">reports</Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default GlobalSearch;
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutDashboard, 
  Clock, 
  Users, 
  FileText, 
  Monitor, 
  BarChart3,
  User,
  Home,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrate } from '@/utils/pwa';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  badge?: number;
}

const MobileNavigation: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const isAdmin = user?.role === 'admin';

  const navigationItems: NavigationItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Clock', href: '/clock-in-out', icon: Clock },
    { name: 'My Time', href: '/my-timesheet', icon: Calendar },
    ...(isAdmin ? [
      { name: 'Employees', href: '/employees', icon: Users, adminOnly: true },
      { name: 'Timesheets', href: '/timesheets', icon: FileText, adminOnly: true },
      { name: 'Reports', href: '/reports', icon: BarChart3, adminOnly: true },
    ] : []),
    { name: 'Profile', href: '/profile', icon: User },
  ];

  // Update active index based on current location
  useEffect(() => {
    const currentIndex = navigationItems.findIndex(item => item.href === location.pathname);
    if (currentIndex !== -1) {
      setActiveIndex(currentIndex);
    }
  }, [location.pathname, navigationItems]);

  // Handle touch events for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && activeIndex < navigationItems.length - 1) {
      const nextIndex = activeIndex + 1;
      setActiveIndex(nextIndex);
      navigate(navigationItems[nextIndex].href);
      vibrate(50); // Haptic feedback
    }

    if (isRightSwipe && activeIndex > 0) {
      const prevIndex = activeIndex - 1;
      setActiveIndex(prevIndex);
      navigate(navigationItems[prevIndex].href);
      vibrate(50); // Haptic feedback
    }
  };

  const handleNavigation = (item: NavigationItem, index: number) => {
    setActiveIndex(index);
    navigate(item.href);
    vibrate(30); // Light haptic feedback
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/98 backdrop-blur-lg border-t border-border/30 md:hidden">
      <div 
        className="flex items-center justify-around px-0.5 py-0.5 w-full"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {navigationItems.map((item, index) => {
          const isActive = index === activeIndex;
          const Icon = item.icon;
          
          return (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              className={cn(
                "flex flex-col items-center justify-center min-h-[44px] px-0.5 py-0.5 relative transition-all duration-300 flex-1",
                "hover:bg-accent/10 active:bg-accent/20 active:scale-95",
                isActive && "text-primary bg-primary/10"
              )}
              onClick={() => handleNavigation(item, index)}
            >
              <div className="relative">
                <Icon className={cn(
                  "h-4 w-4 mb-0.5 transition-all duration-300",
                  isActive && "scale-110"
                )} />
                {item.badge && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-3 w-3 p-0 text-xs flex items-center justify-center"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-xs font-medium transition-all duration-300 text-center truncate max-w-full leading-tight",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {item.name}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
              )}
            </Button>
          );
        })}
      </div>
      
      {/* Swipe indicator */}
      <div className="flex justify-center pb-1">
        <div className="w-8 h-1 bg-border/50 rounded-full" />
      </div>
    </div>
  );
};

export default MobileNavigation;
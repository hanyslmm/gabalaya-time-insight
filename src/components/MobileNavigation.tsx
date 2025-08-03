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
  const [isScrolling, setIsScrolling] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Enhanced navigation items with better organization
  const navigationItems: NavigationItem[] = [
    { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Clock', href: '/clock-in-out', icon: Clock },
    { name: 'Timesheet', href: '/my-timesheet', icon: Calendar },
    ...(isAdmin ? [
      { name: 'Staff', href: '/employees', icon: Users, adminOnly: true },
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

  // Enhanced touch handling with scroll detection
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsScrolling(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
    
    // Detect if user is scrolling vertically (to prevent horizontal swipe interference)
    const touchStartY = e.targetTouches[0].clientY;
    const touchCurrentY = e.targetTouches[0].clientY;
    if (Math.abs(touchCurrentY - touchStartY) > 10) {
      setIsScrolling(true);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || isScrolling) return;
    
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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/98 backdrop-blur-xl border-t border-border/40 md:hidden shadow-lg">
      {/* Enhanced navigation bar with better touch targets */}
      <div 
        className="flex items-center justify-around px-2 py-2 w-full"
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
                "flex flex-col items-center justify-center min-h-[64px] px-2 py-2 relative transition-all duration-300 flex-1 rounded-xl",
                "hover:bg-accent/20 active:bg-accent/30 active:scale-95 touch-manipulation",
                "focus:outline-none focus:ring-2 focus:ring-primary/20",
                isActive && "text-primary bg-primary/15 shadow-sm"
              )}
              onClick={() => handleNavigation(item, index)}
            >
              <div className="relative mb-1">
                <Icon className={cn(
                  "h-6 w-6 transition-all duration-300",
                  isActive && "scale-110 drop-shadow-sm"
                )} />
                {item.badge && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-4 w-4 p-0 text-xs flex items-center justify-center animate-pulse"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-xs font-medium transition-all duration-300 text-center truncate max-w-full leading-tight",
                isActive ? "text-primary font-semibold" : "text-muted-foreground"
              )}>
                {item.name}
              </span>
              {/* Enhanced active indicator */}
              {isActive && (
                <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-primary rounded-full shadow-sm" />
              )}
            </Button>
          );
        })}
      </div>
      
      {/* Enhanced swipe indicator with better visibility */}
      <div className="flex justify-center pb-2 pt-1">
        <div className="flex space-x-1">
          <div className="w-2 h-1 bg-border/60 rounded-full" />
          <div className="w-6 h-1 bg-border/40 rounded-full" />
          <div className="w-2 h-1 bg-border/60 rounded-full" />
        </div>
      </div>
      
      {/* Safe area padding for devices with home indicator */}
      <div className="h-safe-area-inset-bottom bg-background/50" />
    </div>
  );
};

export default MobileNavigation;
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
  Calendar,
  Settings,
  Building
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrate } from '@/utils/pwa';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  badge?: number;
  shortName?: string;
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
    { 
      name: 'Dashboard', 
      shortName: 'Home',
      href: '/dashboard', 
      icon: LayoutDashboard 
    },
    { 
      name: 'Clock In/Out', 
      shortName: 'Clock',
      href: '/clock-in-out', 
      icon: Clock 
    },
    { 
      name: 'My Timesheet', 
      shortName: 'Time',
      href: '/my-timesheet', 
      icon: Calendar 
    },
    ...(isAdmin ? [
      { 
        name: 'Employees', 
        shortName: 'Staff',
        href: '/employees', 
        icon: Users, 
        adminOnly: true 
      },
      { 
        name: 'Timesheets', 
        shortName: 'Sheets',
        href: '/timesheets', 
        icon: FileText, 
        adminOnly: true 
      },
      { 
        name: 'Reports', 
        shortName: 'Reports',
        href: '/reports', 
        icon: BarChart3, 
        adminOnly: true 
      },
    ] : []),
    { 
      name: 'Profile', 
      shortName: 'Profile',
      href: '/profile', 
      icon: User 
    },
  ];

  // Update active index based on current location
  useEffect(() => {
    const currentIndex = navigationItems.findIndex(item => {
      if (item.href === '/dashboard') {
        return location.pathname === '/' || location.pathname === '/dashboard';
      }
      return location.pathname.startsWith(item.href);
    });
    if (currentIndex !== -1) {
      setActiveIndex(currentIndex);
    }
  }, [location.pathname, navigationItems]);

  const handleNavigation = (href: string, index: number) => {
    vibrate(50); // Haptic feedback
    setActiveIndex(index);
    navigate(href);
  };

  // Swipe detection for better mobile UX
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
      handleNavigation(navigationItems[nextIndex].href, nextIndex);
    }
    if (isRightSwipe && activeIndex > 0) {
      const prevIndex = activeIndex - 1;
      handleNavigation(navigationItems[prevIndex].href, prevIndex);
    }
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 mobile-nav-bottom bg-card/95 backdrop-blur-md border-t border-border/50 mobile-safe-bottom shadow-lg"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Navigation Items */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-0.5 sm:gap-1 h-full">
        {navigationItems.map((item, index) => {
          const isActive = index === activeIndex;
          const Icon = item.icon;
          
          return (
            <Button
              key={item.href}
              variant="ghost"
              onClick={() => handleNavigation(item.href, index)}
              className={cn(
                "relative flex flex-col items-center justify-center mobile-nav-item rounded-md transition-all duration-200 mobile-press mobile-touch-target mobile-focus-ring",
                "hover:bg-accent/80 active:bg-accent/90",
                isActive 
                  ? "bg-primary/10 text-primary border-t-2 border-t-primary shadow-md mobile-gradient-primary/20" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {/* Icon */}
              <div className="relative">
                <Icon className={cn(
                  "mobile-button-icon transition-all duration-200",
                  isActive ? "text-primary scale-110" : "text-muted-foreground group-hover:text-foreground"
                )} />
                
                {/* Badge for notifications */}
                {item.badge && item.badge > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 mobile-badge min-w-0 px-1 rounded-full flex items-center justify-center"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </Badge>
                )}
              </div>

              {/* Label */}
              <span className={cn(
                "mobile-text font-medium mt-0.5 truncate transition-all duration-200",
                isActive ? "text-primary font-semibold" : "text-muted-foreground"
              )}>
                {item.shortName || item.name}
              </span>

              {/* Active Indicator */}
              {isActive && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
              )}
            </Button>
          );
        })}
      </div>

      {/* Admin Indicator */}
      {isAdmin && (
        <div className="absolute top-0 right-2 transform -translate-y-1/2">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-2 py-0.5 rounded-full shadow-lg">
            <span className="text-[8px] font-bold">ADMIN</span>
          </div>
        </div>
      )}

      {/* Swipe Indicator */}
      <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
        <div className="w-8 h-0.5 bg-muted-foreground/30 rounded-full" />
      </div>
    </nav>
  );
};

export default MobileNavigation;
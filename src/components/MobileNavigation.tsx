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
  Calendar,
  Trophy,
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
  const [isScrolling, setIsScrolling] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const navigationItems: NavigationItem[] = [
    // Dashboard only for owners, not admins
    ...(user?.role === 'owner' ? [{
      name: 'Dashboard',
      shortName: 'Home',
      href: '/dashboard',
      icon: LayoutDashboard
    }] : []),
    {
      name: 'Clock',
      shortName: 'Clock',
      href: '/clock-in-out',
      icon: Clock
    },
    {
      name: 'My Time',
      shortName: 'Time',
      href: '/my-timesheet',
      icon: Calendar
    },
    {
      name: t('myPoints'),
      shortName: t('points'),
      href: '/my-points',
      icon: Trophy
    },
    ...(isAdmin ? [
      {
        name: 'Staff',
        shortName: 'Staff',
        href: '/employees',
        icon: Users,
        adminOnly: true
      },
      {
        name: 'Reports',
        shortName: 'Reports',
        href: '/timesheets',
        icon: FileText,
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

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsScrolling(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
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
      handleNavigation(navigationItems[nextIndex].href, nextIndex);
    }
    if (isRightSwipe && activeIndex > 0) {
      const prevIndex = activeIndex - 1;
      handleNavigation(navigationItems[prevIndex].href, prevIndex);
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-border mobile-safe-bottom shadow-lg md:hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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
                "relative flex flex-col items-center justify-center min-h-[64px] rounded-md transition-all duration-200",
                "hover:bg-muted/50 active:bg-muted/70 focus:ring-2 focus:ring-primary/20",
                isActive
                  ? "bg-primary/10 text-primary border-t-2 border-t-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative mb-1">
                <Icon className={cn(
                  "h-5 w-5 sm:h-6 sm:w-6 transition-all duration-200",
                  isActive ? "text-primary scale-105" : "text-muted-foreground group-hover:text-foreground"
                )} />

                {item.badge && item.badge > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center animate-pulse"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </Badge>
                )}
              </div>

              <span className={cn(
                "text-xs font-medium mt-0.5 truncate transition-all duration-200 text-center max-w-full leading-tight",
                isActive ? "text-primary font-semibold" : "text-muted-foreground"
              )}>
                {item.shortName || item.name}
              </span>
            </Button>
          );
        })}
      </div>

      {isAdmin && (
        <div className="absolute top-0 right-2 transform -translate-y-1/2">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-2 py-0.5 rounded-full shadow-lg">
            <span className="text-[8px] font-bold">ADMIN</span>
          </div>
        </div>
      )}
      
      <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
        <div className="w-8 h-0.5 bg-muted-foreground/30 rounded-full" />
      </div>
    </nav>
  );
};

export default MobileNavigation;

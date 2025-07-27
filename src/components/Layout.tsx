
import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationSystem from '@/components/NotificationSystem';
import MobileNavigation from '@/components/MobileNavigation';
import OfflineIndicator from '@/components/OfflineIndicator';
import GlobalSearch from '@/components/GlobalSearch';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  LayoutDashboard, 
  Clock, 
  Users, 
  FileText, 
  Monitor, 
  BarChart3, 
  Settings, 
  Building, 
  LogOut,
  User,
  Shield,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  const isAdmin = user?.role === 'admin';

  const adminNavigation = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: LayoutDashboard,
      description: 'Overview & Analytics'
    },
    { 
      name: 'Employees', 
      href: '/employees', 
      icon: Users,
      description: 'Staff Management'
    },
    { 
      name: 'Timesheets', 
      href: '/timesheets', 
      icon: FileText,
      description: 'Time Tracking'
    },
    { 
      name: 'Monitor', 
      href: '/employee-monitor', 
      icon: Monitor,
      description: 'Live Tracking'
    },
    { 
      name: 'Reports', 
      href: '/reports', 
      icon: BarChart3,
      description: 'Analytics & Insights'
    },
    { 
      name: 'Settings', 
      href: '/settings', 
      icon: Settings,
      description: 'System Configuration'
    },
    { 
      name: 'Company', 
      href: '/company-settings', 
      icon: Building,
      description: 'Company Setup'
    },
  ];

  const userNavigation = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: LayoutDashboard,
      description: 'Your Overview'
    },
    { 
      name: 'Clock In/Out', 
      href: '/clock-in-out', 
      icon: Clock,
      description: 'Time Tracking'
    },
    { 
      name: 'My Timesheet', 
      href: '/my-timesheet', 
      icon: FileText,
      description: 'Your Records'
    },
    { 
      name: 'Profile', 
      href: '/profile', 
      icon: User,
      description: 'Account Settings'
    },
  ];

  const navigation = isAdmin ? adminNavigation : userNavigation;

  const isActivePath = (path: string) => {
    return location.pathname === path || 
           (path !== '/dashboard' && location.pathname.startsWith(path));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Desktop Sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:flex-col mobile-sidebar border-r bg-card/50 backdrop-blur-sm">
        {/* Sidebar Header */}
        <div className="mobile-card-header border-b">
          <div className="flex items-center justify-center lg:justify-start gap-2">
            <div className="mobile-gradient-primary rounded-lg p-1.5">
              <Clock className="mobile-button-icon text-primary-foreground" />
            </div>
            <span className="hidden lg:block font-bold mobile-heading text-primary truncate">
              TimeInsight
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 mobile-tight mobile-spacing overflow-y-auto mobile-scroll">
          <div className="space-y-0.5">
            {navigation.map((item) => {
              const isActive = isActivePath(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "group flex items-center mobile-sidebar-item rounded-md transition-all duration-200 mobile-press mobile-touch-target mobile-focus-ring",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md mobile-gradient-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground mobile-hover"
                  )}
                >
                  <item.icon className={cn(
                    "mobile-button-icon flex-shrink-0",
                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-accent-foreground"
                  )} />
                  <div className="hidden lg:block ml-2 min-w-0 flex-1">
                    <p className="mobile-text font-medium truncate">
                      {item.name}
                    </p>
                    <p className="text-[10px] opacity-75 truncate">
                      {item.description}
                    </p>
                  </div>
                  {isActive && (
                    <div className="hidden lg:block w-1 h-4 bg-primary-foreground rounded-full ml-auto opacity-75" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Role Badge */}
          <div className="mt-auto pt-4 border-t">
            <div className={cn(
              "mobile-sidebar-item rounded-md mobile-gradient-card border text-center lg:text-left",
              isAdmin ? "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950" : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
            )}>
              <div className="flex items-center justify-center lg:justify-start gap-1">
                <Shield className={cn(
                  "mobile-button-icon",
                  isAdmin ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400"
                )} />
                <span className={cn(
                  "hidden lg:block mobile-text font-medium capitalize",
                  isAdmin ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400"
                )}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="md:ml-14 lg:ml-56 xl:ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="mobile-header border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="mobile-flex items-center justify-between w-full">
            {/* Mobile Menu & Logo */}
            <div className="flex items-center gap-1 md:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="mobile-button mobile-press mobile-focus-ring">
                    <Menu className="mobile-button-icon" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <SheetHeader className="mobile-card-header border-b">
                    <SheetTitle className="flex items-center gap-2">
                      <div className="mobile-gradient-primary rounded-lg p-1.5">
                        <Clock className="mobile-button-icon text-primary-foreground" />
                      </div>
                      <span className="mobile-heading">TimeInsight</span>
                    </SheetTitle>
                  </SheetHeader>
                  <nav className="mobile-tight mobile-spacing">
                    {navigation.map((item) => {
                      const isActive = isActivePath(item.href);
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center mobile-sidebar-item rounded-md transition-all duration-200 mobile-press mobile-touch-target",
                            isActive
                              ? "bg-primary text-primary-foreground mobile-gradient-primary"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <item.icon className="mobile-button-icon" />
                          <div className="ml-2 min-w-0 flex-1">
                            <p className="mobile-text font-medium">{item.name}</p>
                            <p className="text-[10px] opacity-75">{item.description}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>

              <div className="flex items-center gap-1">
                <div className="mobile-gradient-primary rounded-md p-1">
                  <Clock className="mobile-button-icon text-primary-foreground" />
                </div>
                <span className="mobile-text font-bold text-primary">TimeInsight</span>
              </div>
            </div>

            {/* Global Search - Desktop Only */}
            <div className="hidden lg:block flex-1 max-w-md mx-4">
              <GlobalSearch />
            </div>

            {/* Right Section */}
            <div className="mobile-flex items-center">
              {/* Welcome Text - Desktop Only */}
              <div className="hidden lg:block mobile-text text-muted-foreground">
                Welcome, {user?.full_name || user?.username}
              </div>

              {/* Notifications */}
              <NotificationSystem />

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="mobile-button mobile-press mobile-focus-ring">
                    <Avatar className="h-6 w-6 sm:h-7 sm:w-7">
                      <AvatarFallback className="mobile-text font-medium bg-primary text-primary-foreground">
                        {user?.full_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="mobile-hide-text ml-1 mobile-text font-medium truncate max-w-20">
                      {user?.full_name || user?.username}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="mobile-tight">
                    <p className="mobile-text font-medium">{user?.full_name || user?.username}</p>
                    <p className="text-[10px] text-muted-foreground">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="mobile-touch-target mobile-focus-ring">
                      <User className="mobile-button-icon mr-2" />
                      <span className="mobile-text">Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive mobile-touch-target mobile-focus-ring"
                  >
                    <LogOut className="mobile-button-icon mr-2" />
                    <span className="mobile-text">Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 mobile-main mobile-safe-bottom">
          <div className="mobile-fade-in">
            <Outlet />
          </div>
        </main>

        {/* Offline Indicator */}
        <OfflineIndicator />
      </div>

      {/* Mobile Navigation */}
      {isMobile && <MobileNavigation />}
    </div>
  );
};

export default Layout;

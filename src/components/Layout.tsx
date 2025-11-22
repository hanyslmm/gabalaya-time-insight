import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import NotificationSystem from '@/components/NotificationSystem';
import OfflineIndicator from '@/components/OfflineIndicator';
import GlobalSearch from '@/components/GlobalSearch';
import OrganizationSwitcher from '@/components/OrganizationSwitcher';
import { useIsMobile, useIsTablet, useDeviceType } from '@/hooks/use-mobile';
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
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { handleSingleClick } from '@/utils/clickHandler';

const Layout = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  console.log('Layout: Rendering with user:', user, 'location:', location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  
  const handleLogout = async () => {
    try {
      await logout();
      toast.success(t('logoutSuccess'));
      navigate('/login');
    } catch (error) {
      toast.error(t('logoutError'));
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
    if (sidebarOpen) setSidebarOpen(false); // Close mobile sidebar when collapsing
  };

  const closeMobileSidebar = () => {
    setSidebarOpen(false);
  };
  
  // Enhanced click handler for navigation links (prevents double-clicks on desktop)
  const handleNavClick = React.useCallback((e: React.MouseEvent) => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      handleSingleClick(() => closeMobileSidebar(), { preventDefault: false, stopPropagation: false })(e);
    } else {
      closeMobileSidebar();
    }
  }, []);

  const isAdmin = user?.role === 'admin';
  const isOwner = user?.role === 'owner';

  const allNavigation = [
    {
      name: t('dashboard'),
      href: '/dashboard',
      icon: LayoutDashboard,
      description: t('overviewAnalytics'),
      roles: ['owner'] // Removed 'admin' - only owners can see Dashboard
    },
    {
      name: t('clockInOut'),
      href: '/clock-in-out',
      icon: Clock,
      description: t('timeTracking'),
      roles: ['admin', 'employee', 'owner']
    },
    {
      name: t('myTimesheet'),
      href: '/my-timesheet',
      icon: FileText,
      description: t('yourRecords'),
      roles: ['admin', 'employee', 'owner']
    },
    {
      name: t('employees'),
      href: '/employees',
      icon: Users,
      description: t('staffManagement'),
      roles: ['admin', 'owner']
    },
    {
      name: t('timesheets'),
      href: '/timesheets',
      icon: FileText,
      description: t('allTimeRecords'),
      roles: ['admin', 'owner']
    },
    // Employee Monitor removed; functionality integrated into Clock In/Out
    {
      name: t('reports'),
      href: '/reports',
      icon: BarChart3,
      description: t('analyticsInsights'),
      roles: ['admin', 'owner']
    },
    {
      name: t('taskManagement'),
      href: '/task-management',
      icon: ClipboardList,
      description: t('taskManagementDescription'),
      roles: ['admin', 'owner']
    },
    {
      name: 'Points Management',
      href: '/points-management',
      icon: Trophy,
      description: 'Award and manage employee points',
      roles: ['admin', 'owner']
    },
    {
      name: t('workRegulations'),
      href: '/work-regulations',
      icon: FileText,
      description: t('workRegulationsDescription'),
      roles: ['admin', 'employee', 'owner'] // Visible to all, edit only for admin/owner
    },
    {
      name: t('profile'),
      href: '/profile',
      icon: User,
      description: t('accountSettings'),
      roles: ['admin', 'employee', 'owner']
    },
    {
      name: t('settings'),
      href: '/settings',
      icon: Settings,
      description: t('systemConfiguration'),
      roles: ['admin', 'owner']
    },
    {
      name: t('companySettings'),
      href: '/company-settings',
      icon: Building,
      description: t('companySetup'),
      roles: ['admin', 'owner']
    },
    {
      name: t('organizations'),
      href: '/organizations',
      icon: Building,
      description: t('multiTenantManagement'),
      roles: ['owner']
    },
  ];

  const navigation = allNavigation.filter(item =>
    item.roles.includes(user?.role || 'employee')
  );

  const isActivePath = (path) => {
    return location.pathname === path ||
      (path !== '/dashboard' && location.pathname.startsWith(path));
  };
  
  const getInitials = (fullName) => {
    if (!fullName) return 'U';
    return fullName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Left Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out shadow-sm",
        "lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        sidebarCollapsed ? "lg:w-16" : "lg:w-64",
        "w-64"
      )}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border">
          <div className={cn(
            "flex items-center gap-3 transition-opacity duration-200",
            sidebarCollapsed ? "lg:opacity-0 lg:w-0 lg:overflow-hidden" : "opacity-100"
          )}>
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/90 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-primary-foreground font-bold text-sm">C</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">ChampTime</h1>
              <p className="text-xs text-muted-foreground">{t('hrmSystem')}</p>
            </div>
          </div>
          
          {/* Desktop Collapse Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebarCollapse}
            className="hidden lg:flex p-1.5"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>

          {/* Mobile Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={closeMobileSidebar}
            className="lg:hidden p-1.5"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = isActivePath(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={handleNavClick}
                className={cn(
                  "group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 mobile-press mobile-touch-target mobile-focus-ring",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm hover:shadow-md"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <item.icon className={cn(
                  "flex-shrink-0 h-5 w-5 transition-colors duration-200",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} />
                
                <div className={cn(
                  "ml-3 min-w-0 flex-1 transition-all duration-200",
                  sidebarCollapsed ? "lg:opacity-0 lg:w-0 lg:overflow-hidden" : "opacity-100"
                )}>
                  <p className={cn(
                    "text-sm truncate transition-colors duration-200",
                    isActive ? "font-semibold" : "font-medium"
                  )}>
                    {item.name}
                  </p>
                  <p className={cn(
                    "text-xs truncate transition-colors duration-200",
                    isActive ? "text-primary-foreground/80" : "text-muted-foreground/70"
                  )}>
                    {item.description}
                  </p>
                </div>
                
                {isActive && !sidebarCollapsed && (
                  <div className="hidden lg:block w-1 h-5 bg-primary-foreground rounded-full ml-auto" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer - User Info & Role */}
        <div className="border-t border-border p-3 sm:p-4">
          {/* Role Badge */}
          <div className={cn(
            "mb-3 transition-all duration-200",
            sidebarCollapsed ? "lg:opacity-0 lg:h-0 lg:overflow-hidden lg:mb-0" : "opacity-100"
          )}>
            <div className={cn(
              "px-3 py-2 rounded-lg border text-center",
              isOwner
                ? "border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950"
                : isAdmin
                ? "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950"
                : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
            )}>
              <div className="flex items-center justify-center gap-2">
                <Shield className={cn(
                  "h-4 w-4",
                  isOwner 
                    ? "text-purple-600 dark:text-purple-400" 
                    : isAdmin 
                    ? "text-orange-600 dark:text-orange-400" 
                    : "text-blue-600 dark:text-blue-400"
                )} />
                <span className={cn(
                  "text-sm font-medium capitalize",
                  isOwner 
                    ? "text-purple-600 dark:text-purple-400" 
                    : isAdmin 
                    ? "text-orange-600 dark:text-orange-400" 
                    : "text-blue-600 dark:text-blue-400"
                )}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start p-2 h-auto hover:bg-accent",
                  sidebarCollapsed && "lg:justify-center"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-sm font-medium bg-primary text-primary-foreground">
                    {getInitials(user?.full_name || user?.username)}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "ml-3 text-left min-w-0 flex-1 transition-all duration-200",
                  sidebarCollapsed ? "lg:opacity-0 lg:w-0 lg:overflow-hidden" : "opacity-100"
                )}>
                  <p className="text-sm font-medium truncate">{user?.full_name || user?.username}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.role || t('user')}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.full_name || user?.username}</p>
                <p className="text-xs text-muted-foreground">{user?.role || t('user')}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="mobile-touch-target mobile-focus-ring">
                  <User className="h-4 w-4 mr-2" />
                  <span>{t('profile')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive mobile-touch-target mobile-focus-ring"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span>{t('logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Version Display */}
          <div className={cn(
            "mt-4 pt-4 border-t border-border/50",
            sidebarCollapsed && "lg:hidden"
          )}>
            <div className="text-xs text-muted-foreground text-center">
              v2.11.0
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between w-full px-4 py-3 sm:py-4">
            {/* Hamburger Menu Button (for mobile) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="lg:hidden p-1.5"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Page Title - Removed to avoid duplication with MobileHeader */}
            <div className="flex-1 px-4 lg:px-0">
              {/* Title now handled by MobileHeader component in each page */}
            </div>
            
            {/* Right Section */}
            <div className="flex items-center gap-2">
              {/* Global Search - Desktop Only */}
              <div className="hidden lg:block max-w-md">
                <GlobalSearch />
              </div>
              {/* Organization Switcher */}
              <OrganizationSwitcher />
              {/* Notifications */}
              <NotificationSystem />
              {/* Language Toggle */}
              <LanguageToggle />
              {/* Theme Toggle */}
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 mobile-main mobile-safe-bottom overflow-x-hidden p-4">
          <div className="mobile-fade-in">
            <Outlet />
          </div>
        </main>

        {/* Offline Indicator */}
        <OfflineIndicator />
      </div>
    </div>
  );
};

export default Layout;
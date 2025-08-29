import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationSystem from '@/components/NotificationSystem';
import OfflineIndicator from '@/components/OfflineIndicator';
import GlobalSearch from '@/components/GlobalSearch';
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
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  
  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Failed to logout');
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

  const isAdmin = user?.role === 'admin';

  const allNavigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      description: 'Overview & Analytics',
      roles: ['admin']
    },
    {
      name: 'Clock In/Out',
      href: '/clock-in-out',
      icon: Clock,
      description: 'Time Tracking',
      roles: ['admin', 'employee']
    },
    {
      name: 'My Timesheet',
      href: '/my-timesheet',
      icon: FileText,
      description: 'Your Records',
      roles: ['admin', 'employee']
    },
    {
      name: 'Employees',
      href: '/employees',
      icon: Users,
      description: 'Staff Management',
      roles: ['admin']
    },
    {
      name: 'Timesheets',
      href: '/timesheets',
      icon: FileText,
      description: 'All Time Records',
      roles: ['admin']
    },
    {
      name: 'Employee Monitor',
      href: '/employee-monitor',
      icon: Monitor,
      description: 'Live Tracking',
      roles: ['admin']
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: BarChart3,
      description: 'Analytics & Insights',
      roles: ['admin']
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: User,
      description: 'Account Settings',
      roles: ['admin', 'employee']
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      description: 'System Configuration',
      roles: ['admin']
    },
    {
      name: 'Company Settings',
      href: '/company-settings',
      icon: Building,
      description: 'Company Setup',
      roles: ['admin']
    },
    {
      name: 'Organizations',
      href: '/organizations',
      icon: Building,
      description: 'Multi-tenant Management',
      roles: ['admin']
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
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out",
        "lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        sidebarCollapsed ? "lg:w-16" : "lg:w-64",
        "w-64"
      )}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className={cn(
            "flex items-center gap-3 transition-opacity duration-200",
            sidebarCollapsed ? "lg:opacity-0 lg:w-0 lg:overflow-hidden" : "opacity-100"
          )}>
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold text-sm">C</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">ChampTime</h1>
              <p className="text-xs text-muted-foreground font-medium">HRM System</p>
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
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = isActivePath(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={closeMobileSidebar}
                className={cn(
                  "group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 mobile-press mobile-touch-target mobile-focus-ring",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md mobile-gradient-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground mobile-hover"
                )}
              >
                <item.icon className={cn(
                  "flex-shrink-0 h-5 w-5",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-accent-foreground"
                )} />
                
                <div className={cn(
                  "ml-3 min-w-0 flex-1 transition-all duration-200",
                  sidebarCollapsed ? "lg:opacity-0 lg:w-0 lg:overflow-hidden" : "opacity-100"
                )}>
                  <p className="text-sm font-medium truncate">
                    {item.name}
                  </p>
                  <p className="text-xs opacity-75 truncate">
                    {item.description}
                  </p>
                </div>
                
                {isActive && !sidebarCollapsed && (
                  <div className="hidden lg:block w-1 h-4 bg-primary-foreground rounded-full ml-auto opacity-75" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer - User Info & Role */}
        <div className="border-t border-border p-4">
          {/* Role Badge */}
          <div className={cn(
            "mb-3 transition-all duration-200",
            sidebarCollapsed ? "lg:opacity-0 lg:h-0 lg:overflow-hidden lg:mb-0" : "opacity-100"
          )}>
            <div className={cn(
              "px-3 py-2 rounded-lg border text-center",
              isAdmin
                ? "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950"
                : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
            )}>
              <div className="flex items-center justify-center gap-2">
                <Shield className={cn(
                  "h-4 w-4",
                  isAdmin ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400"
                )} />
                <span className={cn(
                  "text-sm font-medium capitalize",
                  isAdmin ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400"
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
                  <p className="text-xs text-muted-foreground truncate">{user?.role || 'User'}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.full_name || user?.username}</p>
                <p className="text-xs text-muted-foreground">{user?.role || 'User'}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="mobile-touch-target mobile-focus-ring">
                  <User className="h-4 w-4 mr-2" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive mobile-touch-target mobile-focus-ring"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="mobile-header border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center justify-between w-full px-4 py-2 sm:py-3">
            {/* Hamburger Menu Button (for mobile) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="lg:hidden p-1.5"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Page Title */}
            <div className="flex-1 px-4 lg:px-0">
              <h2 className="text-lg font-semibold capitalize truncate">
                {location.pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
              </h2>
            </div>
            
            {/* Right Section */}
            <div className="flex items-center gap-2">
              {/* Global Search - Desktop Only */}
              <div className="hidden lg:block max-w-md">
                <GlobalSearch />
              </div>
              {/* Notifications */}
              <NotificationSystem />
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
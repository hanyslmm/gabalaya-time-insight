
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

  const navigation = isAdmin ? [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: false },
    { name: 'Clock In/Out', href: '/clock-in-out', icon: Clock, adminOnly: false },
    { name: 'Employees', href: '/employees', icon: Users, adminOnly: true },
    { name: 'Timesheets', href: '/timesheets', icon: FileText, adminOnly: true },
    { name: 'My Timesheet', href: '/my-timesheet', icon: Clock, adminOnly: false },
    { name: 'Monitor', href: '/monitor', icon: Monitor, adminOnly: true },
    { name: 'Reports', href: '/reports', icon: BarChart3, adminOnly: true },
    { name: 'Company Settings', href: '/company-settings', icon: Building, adminOnly: true },
    { name: 'Settings', href: '/settings', icon: Settings, adminOnly: true },
  ] : [
    { name: 'Clock In/Out', href: '/clock-in-out', icon: Clock, adminOnly: false },
    { name: 'My Timesheet', href: '/my-timesheet', icon: FileText, adminOnly: false },
  ];

  const visibleNavigation = navigation.filter(item => !item.adminOnly || isAdmin);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <div className="flex h-screen max-h-screen">
        {/* Sidebar - More compact */}
        <div className="hidden md:flex md:w-56 md:flex-col">
          <div className="flex flex-col flex-grow pt-3 bg-card border-r overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
            <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg">
                  <span className="text-primary-foreground font-bold text-sm">G</span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground tracking-tight">Gabalaya Finance</h1>
                  <p className="text-xs text-muted-foreground font-medium">HRM System</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex-grow flex flex-col">
              <nav className="flex-1 px-2 space-y-0.5">
                {visibleNavigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        "group flex items-center px-2 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ease-in-out",
                        isActive
                          ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-sm transform scale-[1.01]"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/80 hover:scale-[1.005]"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "mr-3 flex-shrink-0 h-5 w-5",
                          isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Main content - Mobile optimized */}
        <div className="flex flex-col flex-1 overflow-hidden w-full">
          {/* Top navigation - Ultra compact on mobile */}
          <header className="bg-card/95 backdrop-blur-sm border-b border-border/50 px-1 py-0.5 sm:px-3 sm:py-1.5 sticky top-0 z-40 shrink-0">
            <div className="flex items-center justify-between h-10 sm:h-12">
              <div className="flex items-center space-x-1 sm:space-x-3 min-w-0 flex-1">
                {/* Mobile menu trigger */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="md:hidden h-8 w-8 p-0">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-64 p-0">
                    <SheetHeader className="p-4 border-b">
                      <SheetTitle className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg">
                          <span className="text-primary-foreground font-bold text-sm">G</span>
                        </div>
                        <div>
                          <h1 className="text-lg font-semibold text-foreground tracking-tight">Gabalaya Finance</h1>
                          <p className="text-xs text-muted-foreground font-medium">HRM System</p>
                        </div>
                      </SheetTitle>
                    </SheetHeader>
                    <nav className="flex-1 px-2 py-4 space-y-1">
                      {visibleNavigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out",
                              isActive
                                ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent/80"
                            )}
                          >
                            <item.icon
                              className={cn(
                                "mr-3 flex-shrink-0 h-5 w-5",
                                isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                              )}
                            />
                            {item.name}
                          </Link>
                        );
                      })}
                    </nav>
                  </SheetContent>
                </Sheet>

                <h2 className="text-xs sm:text-lg font-semibold text-foreground capitalize tracking-tight truncate">
                  {location.pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
                </h2>
                <div className="hidden md:block">
                  <div className="h-3 w-px bg-border/50"></div>
                </div>
                <p className="hidden md:block text-xs text-muted-foreground truncate">
                  Welcome back, {user?.full_name || user?.username}
                </p>
              </div>

              {/* Global Search - Hidden on mobile/tablet */}
              <div className="flex-1 max-w-sm mx-1 hidden lg:block">
                <GlobalSearch />
              </div>
              
              <div className="flex items-center space-x-1 sm:space-x-3">
                <NotificationSystem />
                <ThemeToggle />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full hover:scale-105 transition-transform">
                      <Avatar className="h-8 w-8 ring-2 ring-border/20 hover:ring-primary/30 transition-all">
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold text-xs">
                          {user ? getInitials(user.full_name || user.username) : 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <div className="flex flex-col space-y-1 p-2">
                      <p className="text-sm font-medium leading-none">
                        {user?.full_name || user?.username}
                      </p>
                      <div className="flex items-center space-x-2">
                        <p className="text-xs text-muted-foreground">
                          {user?.role}
                        </p>
                        {isAdmin && (
                          <Shield className="h-3 w-3 text-primary" />
                        )}
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex items-center">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Page content - Zero padding mobile */}
          <main className="flex-1 overflow-y-auto bg-gradient-to-br from-background to-background/95 w-full">
            <div className="min-h-full pb-12 md:pb-1 w-full">
              <Outlet />
            </div>
          </main>


        </div>
      </div>
      
      {/* Mobile Navigation */}
      {isMobile && <MobileNavigation />}
      
      {/* Offline Indicator */}
      <OfflineIndicator />
    </div>
  );
};

export default Layout;

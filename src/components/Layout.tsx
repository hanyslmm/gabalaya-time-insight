
import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Users,
  Clock,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3,
  Monitor
} from 'lucide-react';
import NotificationSystem from './NotificationSystem';
import ProfileAvatar from './ProfileAvatar';
import LanguageSwitcher from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

const Layout: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Redirect employees to clock-in page by default
  useEffect(() => {
    if (user && user.role === 'employee' && location.pathname === '/dashboard') {
      navigate('/clock-in-out');
    }
  }, [user, location.pathname, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigation = [
    {
      name: t('dashboard') || 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      current: location.pathname === '/dashboard',
      adminOnly: true,
    },
    {
      name: 'Clock In/Out',
      href: '/clock-in-out',
      icon: Clock,
      current: location.pathname === '/clock-in-out',
    },
    {
      name: t('employees') || 'Employees',
      href: '/employees',
      icon: Users,
      current: location.pathname === '/employees',
      adminOnly: true,
    },
    {
      name: t('timesheets') || 'Timesheets',
      href: '/timesheets',
      icon: FileText,
      current: location.pathname === '/timesheets',
      adminOnly: true,
    },
    {
      name: 'Monitor',
      href: '/monitor',
      icon: Monitor,
      current: location.pathname === '/monitor',
      adminOnly: true,
    },
    {
      name: t('reports') || 'Reports',
      href: '/reports',
      icon: BarChart3,
      current: location.pathname === '/reports',
      adminOnly: true,
    },
    {
      name: t('settings') || 'Settings',
      href: '/settings',
      icon: Settings,
      current: location.pathname === '/settings',
      adminOnly: true,
    },
  ];

  const filteredNavigation = navigation.filter(item => 
    !item.adminOnly || user?.role === 'admin'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-card to-card/95 backdrop-blur-xl border-r border-border/50 shadow-2xl transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-border/50">
            <Link to={user?.role === 'employee' ? '/clock-in-out' : '/dashboard'} className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-200">
                <span className="text-white font-bold text-lg">G</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Gabalaya Finance
                </span>
                <span className="text-xs text-muted-foreground">HRM System</span>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group ${
                    item.current
                      ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg hover:shadow-xl'
                      : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground hover:shadow-md'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon className={`mr-3 h-5 w-5 transition-transform duration-200 ${item.current ? 'text-white' : 'group-hover:scale-110'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="px-4 py-4 border-t border-border/50 bg-gradient-to-r from-muted/20 to-transparent">
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-background/50 backdrop-blur-sm border border-border/30">
              <ProfileAvatar size="md" showChangeOption={true} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {user?.full_name || user?.username}
                </p>
                <div className="flex items-center space-x-2">
                  <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                    {user?.role}
                  </Badge>
                </div>
              </div>
            </div>
            
            <Button
              variant="ghost"
              className="w-full mt-3 justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-200"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-4 w-4" />
              {t('logout') || 'Logout'}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 bg-background border-b-2 border-border shadow-lg">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-4 ml-auto">
            <ThemeToggle />
            <LanguageSwitcher />
            <NotificationSystem />
            <div className="flex items-center space-x-2">
              <ProfileAvatar size="sm" />
              <span className="hidden sm:block text-sm font-medium text-foreground">
                {user?.full_name || user?.username}
              </span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-8 min-h-[calc(100vh-4rem)]">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;

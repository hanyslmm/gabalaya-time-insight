
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  username: string;
  full_name?: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Verify token with backend
      const { data, error } = await supabase.functions.invoke('authenticate-user', {
        body: { token }
      });

      if (error || !data?.success || !data?.user) {
        localStorage.removeItem('auth_token');
        setUser(null);
      } else {
        let userData = data.user;
        
        // If admin user doesn't have full_name, try to get it from employees table
        if (userData.role === 'admin' && !userData.full_name) {
          const { data: employeeData } = await supabase
            .from('employees')
            .select('full_name')
            .eq('staff_id', userData.username)
            .maybeSingle();
          
          if (employeeData?.full_name) {
            userData = {
              ...userData,
              full_name: employeeData.full_name
            };
          }
        }
        
        // Check if user is an employee with admin role
        if (userData.role === 'employee') {
          const { data: employeeData } = await supabase
            .from('employees')
            .select('role, staff_id')
            .eq('staff_id', userData.username)
            .maybeSingle();
          
          if (employeeData?.role === 'admin') {
            // Elevate employee to admin privileges
            setUser({
              ...userData,
              role: 'admin'
            });
          } else {
            setUser(userData);
          }
        } else {
          setUser(userData);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('authenticate-user', {
        body: { username, password }
      });

      if (error) {
        return { error: "Incorrect username or password" };
      }

      if (data?.success && data?.user && data?.token) {
        localStorage.setItem('auth_token', data.token);
        
        let userData = data.user;
        
        // If admin user doesn't have full_name, try to get it from employees table
        if (userData.role === 'admin' && !userData.full_name) {
          const { data: employeeData } = await supabase
            .from('employees')
            .select('full_name')
            .eq('staff_id', userData.username)
            .maybeSingle();
          
          if (employeeData?.full_name) {
            userData = {
              ...userData,
              full_name: employeeData.full_name
            };
          }
        }
        
        // Check if user is an employee with admin role
        if (userData.role === 'employee') {
          const { data: employeeData } = await supabase
            .from('employees')
            .select('role, staff_id')
            .eq('staff_id', userData.username)
            .maybeSingle();
          
          if (employeeData?.role === 'admin') {
            // Elevate employee to admin privileges
            setUser({
              ...userData,
              role: 'admin'
            });
          } else {
            setUser(userData);
          }
        } else {
          setUser(userData);
        }
        
        return {};
      } else {
        return { error: "Incorrect username or password" };
      }
    } catch (error: any) {
      console.error('Login error:', error);
      return { error: "Incorrect username or password" };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

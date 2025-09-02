import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase, setCurrentUser } from '@/integrations/supabase/client';

interface User {
  id: string;
  username: string;
  full_name: string; // full_name is now guaranteed to be a string
  role: string;
  organization_id?: string;
  current_organization_id?: string;
  is_global_owner?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        console.log('useAuth: Checking auth status...');
        const token = localStorage.getItem('auth_token');
        console.log('useAuth: Token exists:', !!token);
        
        if (!token) {
          console.log('useAuth: No token found, setting user to null');
          setCurrentUser(null);
          setUser(null);
          return; // No token, no user.
        }

        console.log('useAuth: Validating token with unified-auth...');
        // The unified-auth function is the single source of truth for user data.
        const { data, error } = await supabase.functions.invoke('unified-auth', {
          body: { action: 'validate-token', token }
        });

        console.log('useAuth: Validation response:', { data, error });

        if (error || !data?.success) {
          console.log('useAuth: Token validation failed, clearing token');
          // If token is invalid, clear it.
          localStorage.removeItem('auth_token');
          setCurrentUser(null);
          setUser(null);
        } else {
          console.log('useAuth: Token valid, user:', data.user);
          // The user object from the backend is trusted completely.
          setUser(data.user);
          setCurrentUser(data.user);
        }
      } catch (e) {
        console.error('useAuth: Error in checkAuthStatus:', e);
        setUser(null);
        setCurrentUser(null);
      } finally {
        console.log('useAuth: Setting loading to false');
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { action: 'login', username, password }
      });

      if (error || !data?.success) {
        return { error: data?.error || "Incorrect username or password" };
      }

      // The user object and token from the backend are trusted completely.
      localStorage.setItem('auth_token', data.token);
      setUser(data.user);
      setCurrentUser(data.user);
      return {};

    } catch (e: any) {
      return { error: e.message || "An unexpected error occurred." };
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setUser(null);
        setCurrentUser(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { action: 'validate-token', token }
      });

      if (error || !data?.success) {
        localStorage.removeItem('auth_token');
        setCurrentUser(null);
        setUser(null);
      } else {
        setUser(data.user);
        setCurrentUser(data.user);
      }
    } catch (e) {
      console.error('useAuth: Error refreshing user:', e);
      setUser(null);
      setCurrentUser(null);
    }
  };

  const logout = async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setCurrentUser(null);
    // This ensures a clean state on logout.
    await supabase.auth.signOut(); 
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
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

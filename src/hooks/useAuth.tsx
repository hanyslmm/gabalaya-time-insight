import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase, setSupabaseAuth } from '@/integrations/supabase/client';

interface User {
  id: string;
  username: string;
  full_name: string; // full_name is now guaranteed to be a string
  role: string;
  organization_id?: string;
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
    const checkAuthStatus = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          // Clear any existing auth headers
          setSupabaseAuth(null);
          return; // No token, no user.
        }

        // The unified-auth function is the single source of truth for user data.
        const { data, error } = await supabase.functions.invoke('unified-auth', {
          body: { action: 'validate-token', token }
        });

        if (error || !data?.success) {
          // If token is invalid, clear it.
          localStorage.removeItem('auth_token');
          setSupabaseAuth(null);
          setUser(null);
        } else {
          // The user object from the backend is trusted completely.
          setUser(data.user);
          // Set the auth headers for Supabase queries
          setSupabaseAuth(token);
        }
      } catch (e) {
        setUser(null);
        setSupabaseAuth(null);
      } finally {
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
      // Set the auth headers for Supabase queries
      setSupabaseAuth(data.token);
      return {};

    } catch (e: any) {
      return { error: e.message || "An unexpected error occurred." };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    // Clear auth headers
    setSupabaseAuth(null);
    // This ensures a clean state on logout.
    await supabase.auth.signOut(); 
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

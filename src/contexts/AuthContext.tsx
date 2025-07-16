
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuthUser {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Set up Supabase auth headers when user changes
  useEffect(() => {
    if (user && user.role) {
      // Create a custom JWT that RLS can read
      const customPayload = {
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
        sub: user.id,
        email: `${user.username}@company.com`,
        user_metadata: {},
        app_metadata: { provider: 'custom' },
        // These claims are accessible via auth.jwt() in RLS
        username: user.username,
        full_name: user.full_name,
        role: user.role
      };
      
      const token = btoa(JSON.stringify(customPayload));
      
      // Set the auth header for all Supabase requests
      (supabase as any).rest.headers['Authorization'] = `Bearer ${token}`;
      (supabase as any).realtime.accessToken = token;
    } else {
      // Clear auth headers when user is null
      delete (supabase as any).rest.headers['Authorization'];
      delete (supabase as any).realtime.accessToken;
    }
  }, [user]);

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Call the unified authentication edge function
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { action: 'login', username, password }
      });

      if (error) {
        console.error('Authentication error:', error);
        return false;
      }

      if (data && data.success && data.user) {
        const authUser: AuthUser = {
          id: data.user.id,
          username: data.user.username,
          full_name: data.user.full_name,
          role: data.user.role,
        };
        
        setUser(authUser);
        localStorage.setItem('auth_user', JSON.stringify(authUser));
        
        // Store the token if provided
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    // Clear Supabase auth headers
    delete (supabase as any).rest.headers['Authorization'];
    delete (supabase as any).realtime.accessToken;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

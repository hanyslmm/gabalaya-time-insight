
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

  // Set up Supabase auth headers when user changes - optimized for speed
  useEffect(() => {
    if (user && user.role) {
      // Create a lightweight custom JWT for fastest processing
      const customPayload = {
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
        sub: user.id,
        username: user.username,
        role: user.role
      };
      
      const token = btoa(JSON.stringify(customPayload));
      
      // Set the auth header for all Supabase requests immediately
      (supabase as any).rest.headers['Authorization'] = `Bearer ${token}`;
      (supabase as any).realtime.accessToken = token;
    } else {
      // Clear auth headers when user is null
      delete (supabase as any).rest.headers['Authorization'];
      delete (supabase as any).realtime.accessToken;
    }
  }, [user]);

  useEffect(() => {
    // Check for existing session immediately - no delays
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('auth_user');
      }
    }
    // Set loading to false immediately for fastest UI response
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Call the unified authentication edge function with optimized settings
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { action: 'login', username, password },
        headers: {
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });

      if (error) {
        console.error('Login error:', error);
        return false;
      }

      if (data && data.success && data.user) {
        const authUser: AuthUser = {
          id: data.user.id,
          username: data.user.username,
          full_name: data.user.full_name,
          role: data.user.role,
        };
        
        // Set user immediately for fastest UI response
        setUser(authUser);
        
        // Store in localStorage asynchronously to not block login
        setTimeout(() => {
          localStorage.setItem('auth_user', JSON.stringify(authUser));
          if (data.token) {
            localStorage.setItem('auth_token', data.token);
          }
        }, 0);
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login exception:', error);
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


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
        
        // Store the token if provided and set up Supabase session
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          
          // Set up a custom session with the JWT for RLS
          // This creates a fake JWT that RLS can read
          const customJWT = btoa(JSON.stringify({
            aud: 'authenticated',
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
            sub: data.user.id,
            email: `${data.user.username}@company.com`,
            user_metadata: {},
            app_metadata: {
              provider: 'custom',
              providers: ['custom']
            },
            // Custom claims for RLS - these go in root for auth.jwt() access
            username: data.user.username,
            full_name: data.user.full_name,
            role: data.user.role
          }));
          
          // Set the authorization header for all future requests
          supabase.auth.getSession().then(() => {
            // Override the session to include our custom JWT claims
            (supabase as any).rest.headers['Authorization'] = `Bearer ${customJWT}`;
          });
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
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

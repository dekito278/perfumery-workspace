
import React, { createContext, useContext, useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient.js';

const AuthContext = createContext(null);
const AUTH_INIT_TIMEOUT_MS = 5000;

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    const finishLoading = (nextSession = null) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setCurrentUser(nextSession?.user ?? null);
      setInitialLoading(false);
    };

    const initializeAuth = async () => {
      try {
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('Failed to restore Supabase session:', error);
        }

        finishLoading(initialSession);
      } catch (error) {
        console.error('Unexpected auth initialization error:', error);
        finishLoading(null);
      }
    };

    timeoutId = window.setTimeout(() => {
      console.warn('Auth initialization timed out, continuing without restored session.');
      finishLoading(null);
    }, AUTH_INIT_TIMEOUT_MS);

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      finishLoading(nextSession);
    });

    return () => {
      isMounted = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      setSession(data.session);
      setCurrentUser(data.user);
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const signup = async (email, password, _passwordConfirm, name) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        throw error;
      }

      setSession(data.session ?? null);
      setCurrentUser(data.user ?? null);
      return {
        ...data,
        emailConfirmationRequired: !data.session,
      };
    } catch (error) {
      console.error('Signup error:', error);
      throw new Error(error.message || 'Signup failed');
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      throw new Error(error.message || 'Logout failed');
    }

    setSession(null);
    setCurrentUser(null);
  };

  const getAuthState = () => ({
    isAuthenticated: !!session?.user,
    user: session?.user ?? null,
  });

  const value = {
    currentUser,
    login,
    signup,
    logout,
    isAuthenticated: !!session?.user,
    getAuthState,
    initialLoading,
    session,
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

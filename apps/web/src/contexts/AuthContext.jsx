
import React, { createContext, useContext, useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient.js';

const AuthContext = createContext(null);
const AUTH_INIT_TIMEOUT_MS = 5000;
const AUTH_STORAGE_KEY_SUFFIX = '-auth-token';

const getCachedSession = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const authStorageKey = Object.keys(window.localStorage).find((key) => key.endsWith(AUTH_STORAGE_KEY_SUFFIX));
    if (!authStorageKey) {
      return null;
    }

    const rawValue = window.localStorage.getItem(authStorageKey);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue?.access_token || !parsedValue?.user) {
      return null;
    }

    return parsedValue;
  } catch (error) {
    console.warn('Failed to read cached auth session:', error);
    return null;
  }
};

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
        const cachedSession = getCachedSession();
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('Failed to restore Supabase session:', error);
        }

        finishLoading(initialSession || cachedSession);
      } catch (error) {
        console.error('Unexpected auth initialization error:', error);
        finishLoading(getCachedSession());
      }
    };

    timeoutId = window.setTimeout(() => {
      const cachedSession = getCachedSession();
      if (!cachedSession) {
        console.warn('Auth initialization timed out, continuing without restored session.');
      }
      finishLoading(cachedSession);
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

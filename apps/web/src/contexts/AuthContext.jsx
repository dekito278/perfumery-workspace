
import React, { createContext, useContext, useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.model) {
      setCurrentUser(pb.authStore.model);
    }
    setInitialLoading(false);

    const unsubscribe = pb.authStore.onChange((token, model) => {
      setCurrentUser(model);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password, {
        $autoCancel: false
      });
      setCurrentUser(authData.record);
      return authData;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const signup = async (email, password, passwordConfirm, name) => {
    try {
      const user = await pb.collection('users').create({
        email,
        password,
        passwordConfirm,
        name
      }, { $autoCancel: false });

      const authData = await pb.collection('users').authWithPassword(email, password, {
        $autoCancel: false
      });
      
      setCurrentUser(authData.record);
      return user;
    } catch (error) {
      console.error('Signup error:', error);
      throw new Error(error.message || 'Signup failed');
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setCurrentUser(null);
  };

  const getAuthState = () => ({
    isAuthenticated: pb.authStore.isValid,
    user: pb.authStore.model
  });

  const value = {
    currentUser,
    login,
    signup,
    logout,
    isAuthenticated: pb.authStore.isValid,
    getAuthState,
    initialLoading
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


import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [mfaResolutionPending, setMfaResolutionPending] = useState(false);
  const mfaChallengeRef = useRef(null);
  const authResolutionRef = useRef(0);
  const [session, setSession] = useState(null);

  const setActiveMfaChallenge = (nextChallenge) => {
    mfaChallengeRef.current = nextChallenge;
    setMfaChallenge(nextChallenge);
  };

  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    const finishLoading = (nextSession = null, nextMfaChallenge, nextMfaResolutionPending = false) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setCurrentUser(nextSession?.user ?? null);
      setMfaResolutionPending(nextMfaResolutionPending);
      if (nextMfaChallenge !== undefined) {
        setActiveMfaChallenge(nextMfaChallenge);
      } else if (!nextSession?.user) {
        setActiveMfaChallenge(null);
      }
      setInitialLoading(false);
    };

    const resolveMfaChallenge = async (nextSession) => {
      if (!nextSession?.user) {
        return null;
      }

      try {
        const [{ data: assurance }, { data: factorsData }] = await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
        ]);
        const verifiedTotp = factorsData?.totp?.find((factor) => factor.status === 'verified');

        if (!verifiedTotp || assurance?.currentLevel === 'aal2') {
          return null;
        }

        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: verifiedTotp.id,
        });

        if (challengeError) {
          throw challengeError;
        }

        return {
          challengeId: challengeData.id,
          factorId: verifiedTotp.id,
          friendlyName: verifiedTotp.friendly_name || 'Authenticator app',
        };
      } catch (error) {
        console.warn('Failed to initialize MFA challenge:', error);
        return null;
      }
    };

    const finishWithResolvedMfa = async (nextSession = null) => {
      const resolutionId = authResolutionRef.current + 1;
      authResolutionRef.current = resolutionId;

      if (nextSession?.user) {
        setMfaResolutionPending(true);
      }

      const nextMfaChallenge = await resolveMfaChallenge(nextSession);
      if (authResolutionRef.current !== resolutionId) {
        return;
      }

      finishLoading(nextSession, nextMfaChallenge, false);
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

        const nextSession = initialSession || cachedSession;
        await finishWithResolvedMfa(nextSession);
      } catch (error) {
        console.error('Unexpected auth initialization error:', error);
        const cachedSession = getCachedSession();
        await finishWithResolvedMfa(cachedSession);
      }
    };

    timeoutId = window.setTimeout(() => {
      const cachedSession = getCachedSession();
      if (!cachedSession) {
        console.info('Auth initialization timed out, continuing without restored session.');
        finishLoading(null, null, false);
        return;
      }

      console.info('Auth initialization timed out, waiting for MFA assurance before restoring protected access.');
      finishLoading(cachedSession, null, true);
    }, AUTH_INIT_TIMEOUT_MS);

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession?.user) {
        authResolutionRef.current += 1;
        finishLoading(null, null, false);
        return;
      }

      finishWithResolvedMfa(nextSession);
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
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        throw factorsError;
      }

      const verifiedTotp = factorsData?.totp?.find((factor) => factor.status === 'verified');
      if (verifiedTotp) {
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: verifiedTotp.id,
        });

        if (challengeError) {
          throw challengeError;
        }

        const nextChallenge = {
          challengeId: challengeData.id,
          factorId: verifiedTotp.id,
          friendlyName: verifiedTotp.friendly_name || 'Authenticator app',
        };
        setActiveMfaChallenge(nextChallenge);
        return { ...data, mfaRequired: true, mfaChallenge: nextChallenge };
      }

      setActiveMfaChallenge(null);
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const verifyMfaCode = async (code) => {
    const activeChallenge = mfaChallengeRef.current || mfaChallenge;
    if (!activeChallenge?.factorId || !activeChallenge?.challengeId) {
      throw new Error('No authenticator challenge is active');
    }

    const { data, error } = await supabase.auth.mfa.verify({
      factorId: activeChallenge.factorId,
      challengeId: activeChallenge.challengeId,
      code: String(code || '').trim(),
    });

    if (error) {
      throw new Error(error.message || 'Invalid authenticator code');
    }

    const {
      data: { session: verifiedSession },
    } = await supabase.auth.getSession();
    const nextSession = data.session || verifiedSession;

    setSession(nextSession);
    setCurrentUser(data.user ?? nextSession?.user ?? null);
    setActiveMfaChallenge(null);
    return { ...data, session: nextSession };
  };

  const enrollAuthenticator = async (friendlyName = 'Solivagant Studio') => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName,
    });

    if (error) {
      throw new Error(error.message || 'Failed to create authenticator setup');
    }

    return data;
  };

  const verifyAuthenticatorEnrollment = async ({ factorId, challengeId, code }) => {
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: String(code || '').trim(),
    });

    if (error) {
      throw new Error(error.message || 'Invalid authenticator code');
    }

    setSession(data.session);
    setCurrentUser(data.user ?? data.session?.user ?? null);
    setActiveMfaChallenge(null);
    return data;
  };

  const challengeAuthenticatorEnrollment = async (factorId) => {
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });

    if (error) {
      throw new Error(error.message || 'Failed to verify authenticator setup');
    }

    return data;
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

  const requestPasswordReset = async (email, redirectTo = `${window.location.origin}/reset-password`) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error('Password reset request error:', error);
      throw new Error(error.message || 'Failed to send password reset email');
    }
  };

  const updatePassword = async (password) => {
    const { data, error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error('Password update error:', error);
      throw new Error(error.message || 'Failed to update password');
    }

    if (data?.user) {
      setCurrentUser(data.user);
    }

    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      throw new Error(error.message || 'Logout failed');
    }

    setSession(null);
    setCurrentUser(null);
    setActiveMfaChallenge(null);
  };

  const cancelMfaChallenge = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.warn('Failed to sign out while cancelling MFA challenge:', error);
    }

    setSession(null);
    setCurrentUser(null);
    setMfaResolutionPending(false);
    setActiveMfaChallenge(null);
  };

  const getAuthState = () => ({
    isAuthenticated: !!session?.user && !mfaChallenge && !mfaResolutionPending,
    user: session?.user ?? null,
  });

  const value = {
    cancelMfaChallenge,
    challengeAuthenticatorEnrollment,
    currentUser,
    enrollAuthenticator,
    login,
    requestPasswordReset,
    signup,
    updatePassword,
    logout,
    isAuthenticated: !!session?.user && !mfaChallenge && !mfaResolutionPending,
    mfaChallenge,
    mfaResolutionPending,
    getAuthState,
    initialLoading,
    session,
    verifyAuthenticatorEnrollment,
    verifyMfaCode,
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

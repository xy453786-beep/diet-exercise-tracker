import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../api/client';
import type { User as AppUser } from '../types';
import type { Session } from '@supabase/supabase-js';
import * as profileApi from '../api/endpoints';
import { clearUserIdCache } from '../api/endpoints';

interface AuthState {
  appUser: (AppUser & { id: string }) | null;
  session: Session | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithPhone: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateAppUser: (data: Partial<AppUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    appUser: null,
    session: null,
    loading: true,
  });

  // Fetch profile from backend
  const fetchProfile = useCallback(async (session: Session) => {
    try {
      const profile = await profileApi.getProfile();
      setState({ appUser: profile, session, loading: false });
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setState({ appUser: null, session, loading: false });
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session);
      } else {
        setState({ appUser: null, session: null, loading: false });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        fetchProfile(session);
      } else {
        setState({ appUser: null, session: null, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const signInWithPhone = useCallback(async (phone: string) => {
    // Format phone to international if it's a Chinese number
    const formattedPhone = phone.startsWith('+') ? phone : `+86${phone}`;
    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    });
    if (error) throw error;
  }, []);

  const verifyOtp = useCallback(async (phone: string, token: string) => {
    const formattedPhone = phone.startsWith('+') ? phone : `+86${phone}`;
    const { error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token,
      type: 'sms',
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearUserIdCache();
    setState({ appUser: null, session: null, loading: false });
  }, []);

  const updateAppUser = useCallback(async (data: Partial<AppUser>) => {
    try {
      await profileApi.updateProfile(data);
      setState((prev) => ({
        ...prev,
        appUser: prev.appUser ? { ...prev.appUser, ...data } : null,
      }));
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signUp,
        signIn,
        signInWithPhone,
        verifyOtp,
        signOut,
        updateAppUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../api/client';
import type { User as AppUser } from '../types';
import type { Session } from '@supabase/supabase-js';
import * as profileApi from '../api/endpoints';
import { clearUserIdCache } from '../api/endpoints';
import type { UserMetrics, WeightPrediction } from '../api/endpoints';

interface AuthState {
  appUser: (AppUser & { id: string }) | null;
  session: Session | null;
  loading: boolean;
  userMetrics: UserMetrics | null;
  weightPredictions: WeightPrediction | null;
}

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateAppUser: (data: Partial<AppUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    appUser: null,
    session: null,
    loading: true,
    userMetrics: null,
    weightPredictions: null,
  });

  // Realtime channel refs for cleanup
  const metricsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const predictionsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch profile + metrics from backend
  const fetchProfile = useCallback(async (session: Session) => {
    try {
      const profile = await profileApi.getProfile();
      const userId = profile.id;

      // 拉取数据库计算的 BMR/TDEE
      let metrics: UserMetrics | null = null;
      try {
        metrics = await profileApi.getUserMetrics();
        // 如果还没有 metrics（新用户），触发首次计算
        if (!metrics) {
          await profileApi.recalculateMetrics();
          metrics = await profileApi.getUserMetrics();
        }
      } catch (e) {
        console.warn('获取 metrics 失败，使用前端兜底:', e);
      }

      // 拉取体重预测
      let predictions: WeightPrediction | null = null;
      try {
        predictions = await profileApi.getWeightPredictions();
        // 如果还没有预测（新用户），触发首次计算
        if (!predictions) {
          await profileApi.recalculatePredictions();
          predictions = await profileApi.getWeightPredictions();
        }
      } catch (e) {
        console.warn('获取预测失败:', e);
      }

      setState({
        appUser: {
          id: userId,
          username: profile.username,
          avatarUrl: profile.avatarUrl,
          height: profile.height,
          weight: profile.weight,
          gender: profile.gender,
          age: profile.age,
          activityLevel: profile.activityLevel as any,
          hasCompletedSurvey: profile.hasCompletedSurvey,
        },
        session,
        loading: false,
        userMetrics: metrics,
        weightPredictions: predictions,
      });

      // 订阅 Realtime：user_metrics 变化时自动更新
      if (userId && !metricsChannelRef.current) {
        const channel = supabase
          .channel('metrics-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_metrics',
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              const updated = payload.new as UserMetrics;
              if (updated && updated.user_id === userId) {
                setState((prev) => ({ ...prev, userMetrics: updated }));
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log('[Realtime] user_metrics 已订阅');
          });
        metricsChannelRef.current = channel;
      }

      // 订阅 Realtime：weight_predictions 变化时自动更新
      if (userId && !predictionsChannelRef.current) {
        const predChannel = supabase
          .channel('predictions-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'weight_predictions',
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              const updated = payload.new as WeightPrediction;
              if (updated && updated.user_id === userId) {
                setState((prev) => ({ ...prev, weightPredictions: updated }));
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log('[Realtime] weight_predictions 已订阅');
          });
        predictionsChannelRef.current = predChannel;
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setState({ appUser: null, session, loading: false, userMetrics: null, weightPredictions: null });
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session);
      } else {
        setState({ appUser: null, session: null, loading: false, userMetrics: null, weightPredictions: null });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        fetchProfile(session);
      } else {
        // 清理 Realtime 订阅
        if (metricsChannelRef.current) {
          supabase.removeChannel(metricsChannelRef.current);
          metricsChannelRef.current = null;
        }
        if (predictionsChannelRef.current) {
          supabase.removeChannel(predictionsChannelRef.current);
          predictionsChannelRef.current = null;
        }
        setState({ appUser: null, session: null, loading: false, userMetrics: null, weightPredictions: null });
      }
    });

    return () => {
      subscription.unsubscribe();
      if (metricsChannelRef.current) {
        supabase.removeChannel(metricsChannelRef.current);
        metricsChannelRef.current = null;
      }
      if (predictionsChannelRef.current) {
        supabase.removeChannel(predictionsChannelRef.current);
        predictionsChannelRef.current = null;
      }
    };
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });
    if (error) throw error;

    // If signUp didn't return a session (email confirmation required),
    // try signing in immediately — works if the project has confirm disabled
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        // Email confirmation is still required
        throw new Error('请前往 Supabase 后台关闭邮箱确认（Authentication > Settings > Email > Confirm email）');
      }
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearUserIdCache();
    if (metricsChannelRef.current) {
      supabase.removeChannel(metricsChannelRef.current);
      metricsChannelRef.current = null;
    }
    if (predictionsChannelRef.current) {
      supabase.removeChannel(predictionsChannelRef.current);
      predictionsChannelRef.current = null;
    }
    setState({ appUser: null, session: null, loading: false, userMetrics: null, weightPredictions: null });
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

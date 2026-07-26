import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../api/client';
import type { User as AppUser } from '../types';
import * as profileApi from '../api/endpoints';
import { clearUserIdCache } from '../api/endpoints';
import type { UserMetrics, WeightPrediction } from '../api/endpoints';

interface AuthState {
  appUser: (AppUser & { id: string }) | null;
  loading: boolean;
  userMetrics: UserMetrics | null;
  weightPredictions: WeightPrediction | null;
}

interface AuthContextType extends AuthState {
  updateAppUser: (data: Partial<AppUser>) => Promise<void>;
  /** 重载所有数据（匿名登录完成后调用） */
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    appUser: null,
    loading: true,
    userMetrics: null,
    weightPredictions: null,
  });

  // Realtime channel refs for cleanup
  const metricsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const predictionsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /** 清理所有 Realtime 订阅 */
  const cleanupChannels = useCallback(() => {
    if (metricsChannelRef.current) {
      supabase.removeChannel(metricsChannelRef.current);
      metricsChannelRef.current = null;
    }
    if (predictionsChannelRef.current) {
      supabase.removeChannel(predictionsChannelRef.current);
      predictionsChannelRef.current = null;
    }
  }, []);

  /** 从 Supabase 拉取用户信息 + 指标数据 */
  const fetchProfile = useCallback(async () => {
    try {
      const profile = await profileApi.getProfile();
      const userId = profile.id;

      // 拉取数据库计算的 BMR/TDEE
      let metrics: UserMetrics | null = null;
      try {
        metrics = await profileApi.getUserMetrics();
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
      // 如果 Supabase 查询失败（例如 RLS 对匿名用户未开放），回退到本地用户
      createLocalUser();
    }
  }, []);

  /** 创建本地离线用户（匿名登录失败或 Supabase 不可用时） */
  const createLocalUser = useCallback(() => {
    cleanupChannels();
    const stored = localStorage.getItem('local_user_data');
    let localData: Record<string, any> = {};
    try { localData = stored ? JSON.parse(stored) : {}; } catch {}

    const localId = localStorage.getItem('local_user_id') || crypto.randomUUID();
    localStorage.setItem('local_user_id', localId);

    setState({
      appUser: {
        id: localId,
        username: localData.username || '访客',
        avatarUrl: localData.avatarUrl || '',
        height: localData.height || 175,
        weight: localData.weight || null,
        gender: localData.gender || undefined,
        age: localData.age || undefined,
        activityLevel: localData.activityLevel || undefined,
        hasCompletedSurvey: localData.hasCompletedSurvey || false,
      },
      loading: false,
      userMetrics: null,
      weightPredictions: null,
    });
  }, [cleanupChannels]);

  /** 初始化：自动匿名登录 */
  const initAuth = useCallback(async () => {
    try {
      // 先检查是否有已有会话
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData.session) {
        // 已有会话，直接加载数据
        await fetchProfile();
        return;
      }

      // 尝试匿名登录
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.session) {
        console.warn('匿名登录不可用，使用本地模式:', error?.message);
        createLocalUser();
        return;
      }

      // 匿名登录成功，加载数据
      console.log('[Auth] 匿名登录成功');
      await fetchProfile();
    } catch (err: any) {
      console.warn('初始化认证失败，使用本地模式:', err?.message);
      createLocalUser();
    }
  }, [fetchProfile, createLocalUser]);

  useEffect(() => {
    initAuth();

    return () => {
      cleanupChannels();
    };
  }, [initAuth, cleanupChannels]);

  const reloadProfile = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    await fetchProfile();
  }, [fetchProfile]);

  const updateAppUser = useCallback(async (data: Partial<AppUser>) => {
    // Optimistic update: 先改 UI
    setState((prev) => ({
      ...prev,
      appUser: prev.appUser ? { ...prev.appUser, ...data } : null,
    }));

    // 如果是本地模式，存到 localStorage
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      const stored = JSON.parse(localStorage.getItem('local_user_data') || '{}');
      localStorage.setItem('local_user_data', JSON.stringify({ ...stored, ...data }));
    }

    // 后台持久化到 Supabase，失败不阻塞
    try {
      await profileApi.updateProfile(data);
    } catch (err) {
      console.error('Failed to update profile (UI already updated):', err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        updateAppUser,
        reloadProfile,
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

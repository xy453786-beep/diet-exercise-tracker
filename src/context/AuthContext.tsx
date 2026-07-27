import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../api/client';
import type { User as AppUser } from '../types';
import * as profileApi from '../api/endpoints';
import { DEMO_USER_ID } from '../api/constants';
import type { UserMetrics, WeightPrediction } from '../api/endpoints';

const DEMO_USER_PROFILE_KEY = 'demo_user_profile';

interface AuthState {
  appUser: (AppUser & { id: string }) | null;
  loading: boolean;
  userMetrics: UserMetrics | null;
  weightPredictions: WeightPrediction | null;
}

interface AuthContextType extends AuthState {
  updateAppUser: (data: Partial<AppUser>) => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** localStorage 读写 demo 用户配置 */
function loadLocalProfile(): Partial<AppUser> | null {
  try {
    const raw = localStorage.getItem(DEMO_USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveLocalProfile(data: Partial<AppUser>): void {
  try {
    localStorage.setItem(DEMO_USER_PROFILE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — 静默忽略 */ }
}

/** 默认 appUser（未加载完成或查询失败时使用） */
function defaultAppUser(local?: Partial<AppUser> | null): AppUser & { id: string } {
  return {
    id: DEMO_USER_ID,
    username: 'Demo用户',
    avatarUrl: '',
    height: local?.height || 178,
    weight: local?.weight ?? null,
    gender: local?.gender || undefined,
    age: local?.age || undefined,
    activityLevel: local?.activityLevel || undefined,
    hasCompletedSurvey: local?.hasCompletedSurvey ?? false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    // 首次渲染：从 localStorage 加载已保存的 profile，无需等待任何异步操作
    const local = loadLocalProfile();
    return {
      appUser: defaultAppUser(local),
      loading: false,
      userMetrics: null,
      weightPredictions: null,
    };
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

  /** 从 Supabase 拉取用户配置 + 指标数据（失败时使用 localStorage / 默认值） */
  const fetchProfile = useCallback(async () => {
    try {
      const profile = await profileApi.getProfile();
      const userId = profile.id;

      // 拉取数据库计算的 BMR/TDEE
      let metrics: UserMetrics | null = null;
      try {
        metrics = await profileApi.getUserMetrics();
        if (!metrics) {
          // RPC update_metrics_for_user 依赖 weight_entries 表，
          // 如果没有体重记录则先创建一条默认记录
          if (!profile.weight) {
            const today = new Date().toISOString().split('T')[0];
            const defaultWeight = state.appUser?.weight || 70;
            await profileApi.upsertWeight(today, defaultWeight);
          }
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

      setState((prev) => ({
        ...prev,
        appUser: {
          ...prev.appUser,
          id: userId,
          username: profile.username,
          avatarUrl: profile.avatarUrl,
          height: profile.height,
          weight: profile.weight,
          gender: profile.gender ?? prev.appUser?.gender,
          age: profile.age ?? prev.appUser?.age,
          activityLevel: (profile.activityLevel as any) ?? prev.appUser?.activityLevel,
          hasCompletedSurvey: profile.hasCompletedSurvey || prev.appUser?.hasCompletedSurvey || false,
        },
        loading: false,
        userMetrics: metrics,
        weightPredictions: predictions,
      }));

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
      // Supabase 查询失败（RLS 未配置或 demo 用户不存在），使用 localStorage + 默认值
      console.warn('Supabase 查询失败，使用本地数据:', err);
      const local = loadLocalProfile();
      setState((prev) => ({
        ...prev,
        appUser: defaultAppUser(local),
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    return () => {
      cleanupChannels();
    };
  }, [fetchProfile, cleanupChannels]);

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

    // 持久化到 localStorage（离线时也可用）
    const current = loadLocalProfile() || {};
    saveLocalProfile({ ...current, ...data });

    // 在后台持久化到 Supabase，失败不阻塞
    try {
      await profileApi.updateProfile(data);
    } catch (err) {
      console.warn('同步到 Supabase 失败（数据已保存到本地）:', err);
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

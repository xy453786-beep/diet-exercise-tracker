import { supabase } from './client';
import type { MealRecord, MealItem, MealCategory, WorkoutItem, WeightEntry, AIDietAnalysis, FoodCompositionResult, FoodAnalyzeResult } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Cached user ID — use getSession() (local, no network) to avoid API call per operation
let _cachedUserId: string | null = null;

async function getUserId(): Promise<string> {
  if (_cachedUserId) return _cachedUserId;
  // getSession reads from local storage, no network request
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) {
    _cachedUserId = session.user.id;
    return _cachedUserId;
  }
  // Fallback: verify with server
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  _cachedUserId = user.id;
  return _cachedUserId;
}

// Clear cache on logout (called from AuthContext)
export function clearUserIdCache(): void {
  _cachedUserId = null;
}

const MEAL_META: Record<string, { name: string; icon: string }> = {
  breakfast: { name: '早餐', icon: '🌅' },
  lunch: { name: '午餐', icon: '☀️' },
  dinner: { name: '晚餐', icon: '🌙' },
};

// ==================== Auth / Profile ====================

export async function getProfile(): Promise<{
  id: string; username: string; avatarUrl: string; height: number; weight: number | null;
  gender?: 'male' | 'female'; age?: number; activityLevel?: string; hasCompletedSurvey?: boolean;
}> {
  const userId = await getUserId();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, height, gender, age, activity_level, has_completed_survey')
    .eq('id', userId)
    .single();

  if (error || !profile) throw new Error('用户信息未找到');

  // Get latest weight
  const { data: latestWeight } = await supabase
    .from('weight_entries')
    .select('weight')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    id: profile.id,
    username: profile.username,
    avatarUrl: profile.avatar_url,
    height: profile.height || 178,
    weight: latestWeight?.weight || null,
    gender: profile.gender || undefined,
    age: profile.age || undefined,
    activityLevel: profile.activity_level || undefined,
    hasCompletedSurvey: profile.has_completed_survey || false,
  };
}

export async function updateProfile(data: {
  username?: string;
  avatarUrl?: string;
  height?: number;
  gender?: string;
  age?: number;
  activityLevel?: string;
  hasCompletedSurvey?: boolean;
}): Promise<void> {
  const userId = await getUserId();
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (data.username !== undefined) updates.username = data.username;
  if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl;
  if (data.height !== undefined) updates.height = data.height;
  if (data.gender !== undefined) updates.gender = data.gender;
  if (data.age !== undefined) updates.age = data.age;
  if (data.activityLevel !== undefined) updates.activity_level = data.activityLevel;
  if (data.hasCompletedSurvey !== undefined) updates.has_completed_survey = data.hasCompletedSurvey;

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) throw new Error('更新失败');
}

// ==================== Weights ====================

export async function getWeights(from: string, to: string): Promise<WeightEntry[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('weight_entries')
    .select('entry_date, weight')
    .eq('user_id', userId)
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('entry_date', { ascending: true });

  if (error) throw new Error('查询体重失败');
  return (data || []).map((e) => ({ day: e.entry_date, weight: e.weight }));
}

export async function upsertWeight(date: string, weight: number): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('weight_entries')
    .upsert({ user_id: userId, entry_date: date, weight }, { onConflict: 'user_id,entry_date' });

  if (error) throw new Error('保存体重失败');
}

// ==================== Meals ====================

export async function getMeals(from: string, to: string): Promise<Record<string, MealRecord[]>> {
  const userId = await getUserId();

  // Fetch meal records
  const { data: records, error } = await supabase
    .from('meal_records')
    .select('id, entry_date, category, name, icon')
    .eq('user_id', userId)
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('entry_date', { ascending: true })
    .order('category', { ascending: true });

  if (error) throw new Error('查询饮食记录失败');
  if (!records || records.length === 0) return {};

  // Deduplicate: keep only one record per date+category (latest ID wins)
  const seen = new Map<string, string>(); // key: "date:category" → id
  const deduped: typeof records = [];
  for (const r of records) {
    const key = `${r.entry_date}:${r.category}`;
    if (seen.has(key)) {
      // Merge: update the existing entry's ID, items will be fetched for both
      const prev = deduped.find(d => d.id === seen.get(key));
      if (prev) continue; // skip duplicate, keep first
    }
    seen.set(key, r.id);
    deduped.push(r);
  }

  // Fetch all items for these meal records (include all IDs so no items are lost)
  const allRecordIds = records.map((r) => r.id);
  const { data: allItems, error: itemsError } = await supabase
    .from('meal_items')
    .select('id, meal_record_id, name, calories, protein, carbs, fat, portion, image')
    .in('meal_record_id', allRecordIds)
    .order('created_at', { ascending: true });

  if (itemsError) throw new Error('查询食物条目失败');

  // Group items by meal_record_id
  const itemsByRecord: Record<string, any[]> = {};
  for (const item of allItems || []) {
    if (!itemsByRecord[item.meal_record_id]) {
      itemsByRecord[item.meal_record_id] = [];
    }
    itemsByRecord[item.meal_record_id].push({
      id: item.id,
      name: item.name,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      portion: item.portion,
      image: item.image,
    });
  }

  // Build mealsByDay using deduped records
  const mealsByDay: Record<string, MealRecord[]> = {};
  for (const record of deduped) {
    if (!mealsByDay[record.entry_date]) mealsByDay[record.entry_date] = [];
    mealsByDay[record.entry_date].push({
      id: record.id,
      category: record.category as MealCategory,
      name: record.name,
      icon: record.icon,
      items: itemsByRecord[record.id] || [],
    });
  }

  return mealsByDay;
}

async function ensureMealRecord(userId: string, date: string, category: string): Promise<string> {
  // Check existing
  const { data: existing } = await supabase
    .from('meal_records')
    .select('id')
    .eq('user_id', userId)
    .eq('entry_date', date)
    .eq('category', category)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new
  const meta = MEAL_META[category] || { name: category, icon: '🍽️' };
  const { data: created, error } = await supabase
    .from('meal_records')
    .insert({ user_id: userId, entry_date: date, category, name: meta.name, icon: meta.icon })
    .select('id')
    .single();

  if (error || !created) throw new Error('创建饮食记录失败');
  return created.id;
}

export async function addMealItem(
  date: string,
  category: MealCategory,
  item: Omit<MealItem, 'id'>
): Promise<MealItem> {
  const userId = await getUserId();

  if (!MEAL_META[category]) throw new Error(`无效的餐次类别: ${category}`);

  const mealRecordId = await ensureMealRecord(userId, date, category);

  const { data: created, error } = await supabase
    .from('meal_items')
    .insert({
      meal_record_id: mealRecordId,
      name: item.name,
      calories: item.calories,
      protein: item.protein || 0,
      carbs: item.carbs || 0,
      fat: item.fat || 0,
      portion: item.portion || '1份',
      image: item.image || null,
    })
    .select('id, name, calories, protein, carbs, fat, portion, image')
    .single();

  if (error || !created) throw new Error('添加食物失败');
  return created;
}

export async function deleteMealItem(itemId: string): Promise<void> {
  // Delete directly — RLS policies on meal_items enforce ownership via meal_records join
  const { error } = await supabase.from('meal_items').delete().eq('id', itemId);
  if (error) throw new Error('删除失败');
}

// ==================== Workouts ====================

export async function getWorkouts(from: string, to: string): Promise<Record<string, WorkoutItem[]>> {
  const userId = await getUserId();

  const { data: entries, error } = await supabase
    .from('workout_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('created_at', { ascending: false });

  if (error) throw new Error('查询运动记录失败');

  const workoutsByDay: Record<string, WorkoutItem[]> = {};
  for (const w of entries || []) {
    if (!workoutsByDay[w.entry_date]) workoutsByDay[w.entry_date] = [];
    workoutsByDay[w.entry_date].push({
      id: w.id,
      type: w.type,
      duration: w.duration,
      calories: w.calories,
      intensity: w.intensity,
      category: w.category,
      time: w.time_of_day,
      distance: w.distance,
    });
  }

  return workoutsByDay;
}

export async function addWorkout(date: string, workout: Omit<WorkoutItem, 'id'>): Promise<WorkoutItem> {
  const userId = await getUserId();

  const { data: entry, error } = await supabase
    .from('workout_entries')
    .insert({
      user_id: userId,
      entry_date: date,
      type: workout.type,
      duration: workout.duration,
      calories: workout.calories,
      intensity: workout.intensity,
      category: workout.category,
      time_of_day: workout.time || null,
      distance: workout.distance || null,
    })
    .select('*')
    .single();

  if (error || !entry) throw new Error('添加运动失败');

  return {
    id: entry.id,
    type: entry.type,
    duration: entry.duration,
    calories: entry.calories,
    intensity: entry.intensity,
    category: entry.category,
    time: entry.time_of_day,
    distance: entry.distance,
  };
}

export async function deleteWorkout(id: string): Promise<void> {
  const userId = await getUserId();

  // Verify ownership
  const { data: existing } = await supabase
    .from('workout_entries')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!existing) throw new Error('运动记录未找到');
  if (existing.user_id !== userId) throw new Error('无权删除');

  const { error } = await supabase.from('workout_entries').delete().eq('id', id);
  if (error) throw new Error('删除失败');
}

// ==================== Water ====================

export async function getWater(from: string, to: string): Promise<Record<string, number>> {
  const userId = await getUserId();

  const { data, error } = await supabase
    .from('water_intakes')
    .select('entry_date, amount_ml')
    .eq('user_id', userId)
    .gte('entry_date', from)
    .lte('entry_date', to);

  if (error) throw new Error('查询饮水记录失败');

  const intakes: Record<string, number> = {};
  for (const e of data || []) {
    intakes[e.entry_date] = e.amount_ml;
  }
  return intakes;
}

export async function setWater(date: string, amount: number, mode: 'set' | 'add' = 'set'): Promise<void> {
  const userId = await getUserId();

  if (mode === 'add') {
    const { data: existing } = await supabase
      .from('water_intakes')
      .select('amount_ml')
      .eq('user_id', userId)
      .eq('entry_date', date)
      .maybeSingle();

    const current = existing?.amount_ml || 0;
    const newAmount = Math.min(4000, current + amount);

    const { error } = await supabase
      .from('water_intakes')
      .upsert({ user_id: userId, entry_date: date, amount_ml: newAmount }, { onConflict: 'user_id,entry_date' });

    if (error) throw new Error('更新饮水失败');
  } else {
    const { error } = await supabase
      .from('water_intakes')
      .upsert({ user_id: userId, entry_date: date, amount_ml: Math.max(0, amount) }, { onConflict: 'user_id,entry_date' });

    if (error) throw new Error('更新饮水失败');
  }
}

// ==================== User Metrics (动态 BMR/TDEE) ====================

export interface UserMetrics {
  user_id: string;
  current_weight: number;
  bmr: number;
  tdee: number;
  updated_at: string;
}

/** 读取数据库计算的最新 BMR/TDEE */
export async function getUserMetrics(): Promise<UserMetrics | null> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('user_metrics')
    .select('user_id, current_weight, bmr, tdee, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

/** 手动触发后端重算 BMR/TDEE（首次加载或数据同步后调用） */
export async function recalculateMetrics(): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase.rpc('update_metrics_for_user', { p_user_id: userId });
  if (error) console.error('重算 metrics 失败:', error);
}

// ==================== Weight Predictions（体重预测） ====================

export interface WeightPrediction {
  user_id: string;
  predicted_weight_7d_jin: number;
  predicted_weight_30d_jin: number;
  base_weight_kg: number;
  avg_daily_surplus: number;
  updated_at: string;
}

/** 读取数据库计算的最新体重预测 */
export async function getWeightPredictions(): Promise<WeightPrediction | null> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('weight_predictions')
    .select('user_id, predicted_weight_7d_jin, predicted_weight_30d_jin, base_weight_kg, avg_daily_surplus, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

/** 手动触发后端重算体重预测 */
export async function recalculatePredictions(): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase.rpc('update_weight_prediction', { p_user_id: userId });
  if (error) console.error('重算预测失败:', error);
}

export async function saveAnalysis(analysis: AIDietAnalysis): Promise<{ id: string }> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('ai_analyses')
    .insert({ user_id: userId, analysis_data: analysis })
    .select('id')
    .single();

  if (error || !data) throw new Error('保存分析失败');
  return { id: data.id };
}

export async function getRecentAnalyses(limit = 10): Promise<AIDietAnalysis[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('ai_analyses')
    .select('analysis_data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error('查询分析记录失败');
  return (data || []).map((r) => r.analysis_data);
}

// ==================== Food Composition Search & Analyze ====================

/** 获取认证 Header（供 Express API 调用） */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * 搜索食物成分表（RAG 检索）。
 * 调用 Express 后端 /api/food/search
 */
export async function searchFood(query: string, limit = 5): Promise<FoodCompositionResult[]> {
  const res = await fetch(
    `${API_BASE}/api/food/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '食物搜索失败');
  }
  const data = await res.json();
  return data.results || [];
}

/**
 * 食物营养分析：AI 识别 + 食物成分表查询 + 联网搜索。
 * 调用 Express 后端 /api/food/analyze
 */
export async function analyzeFood(
  foodName: string,
  weight?: number
): Promise<FoodAnalyzeResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await getAuthHeaders()),
  };
  const res = await fetch(`${API_BASE}/api/food/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ foodName, weight }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '食物分析失败');
  }
  return res.json();
}

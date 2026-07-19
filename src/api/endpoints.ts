import { api } from './client';
import type { User, MealRecord, MealItem, MealCategory, WorkoutItem, WeightEntry, AIDietAnalysis } from '../types';

// ==================== Auth / Profile ====================

export async function getProfile(): Promise<User & { id: string }> {
  const { user } = await api.get<{
    user: { id: string; username: string; avatarUrl: string; height: number; weight: number | null };
  }>('/auth/me');
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    height: user.height || 178,
    weight: user.weight || 72.5,
  };
}

export async function updateProfile(data: {
  username?: string;
  avatarUrl?: string;
  height?: number;
}): Promise<void> {
  await api.put('/profile', data);
}

// ==================== Weights ====================

export async function getWeights(
  from: string,
  to: string
): Promise<WeightEntry[]> {
  const { entries } = await api.get<{
    entries: { id: string; entryDate: string; weight: number }[];
  }>(`/weights?from=${from}&to=${to}`);

  return entries.map((e) => ({
    day: e.entryDate,
    weight: e.weight,
  }));
}

export async function upsertWeight(date: string, weight: number): Promise<void> {
  await api.post('/weights', { date, weight });
}

// ==================== Meals ====================

export async function getMeals(
  from: string,
  to: string
): Promise<Record<string, MealRecord[]>> {
  const { mealsByDay } = await api.get<{
    mealsByDay: Record<string, MealRecord[]>;
  }>(`/meals?from=${from}&to=${to}`);

  return mealsByDay || {};
}

export async function addMealItem(
  date: string,
  category: MealCategory,
  item: Omit<MealItem, 'id'>
): Promise<MealItem> {
  const { item: created } = await api.post<{ item: MealItem }>('/meals/items', {
    date,
    category,
    item,
  });
  return created;
}

export async function deleteMealItem(itemId: string): Promise<void> {
  await api.delete(`/meals/items/${itemId}`);
}

// ==================== Workouts ====================

export async function getWorkouts(
  from: string,
  to: string
): Promise<Record<string, WorkoutItem[]>> {
  const { workoutsByDay } = await api.get<{
    workoutsByDay: Record<string, WorkoutItem[]>;
  }>(`/workouts?from=${from}&to=${to}`);

  return workoutsByDay || {};
}

export async function addWorkout(
  date: string,
  workout: Omit<WorkoutItem, 'id'>
): Promise<WorkoutItem> {
  const { workout: created } = await api.post<{ workout: WorkoutItem }>('/workouts', {
    date,
    ...workout,
  });
  return created;
}

export async function deleteWorkout(id: string): Promise<void> {
  await api.delete(`/workouts/${id}`);
}

// ==================== Water ====================

export async function getWater(
  from: string,
  to: string
): Promise<Record<string, number>> {
  const { intakes } = await api.get<{ intakes: Record<string, number> }>(
    `/water?from=${from}&to=${to}`
  );
  return intakes || {};
}

export async function setWater(
  date: string,
  amount: number,
  mode: 'set' | 'add' = 'set'
): Promise<void> {
  await api.put(`/water?mode=${mode}`, { date, amount });
}

// ==================== AI Analyses ====================

export async function saveAnalysis(
  analysis: AIDietAnalysis
): Promise<{ id: string }> {
  const { analysis: saved } = await api.post<{ analysis: { id: string } }>('/analyses', analysis);
  return saved;
}

export async function getRecentAnalyses(limit = 10): Promise<AIDietAnalysis[]> {
  const { analyses } = await api.get<{ analyses: AIDietAnalysis[] }>(
    `/analyses?limit=${limit}`
  );
  return analyses;
}

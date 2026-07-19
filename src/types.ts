export type PageType = 'home' | 'diet' | 'exercise' | 'analysis' | 'ai-result' | 'login';

export interface User {
  username: string;
  avatarUrl: string;
  height: number;
  weight: number;
}

export interface MealItem {
  id: string;
  name: string;
  calories: number;
  protein: number; // in grams
  carbs: number;   // in grams
  fat: number;     // in grams
  portion: string;
  image?: string;
}

export type MealCategory = 'breakfast' | 'lunch' | 'dinner';

export interface MealRecord {
  category: MealCategory;
  name: string; // "早餐" etc.
  icon: string;
  items: MealItem[];
}

export interface WorkoutItem {
  id: string;
  type: string;
  duration: string; // e.g. "32'15\""
  calories: number;
  intensity: 'low' | 'medium' | 'high' | 'medium-high'; // 中, 高, 中高等
  category: 'aerobic' | 'resistance'; // 有氧, 抗阻
  time: string; // e.g. "今天 07:30"
  distance?: string; // e.g. "5.2 公里"
}

export interface WeightEntry {
  day: string;
  weight: number;
  isToday?: boolean;
}

export interface AIRecpIngredient {
  name: string;
  portion: string;
  calories: number;
}

export interface AIDietAnalysis {
  name: string;
  calories: number;
  protein: { amount: number; percentage: number };
  carbs: { amount: number; percentage: number };
  fat: { amount: number; percentage: number };
  suggestions: {
    optimization: string;
    exercise: string;
  };
  ingredients: AIRecpIngredient[];
  image: string;
}

export type PageType = 'home' | 'diet' | 'exercise' | 'analysis' | 'ai-result';

export interface User {
  username: string;
  avatarUrl: string;
  height: number;
  weight: number;
  gender?: 'male' | 'female';
  age?: number;
  activityLevel?: import('./utils/metabolism').ActivityLevel;
  hasCompletedSurvey?: boolean;
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

// 食物成分表搜索结果（每 100g 数据）
export interface FoodCompositionResult {
  food_code: string;
  food_name: string;
  category: string;
  subcategory: string | null;
  energy_kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

// 食物营养分析结果（AI 计算后）
export interface FoodAnalyzeResult {
  foodName: string;
  matchedFood: string | null;
  category: string | null;
  weight: number;
  source: 'database' | 'ai_estimated' | 'database_fallback';
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  per100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
  suggestion: string | null;
  exercise: string | null;
}

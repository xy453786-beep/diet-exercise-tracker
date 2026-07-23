// ============================================================
// 食物识别管线 — 共享类型定义（v3: Qwen-VL-Plus + 食物成分表）
// ============================================================

/** 食物成分表查询结果 */
export interface FoodCompositionMatch {
  food_name: string;
  category: string;
  energy_kcal: number;   // per 100g
  protein: number;        // per 100g
  fat: number;            // per 100g
  carbs: number;          // per 100g
}

/** Pipeline 各数据源返回的结果 */
export interface SourceResult {
  food_name: string;
  brand: string | null;
  barcode: string | null;
  net_weight_g: number;
  energy_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  per100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
  source:
    | 'barcode_scan'
    | 'open_food_facts'
    | 'food_analyzer'
    | 'food_composition'
    | 'snack_search'
    | 'cache';
  confidence: 'high' | 'medium' | 'low';
  suggestion: string | null;
}

/** 缓存记录 */
export interface CachedFood {
  id: number;
  food_name: string;
  brand: string | null;
  barcode: string | null;
  net_weight_g: number;
  energy_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  per100g: Record<string, number> | null;
  source: string;
  is_user_calibrated: boolean;
  user_calories: number | null;
  user_weight_g: number | null;
  lookup_count: number;
}

/** API 返回给前端的最终结果 */
export interface AnalysisResult {
  identification: {
    food_name: string;
    brand: string | null;
    food_type: string | null;
    cooking_method: string | null;
    confidence: string;
    notes: string | null;
    barcode: string | null;
  };
  mealName: string;
  matchedFood: string | null;
  category: string | null;
  weight: number;
  source: string;
  ingredients: Array<{
    name: string;
    weight: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
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
  debug_message?: string;
}

export interface ZhipuIngredient {
  name: string;
  weight: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ZhipuFoodAnalysis {
  mealName: string;
  ingredients: ZhipuIngredient[];
  suggestion: string;
  exercise: string;
  source?: string;
  foodType?: string;
  cookingMethod?: string;
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

/**
 * 通过后端 API 分析食物图片。
 *
 * 流程：图片 data URL → 后端 POST /api/food/analyze-image
 * 后端将 data URL 上传到 Supabase Storage → 执行识别管线
 *
 * 不依赖 Supabase Auth，无需 token。
 */
export async function analyzeFoodImageBackend(
  imageDataUrl: string
): Promise<ZhipuFoodAnalysis> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(`${API_BASE}/api/food/analyze-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl: imageDataUrl }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err as any)?.error || `API 请求失败 (${response.status})`;
    throw new Error(msg);
  }

  const data = await response.json();

  // 转换为 ZhipuFoodAnalysis 兼容格式
  if (!data.mealName && data.identification?.food_name) {
    data.mealName = data.identification.food_name;
  }
  if (!data.ingredients?.length) {
    data.ingredients = [
      {
        name: data.mealName || '未知食物',
        weight: data.weight || 0,
        calories: data.nutrition?.calories || 0,
        protein: data.nutrition?.protein || 0,
        carbs: data.nutrition?.carbs || 0,
        fat: data.nutrition?.fat || 0,
      },
    ];
  }

  return {
    mealName: data.mealName || '未知食物',
    ingredients: data.ingredients || [],
    suggestion: data.suggestion || '',
    exercise: data.exercise || '',
    source: data.source || 'food_analyzer',
    foodType: data.identification?.food_type || undefined,
    cookingMethod: data.identification?.cooking_method || undefined,
  };
}

/**
 * 保存用户手动校正的营养数据到后端缓存。
 * 标注 is_user_calibrated = true，下次相同食物优先返回校正值。
 */
export async function saveFoodCorrection(data: {
  foodName: string;
  brand?: string;
  weight?: number;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/food/cache/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      console.warn('保存校正数据失败:', await response.json().catch(() => ({})));
    }
  } catch (err) {
    console.warn('保存校正数据异常:', err);
  }
}

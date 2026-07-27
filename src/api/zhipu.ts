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

import { supabase } from './client';

/**
 * Upload a base64 image to Supabase Storage and return the public URL.
 */
async function uploadImageToStorage(imageDataUrl: string): Promise<string> {
  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const fileName = `food-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage
    .from('food-photos')
    .upload(fileName, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) throw new Error(`图片上传失败: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from('food-photos')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * 通过后端 API 分析食物图片。
 * 流程：上传图片到 Supabase Storage → 调用后端 POST /api/food/analyze-image
 * 后端管线：条码扫描 → Qwen-VL 识别 → 缓存 → 成分表 → 联网搜索 → 兜底
 */
export async function analyzeFoodImageBackend(
  imageDataUrl: string
): Promise<ZhipuFoodAnalysis> {
  const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

  // Step 1: 获取认证状态（有 session 时用于上传图片到 Supabase Storage）
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  // Step 2: 上传图片到 Supabase Storage（有 session 时优先使用存储 URL）
  let imageUrl: string;
  try {
    imageUrl = await uploadImageToStorage(imageDataUrl);
  } catch {
    // 无 Supabase session 时使用原始 data URL 直传后端处理
    imageUrl = imageDataUrl;
  }

  // Step 3: 调用后端分析接口（15s 超时以适应联网搜索）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/food/analyze-image`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imageUrl }),
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
  const API_BASE = (import.meta as any).env?.VITE_API_URL || '';
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    console.warn('离线模式，跳过保存校正数据');
    return;
  }

  const response = await fetch(`${API_BASE}/api/food/cache/correct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    console.warn('保存校正数据失败:', await response.json().catch(() => ({})));
  }
}

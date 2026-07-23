// ============================================================
// 缓存层：food_cache 表读写
// ============================================================

import { supabaseAdmin } from '../../../supabase/client.js';
import type { CachedFood, SourceResult } from '../types.js';

/**
 * 按食物名称精确查找已缓存的营养数据（零食搜索专用）。
 * 命中后直接返回，跳过联网搜索。
 */
export async function lookupSnackCache(foodName: string): Promise<SourceResult | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('food_cache')
      .select('*')
      .eq('food_name', foodName)
      .maybeSingle();

    if (error) {
      console.error('[cache] lookupSnackCache 查询错误:', error.message);
      return null;
    }

    if (!data) {
      console.log(`[cache] 🔍 零食缓存查询: "${foodName}" → 未命中`);
      return null;
    }

    // 跳过零热量缓存数据
    if (data.energy_kcal <= 0) {
      console.log(`[cache] ⚠️ 零食缓存: "${foodName}" → 热量为 0，跳过`);
      return null;
    }

    console.log(
      `[cache] ✅ 零食缓存命中: "${foodName}" → ` +
      `${data.net_weight_g}g × ${Math.round(data.energy_kcal)}kcal ` +
      `(source: ${data.source}, lookup_count: ${data.lookup_count})`
    );

    // 更新查询计数
    try {
      await supabaseAdmin
        .from('food_cache')
        .update({
          lookup_count: (data.lookup_count || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id);
    } catch {
      // 非关键操作
    }

    return cachedToResult(data as CachedFood);
  } catch (err) {
    console.error('[cache] lookupSnackCache 异常:', err);
    return null;
  }
}

/**
 * 写入缓存（数据库）
 */
export async function saveToCache(result: SourceResult): Promise<void> {
  try {
    const now = new Date().toISOString();

    await supabaseAdmin.from('food_cache').upsert(
      {
        food_name: result.food_name,
        brand: result.brand || null,
        barcode: result.barcode || null,
        net_weight_g: result.net_weight_g,
        energy_kcal: result.energy_kcal,
        protein_g: result.protein_g,
        carbs_g: result.carbs_g,
        fat_g: result.fat_g,
        per100g: result.per100g,
        source: result.source,
        is_user_calibrated: false,
        lookup_count: 1,
        updated_at: now,
      },
      {
        onConflict: 'food_name,COALESCE(brand, \'\')',
        ignoreDuplicates: false,
      }
    );
  } catch (err) {
    console.error('[cache] saveToCache 异常:', err);
  }
}

/**
 * 保存用户校正
 */
export async function saveUserCorrection(
  foodName: string,
  brand: string | null,
  calories: number,
  weight: number,
  protein?: number,
  carbs?: number,
  fat?: number
): Promise<void> {
  try {
    const now = new Date().toISOString();
    await supabaseAdmin.from('food_cache').upsert(
      {
        food_name: foodName,
        brand: brand || null,
        net_weight_g: weight,
        energy_kcal: calories,
        protein_g: protein || 0,
        carbs_g: carbs || 0,
        fat_g: fat || 0,
        source: 'cache',
        is_user_calibrated: true,
        user_calories: calories,
        user_weight_g: weight,
        updated_at: now,
      },
      {
        onConflict: 'food_name,COALESCE(brand, \'\')',
        ignoreDuplicates: false,
      }
    );
  } catch (err) {
    console.error('[cache] saveUserCorrection 异常:', err);
  }
}

// ---- helpers ----

function cachedToResult(entry: CachedFood): SourceResult {
  const per100g = (entry.per100g as Record<string, number> | null) || null;

  // 用户校正过的用校正值
  const calories = entry.is_user_calibrated && entry.user_calories
    ? entry.user_calories
    : entry.energy_kcal;
  const weight = entry.is_user_calibrated && entry.user_weight_g
    ? entry.user_weight_g
    : entry.net_weight_g;

  // 检测零值：缓存数据可能不完整
  const hasZeroCalories = calories <= 0;

  return {
    food_name: entry.food_name,
    brand: entry.brand,
    barcode: entry.barcode || null,
    net_weight_g: weight,
    energy_kcal: calories,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    per100g: per100g
      ? {
          calories: per100g.calories || 0,
          protein: per100g.protein || 0,
          carbs: per100g.carbs || 0,
          fat: per100g.fat || 0,
        }
      : null,
    source: entry.is_user_calibrated ? 'cache' : (entry.source as SourceResult['source']),
    confidence: entry.is_user_calibrated ? 'high' : 'medium',
    suggestion: entry.is_user_calibrated
      ? `「${entry.food_name}」每份${weight}g，共${Math.round(calories)}kcal（用户校正数据）`
      : hasZeroCalories
        ? `「${entry.food_name}」缓存热量为 0（数据可能不完整），将使用默认值兜底`
        : `「${entry.food_name}」每份${weight}g，共${Math.round(calories)}kcal（缓存数据）`,
  };
}

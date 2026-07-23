// ============================================================
// ② 条形码识别 → Open Food Facts API
// 免费，无需 API Key，300万+商品
// ============================================================

import type { SourceResult } from '../types.js';

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';

/**
 * 通过条形码查询 Open Food Facts
 */
export async function lookupOpenFoodFacts(barcode: string): Promise<SourceResult | null> {
  if (!barcode || barcode.length < 8) return null;

  try {
    const url = `${OFF_BASE}/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_zh,brands,nutriments,quantity,serving_size`;

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'DietTrackerApp/1.0 (contact@example.com)',
      },
    });

    if (!resp.ok) {
      console.log(`[barcode] OFF API ${resp.status} for ${barcode}`);
      return null;
    }

    const data = await resp.json();

    // OFF 用 status=0 表示未找到，status=1 表示找到
    if (data.status !== 1 || !data.product) {
      console.log(`[barcode] 商品未找到: ${barcode}`);
      return null;
    }

    const p = data.product;

    // 食品名称：优先中文名
    const foodName = (p.product_name_zh || p.product_name || '').trim();
    if (!foodName) return null;

    // 每100g 营养值
    const nutriments = p.nutriments || {};

    // 热量：优先用 energy-kcal_100g（OFF 的标准字段）
    const kcalPer100g =
      nutriments['energy-kcal_100g'] ||
      nutriments.energy_kcal_100g ||
      (nutriments.energy_100g ? nutriments.energy_100g / 4.184 : null); // kJ → kcal

    if (!kcalPer100g || kcalPer100g <= 0) return null;

    const proteinPer100g = nutriments.proteins_100g || nutriments.proteins || 0;
    const carbsPer100g = nutriments.carbohydrates_100g || nutriments.carbohydrates || 0;
    const fatPer100g = nutriments.fat_100g || nutriments.fat || 0;

    // 净含量解析
    let netWeightG = 100; // 默认100g
    const quantity = p.quantity || '';
    const weightMatch = quantity.match(/(\d+)\s*g/i);
    if (weightMatch) {
      netWeightG = parseInt(weightMatch[1], 10);
    }

    // 如果有 serving_size，用 serving 值
    const servingStr = p.serving_size || '';
    const servingMatch = servingStr.match(/(\d+)/);
    const servingSizeG = servingMatch ? parseInt(servingMatch[1], 10) : null;

    const finalWeightG = servingSizeG || netWeightG;
    const ratio = finalWeightG / 100;

    const totalCalories = Math.round(kcalPer100g * ratio);

    return {
      food_name: foodName,
      brand: (p.brands || '').split(',')[0]?.trim() || null,
      barcode: barcode,
      net_weight_g: finalWeightG,
      energy_kcal: totalCalories,
      protein_g: parseFloat((proteinPer100g * ratio).toFixed(1)),
      carbs_g: parseFloat((carbsPer100g * ratio).toFixed(1)),
      fat_g: parseFloat((fatPer100g * ratio).toFixed(1)),
      per100g: {
        calories: Math.round(kcalPer100g),
        protein: parseFloat(Number(proteinPer100g).toFixed(1)),
        carbs: parseFloat(Number(carbsPer100g).toFixed(1)),
        fat: parseFloat(Number(fatPer100g).toFixed(1)),
      },
      source: 'open_food_facts',
      confidence: 'high',
      suggestion: `「${foodName}」每份${finalWeightG}g，共${totalCalories}kcal（数据来源：Open Food Facts）`,
    };
  } catch (err) {
    console.error('[barcode] OFF 查询异常:', err);
    return null;
  }
}

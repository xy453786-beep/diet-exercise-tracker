// ============================================================
// 食物识别管线 v6 — Qwen-VL-Plus 识别 + 缓存 + DB + 百炼联网搜索 + 兜底
//
// Stage 0: zxing 条码扫描 → Open Food Facts
// Stage 1: Qwen-VL-Plus 识别食物完整名称（品牌+品类+口味）
// Stage 2: food_cache 零食名精确缓存命中（≤0.1s）
// Stage 3: food_composition 表多级模糊查询营养成分
// Stage 4: 百炼 Web Search 联网搜索零食营养（仅零食触发，四步校验 Prompt）
// Stage 5: 分类兜底估算
//
// 每次请求都重新识别+查库
// ============================================================

import type { AnalysisResult, SourceResult } from './types.js';
import { scanImageForBarcodes } from './sources/barcode-scan.js';
import { lookupOpenFoodFacts } from './sources/barcode.js';
import { callFoodNameRecognizer } from './sources/food-analyzer.js';
import { lookupFoodComposition, getDefaultPortion } from './sources/food-composition-lookup.js';
import {
  saveToCache,
  lookupSnackCache,
} from './sources/cache.js';
import { searchSnackNutrition, isSnackFood } from './sources/snack-search.js';

/** 兜底默认热量值：kcal/100g（当所有数据源都返回 0 时使用） */
const FALLBACK_KCAL_PER_100G = 200;

/** 来源中文标签映射 */
const SOURCE_LABELS: Record<string, string> = {
  barcode_scan: '条码扫描 · Open Food Facts',
  open_food_facts: 'Open Food Facts 条码识别',
  food_analyzer: 'AI 食物分析',
  food_composition: '中国食物成分表',
  snack_search: 'AI 联网搜索',
  cache: '缓存命中',
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] || source;
}

/**
 * 主编排函数：分析食物图片并返回营养数据
 */
export async function runPipeline(imageUrl: string): Promise<AnalysisResult> {
  // ==========================================
  // Stage 0: zxing 条码扫描（快速通道）
  // ==========================================
  console.log('[pipeline] Stage 0: zxing 条码扫描...');

  const barcodes = await scanImageForBarcodes(imageUrl);
  if (barcodes.length > 0) {
    const barcodeNumber = barcodes[0];
    console.log(`[pipeline] ✅ 检测到条码: ${barcodeNumber}`);

    const offResult = await lookupOpenFoodFacts(barcodeNumber);
    if (offResult) {
      console.log(`[pipeline] ✅ OFF 命中! ${offResult.food_name} × ${offResult.net_weight_g}g = ${offResult.energy_kcal}kcal`);
      await saveToCache(offResult);
      return buildBarcodeResponse(offResult, barcodeNumber);
    }
    console.log('[pipeline] OFF 未命中，继续...');
  } else {
    console.log('[pipeline] 未检测到条码');
  }

  // ==========================================
  // Stage 1: Qwen-VL-Plus 识别食物完整名称
  // ==========================================
  console.log('[pipeline] Stage 1: Qwen-VL-Plus 识别食物名称...');

  let foodName: string;
  try {
    foodName = await callFoodNameRecognizer(imageUrl);
    console.log(`[pipeline] ✅ 识别结果: "${foodName}"`);
  } catch (err: any) {
    console.error('[pipeline] 识别失败:', err.message);
    return emptyResult('食物识别服务暂时不可用');
  }

  // ==========================================
  // Stage 2: 查 food_cache（零食名精确缓存，≤0.1s）
  // ==========================================
  console.log(`[pipeline] Stage 2: 查零食名缓存 "${foodName}"...`);

  const cached = await lookupSnackCache(foodName);
  if (cached && cached.energy_kcal > 0) {
    console.log(
      `[pipeline] ✅ Stage 2 缓存命中: "${cached.food_name}" → ` +
      `${cached.net_weight_g}g × ${cached.energy_kcal}kcal (source: ${cached.source})`
    );
    return buildResponse(cached);
  }

  // ==========================================
  // Stage 3: 查中国食物成分表（多级模糊匹配）
  // ==========================================
  console.log(`[pipeline] Stage 3: 查食物成分表 "${foodName}"...`);

  // 按食物分类获取默认份量 + 兜底热量
  const { portionG: defaultPortion, fallbackKcalPer100g } = getDefaultPortion(foodName);
  console.log(
    `[pipeline] 📏 分类份量: "${foodName}" → ` +
    `portion=${defaultPortion}g, fallbackKcal=${fallbackKcalPer100g}/100g`
  );

  let sourceResult: SourceResult | null = null;

  try {
    const comp = await lookupFoodComposition(foodName);

    if (comp) {
      // ✅ DB 命中：用 DB 营养数据 + 分类默认克重
      const ratio = defaultPortion / 100;

      sourceResult = {
        food_name: comp.food_name,
        brand: null,
        barcode: null,
        net_weight_g: defaultPortion,
        energy_kcal: Math.round(comp.energy_kcal * ratio),
        protein_g: parseFloat((comp.protein * ratio).toFixed(1)),
        carbs_g: parseFloat((comp.carbs * ratio).toFixed(1)),
        fat_g: parseFloat((comp.fat * ratio).toFixed(1)),
        per100g: {
          calories: comp.energy_kcal,
          protein: comp.protein,
          carbs: comp.carbs,
          fat: comp.fat,
        },
        source: 'food_composition',
        confidence: 'high',
        suggestion: `「${comp.food_name}」份量${defaultPortion}g，约${Math.round(comp.energy_kcal * ratio)}kcal（数据来源：中国食物成分表）`,
      };
      console.log(
        `[pipeline] ✅ Stage 3 成分表命中: "${comp.food_name}" ` +
        `${comp.energy_kcal}kcal/100g × ${defaultPortion}g = ${sourceResult.energy_kcal}kcal`
      );
    }
    // DB 未命中 → sourceResult 保持 null，进入 Stage 4
  } catch (err: any) {
    // 🔴 数据库基础设施错误（连接失败 / RLS / 权限）
    console.error(`[pipeline] ❌ Stage 3 数据库异常: ${err.message}`);
    // sourceResult 保持 null，进入 Stage 4/5
  }

  // ==========================================
  // Stage 4: 百炼联网搜索零食营养数据（仅零食触发）
  // ==========================================
  if (!sourceResult) {
    const isSnack = isSnackFood(foodName);

    if (isSnack) {
      console.log(`[pipeline] Stage 4: "${foodName}" 判定为零食，启动联网搜索...`);

      try {
        const snackResult = await searchSnackNutrition(foodName);

        if (snackResult) {
          const weight = snackResult.package_weight_g;
          const kcalPer100 = snackResult.kcal_per_100g;
          const totalKcal = Math.round(weight * kcalPer100 / 100);
          const confidence = snackResult.confidence === 'high' ? 'high' : 'medium';

          // 优先使用联网搜索返回的 suggestion，其次生成兜底文案
          const suggestion =
            snackResult.suggestion ||
            `AI 联网查询到「${foodName}」${weight}g × ${kcalPer100}kcal/100g = ${totalKcal}kcal。数据来源：互联网实时搜索，建议核实包装标注。`;

          sourceResult = {
            food_name: foodName,
            brand: null,
            barcode: null,
            net_weight_g: weight,
            energy_kcal: totalKcal,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
            per100g: {
              calories: kcalPer100,
              protein: 0,
              carbs: 0,
              fat: 0,
            },
            source: 'snack_search',
            confidence: confidence,
            suggestion,
          };

          console.log(
            `[pipeline] ✅ Stage 4 联网搜索命中: "${foodName}" → ` +
            `${weight}g × ${kcalPer100}/100 = ${totalKcal}kcal ` +
            `(${snackResult.source_type}, ${snackResult.confidence})`
          );
        } else {
          console.log(`[pipeline] ⚠️ Stage 4 联网搜索无结果: "${foodName}"`);
        }
      } catch (err: any) {
        console.error(`[pipeline] ❌ Stage 4 AI 查询异常: "${foodName}"`, err.message);
      }
    } else {
      console.log(`[pipeline] "${foodName}" 非零食，跳过 Stage 4 联网搜索`);
    }
  }

  // ==========================================
  // Stage 5: 分类兜底估算（所有途径均失败时）
  // ==========================================
  if (!sourceResult) {
    const estimatedKcal = Math.round(defaultPortion * fallbackKcalPer100g / 100);
    sourceResult = {
      food_name: foodName,
      brand: null,
      barcode: null,
      net_weight_g: defaultPortion,
      energy_kcal: estimatedKcal,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      per100g: { calories: fallbackKcalPer100g, protein: 0, carbs: 0, fat: 0 },
      source: 'food_composition',
      confidence: 'low',
      suggestion: `未在数据库中找到「${foodName}」，使用估算值 ${estimatedKcal}kcal（${defaultPortion}g × ${fallbackKcalPer100g}kcal/100g），请核实后手动调整`,
    };
    console.log(
      `[pipeline] ⚠️ Stage 5 分类兜底: "${foodName}" → ` +
      `估算 ${estimatedKcal}kcal (${defaultPortion}g × ${fallbackKcalPer100g}kcal/100g)`
    );
  }

  await saveToCache(sourceResult);
  return buildResponse(sourceResult);
}

// ==========================================
// 构建 AnalysisResult
// ==========================================

function buildResponse(source: SourceResult): AnalysisResult {
  const grams = source.net_weight_g || 100;
  const per100gCalories = source.per100g?.calories || 0;

  console.log(
    `[buildResponse] 📥 输入: food="${source.food_name}" ` +
    `energy_kcal=${source.energy_kcal} weight=${grams}g ` +
    `per100g=${per100gCalories} source=${source.source} confidence=${source.confidence}`
  );

  // 热量直接使用 source.energy_kcal（DB 命中时是精算值，未命中时是估算值）
  // 不再强制清零！
  const effectiveKcal = source.energy_kcal > 0
    ? source.energy_kcal
    : Math.round(grams * per100gCalories / 100);

  const hasRealData = source.energy_kcal > 0 && source.per100g !== null;
  const usedFallback = !hasRealData;

  if (usedFallback) {
    console.log(
      `[buildResponse] ⚠️ 使用估算值: source.energy_kcal=${source.energy_kcal} ` +
      `→ effectiveKcal=${effectiveKcal} (${grams}g × ${per100gCalories}/100)`
    );
  } else {
    console.log(
      `[buildResponse] ✅ 精算值: effectiveKcal=${effectiveKcal} ` +
      `(= ${source.energy_kcal} kcal / ${grams}g)`
    );
  }

  const nutrition = {
    calories: effectiveKcal,
    protein: source.protein_g || 0,
    carbs: source.carbs_g || 0,
    fat: source.fat_g || 0,
  };

  const exerciseMinutes = effectiveKcal > 0 ? Math.round(effectiveKcal / 6) : 0;
  const exercise = exerciseMinutes > 0
    ? `约需慢跑 ${exerciseMinutes} 分钟消耗此热量`
    : null;

  const per100g = source.per100g
    ? {
        calories: source.per100g.calories || 0,
        protein: source.per100g.protein || 0,
        carbs: source.per100g.carbs || 0,
        fat: source.per100g.fat || 0,
      }
    : {
        calories: Math.round(effectiveKcal / grams * 100),
        protein: 0,
        carbs: 0,
        fat: 0,
      };

  const foodCategory = classifyFoodSimple(source.food_name);

  const debugParts: string[] = [
    `来源: ${source.source}|${sourceLabel(source.source)}`,
    `计算: ${grams}g × ${per100gCalories || '?'}/100 = ${effectiveKcal}kcal`,
    `兜底: ${usedFallback ? '是（估算值）' : '否（DB精算）'}`,
    `confidence: ${source.confidence}`,
  ];

  const result: AnalysisResult = {
    identification: {
      food_name: source.food_name,
      brand: source.brand,
      food_type: source.source === 'food_composition' ? 'homemade' : null,
      cooking_method: null,
      confidence: source.confidence,
      notes: null,
      barcode: source.barcode,
    },
    mealName: source.food_name,
    matchedFood: source.food_name,
    category: foodCategory,
    weight: grams,
    source: `${source.source}|${sourceLabel(source.source)}`,
    ingredients: [
      {
        name: source.food_name,
        weight: grams,
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
      },
    ],
    nutrition,
    per100g,
    suggestion: source.suggestion,
    exercise,
    debug_message: debugParts.join(' | '),
  };

  console.log(
    `[buildResponse] 📤 输出: calories=${result.nutrition.calories}kcal ` +
    `weight=${result.weight}g category=${result.category} ` +
    `confidence=${result.identification.confidence} usedFallback=${usedFallback}`
  );

  return result;
}

function buildBarcodeResponse(
  source: SourceResult,
  barcodeNumber: string
): AnalysisResult {
  const grams = source.net_weight_g || 100;

  const usedFallback = source.energy_kcal <= 0;
  const effectiveKcal = usedFallback
    ? Math.round(grams * FALLBACK_KCAL_PER_100G / 100)
    : source.energy_kcal;

  const nutrition = {
    calories: effectiveKcal,
    protein: usedFallback ? 0 : source.protein_g,
    carbs: usedFallback ? 0 : source.carbs_g,
    fat: usedFallback ? 0 : source.fat_g,
  };

  const exerciseMinutes = effectiveKcal > 0 ? Math.round(effectiveKcal / 6) : 0;
  const exercise = exerciseMinutes > 0
    ? `约需慢跑 ${exerciseMinutes} 分钟消耗此热量`
    : null;

  const per100g = usedFallback
    ? { calories: FALLBACK_KCAL_PER_100G, protein: 0, carbs: 0, fat: 0 }
    : (source.per100g || { calories: Math.round(effectiveKcal / grams * 100), protein: 0, carbs: 0, fat: 0 });

  const foodCategory = classifyFoodSimple(source.food_name);

  return {
    identification: {
      food_name: source.food_name,
      brand: source.brand,
      food_type: 'packaged',
      cooking_method: null,
      confidence: 'high',
      notes: null,
      barcode: barcodeNumber,
    },
    mealName: source.food_name,
    matchedFood: source.food_name,
    category: foodCategory,
    weight: grams,
    source: `barcode_scan|${sourceLabel('barcode_scan')}`,
    ingredients: [
      {
        name: source.food_name,
        weight: grams,
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
      },
    ],
    nutrition,
    per100g,
    suggestion: usedFallback
      ? `条码数据热量缺失，已使用默认值 ${effectiveKcal}kcal`
      : source.suggestion,
    exercise,
    debug_message: `来源: barcode_scan | 条码: ${barcodeNumber} | food_name: ${source.food_name} | energy_kcal: ${source.energy_kcal} | 兜底: ${usedFallback ? `是（使用 ${FALLBACK_KCAL_PER_100G} kcal/100g）` : '否'}`,
  };
}

function emptyResult(message: string): AnalysisResult {
  const defaultWeight = 200;
  const defaultKcal = Math.round(defaultWeight * FALLBACK_KCAL_PER_100G / 100);

  return {
    identification: {
      food_name: '',
      brand: null,
      food_type: null,
      cooking_method: null,
      confidence: 'low',
      notes: message,
      barcode: null,
    },
    mealName: '未知食物',
    matchedFood: null,
    category: '未知',
    weight: defaultWeight,
    source: 'food_analyzer|AI 分析失败',
    ingredients: [
      {
        name: '未知食物',
        weight: defaultWeight,
        calories: defaultKcal,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
    ],
    nutrition: { calories: defaultKcal, protein: 0, carbs: 0, fat: 0 },
    per100g: { calories: FALLBACK_KCAL_PER_100G, protein: 0, carbs: 0, fat: 0 },
    suggestion: message,
    exercise: defaultKcal > 0 ? `约需慢跑 ${Math.round(defaultKcal / 6)} 分钟消耗此热量` : null,
    debug_message: `来源: emptyResult | 分析失败: ${message} | 兜底: 默认 ${defaultWeight}g × ${FALLBACK_KCAL_PER_100G}/100 = ${defaultKcal}kcal`,
  };
}

/**
 * 文本食物分析：纯文本食物名称 → 营养数据
 * 跳过条码扫描和图片识别，直接从 lookup 管线走
 */
export async function analyzeFoodByName(
  foodName: string,
  weight: number = 100
): Promise<{
  foodName: string;
  matchedFood: string | null;
  category: string | null;
  weight: number;
  source: 'database' | 'ai_estimated' | 'database_fallback';
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
  per100g: { calories: number; protein: number; carbs: number; fat: number } | null;
  suggestion: string | null;
  exercise: string | null;
}> {
  // ── Stage 2: 查缓存 ──
  const cached = await lookupSnackCache(foodName);
  if (cached && cached.energy_kcal > 0) {
    const kcal = cached.energy_kcal;
    const grams = cached.net_weight_g || weight;
    const per100gCalories = cached.per100g?.calories || Math.round(kcal / grams * 100);
    return {
      foodName: cached.food_name,
      matchedFood: cached.food_name,
      category: classifyFoodSimple(cached.food_name),
      weight: grams,
      source: 'database',
      nutrition: { calories: kcal, protein: cached.protein_g, carbs: cached.carbs_g, fat: cached.fat_g },
      per100g: { calories: per100gCalories, protein: cached.protein_g / grams * 100, carbs: cached.carbs_g / grams * 100, fat: cached.fat_g / grams * 100 },
      suggestion: `缓存数据：「${cached.food_name}」${grams}g，约${kcal}kcal`,
      exercise: kcal > 0 ? `约需慢跑 ${Math.round(kcal / 6)} 分钟消耗此热量` : null,
    };
  }

  // ── Stage 3: 查食物成分表 ──
  const { portionG: defaultPortion, fallbackKcalPer100g } = getDefaultPortion(foodName);
  let sourceResult: SourceResult | null = null;

  try {
    const comp = await lookupFoodComposition(foodName);
    if (comp) {
      const ratio = (weight || defaultPortion) / 100;
      const kcal = Math.round(comp.energy_kcal * ratio);
      sourceResult = {
        food_name: comp.food_name,
        brand: null, barcode: null,
        net_weight_g: weight || defaultPortion,
        energy_kcal: kcal,
        protein_g: parseFloat((comp.protein * ratio).toFixed(1)),
        carbs_g: parseFloat((comp.carbs * ratio).toFixed(1)),
        fat_g: parseFloat((comp.fat * ratio).toFixed(1)),
        per100g: { calories: comp.energy_kcal, protein: comp.protein, carbs: comp.carbs, fat: comp.fat },
        source: 'food_composition',
        confidence: 'high',
        suggestion: `「${comp.food_name}」每100g约${comp.energy_kcal}kcal，${weight || defaultPortion}g约${kcal}kcal（数据来源：中国食物成分表）`,
      };
    }
  } catch { /* fall through */ }

  // ── Stage 4: 联网搜索（仅零食） ──
  if (!sourceResult && isSnackFood(foodName)) {
    try {
      const snackResult = await searchSnackNutrition(foodName);
      if (snackResult) {
        const grams = snackResult.package_weight_g || weight;
        const kcal = Math.round(grams * snackResult.kcal_per_100g / 100);
        sourceResult = {
          food_name: foodName, brand: null, barcode: null,
          net_weight_g: grams, energy_kcal: kcal,
          protein_g: 0, carbs_g: 0, fat_g: 0,
          per100g: { calories: snackResult.kcal_per_100g, protein: 0, carbs: 0, fat: 0 },
          source: 'snack_search',
          confidence: snackResult.confidence === 'high' ? 'high' : 'medium',
          suggestion: snackResult.suggestion || `AI 联网查询到「${foodName}」${grams}g × ${snackResult.kcal_per_100g}kcal/100g = ${kcal}kcal`,
        };
      }
    } catch { /* fall through */ }
  }

  // ── Stage 5: 兜底 ──
  if (!sourceResult) {
    const grams = weight || defaultPortion;
    const kcal = Math.round(grams * fallbackKcalPer100g / 100);
    sourceResult = {
      food_name: foodName, brand: null, barcode: null,
      net_weight_g: grams, energy_kcal: kcal,
      protein_g: 0, carbs_g: 0, fat_g: 0,
      per100g: { calories: fallbackKcalPer100g, protein: 0, carbs: 0, fat: 0 },
      source: 'food_composition',
      confidence: 'low',
      suggestion: `未在数据库中找到「${foodName}」，使用估算值 ${kcal}kcal（${grams}g × ${fallbackKcalPer100g}kcal/100g）`,
    };
  }

  // 缓存结果
  await saveToCache(sourceResult).catch(() => {});

  const grams = sourceResult.net_weight_g;
  const kcal = sourceResult.energy_kcal;
  const src: 'database' | 'ai_estimated' = sourceResult.confidence === 'high' ? 'database' : 'ai_estimated';
  const exercise = kcal > 0 ? `约需慢跑 ${Math.round(kcal / 6)} 分钟消耗此热量` : null;

  return {
    foodName: sourceResult.food_name,
    matchedFood: sourceResult.food_name,
    category: classifyFoodSimple(sourceResult.food_name),
    weight: grams,
    source: src,
    nutrition: { calories: kcal, protein: sourceResult.protein_g, carbs: sourceResult.carbs_g, fat: sourceResult.fat_g },
    per100g: sourceResult.per100g,
    suggestion: sourceResult.suggestion,
    exercise,
  };
}

/** 简单食物分类（关键词匹配） */
export function classifyFoodSimple(foodName: string): string {
  const patterns: [RegExp, string][] = [
    [/面|粉|拉面|拌面|意面|凉皮/i, '面食'],
    [/饭|米|粥|盖浇|炒饭|焗饭|煲仔/i, '米饭'],
    [/炒|烧|炖|煮|蒸|炸|烤|煎|焖/i, '炒菜'],
    [/汤|羹|煲/i, '汤羹'],
    [/咖啡|奶茶|茶|奶|汁|水|可乐|饮料|酒|啤/i, '饮料'],
    [/面包|蛋糕|饼|酥|卷|糕|包/i, '烘焙'],
    [/薯片|零食|糖|巧克力|果冻|坚果|瓜子|花生|辣条/i, '零食'],
    [/苹果|香蕉|橙|橘|葡萄|莓|瓜|梨|桃|芒果|荔枝|龙眼|榴莲|水果/i, '水果'],
    [/鸡|鸭|猪|牛|羊|肉排|肉串|叉烧|腊肉|火腿|培根/i, '肉类'],
    [/菜|豆|菇|笋|藕|茄|萝卜|黄瓜|白菜|青菜|菠菜|生菜|西兰花/i, '蔬菜'],
    [/奶|酸奶|奶酪|芝士|黄油|奶油/i, '乳制品'],
    [/酱|油|醋|盐|糖|调味|蘸/i, '酱料'],
    [/虾|蟹|鱼|贝|鱿|海|三文/i, '海鲜'],
    [/豆腐|豆皮|豆干|腐竹|豆奶|豆浆/i, '豆制品'],
    [/蛋|鸡蛋|鸭蛋|鹌鹑蛋/i, '蛋类'],
  ];

  for (const [regex, category] of patterns) {
    if (regex.test(foodName)) return category;
  }
  return '未知';
}

// ============================================================
// 中国食物成分表查询 — 多级模糊匹配
//
// 匹配策略（按优先级）：
//   Tier 1: 精确匹配 food_name
//   Tier 2: 完整名称 ILIKE（零食/包装食品优先走这里）
//   Tier 3: 食物品类关键词 ILIKE，优先食物类型词
//   Tier 4: 烹饪方式拆解（仅含烹饪字的家常菜触发）
// ============================================================

import { supabaseAdmin } from '../../../supabase/client.js';

export interface FoodCompositionMatch {
  food_name: string;
  category: string;
  energy_kcal: number;   // per 100g
  protein: number;        // per 100g
  fat: number;            // per 100g
  carbs: number;          // per 100g
}

/** 标准一人份克重（兜底值，优先用 getDefaultPortion） */
export const STANDARD_PORTION_G = 250;

/**
 * 按食物分类返回默认份量克重（g）和兜底每百克热量（kcal/100g）
 * 用于：① DB 命中时确定合理的默认份量 ② DB 未命中时提供常识估算
 */
export interface PortionFallback {
  portionG: number;
  fallbackKcalPer100g: number;
}

export function getDefaultPortion(foodName: string): PortionFallback {
  const CATEGORY_DEFAULTS: [RegExp, number, number][] = [
    // [匹配模式, 默认克重(g), 兜底 kcal/100g]
    // 零食 — 小包装
    [/薯片|薯条|虾片|虾条|锅巴|玉米片|爆米花/i, 75, 500],
    [/饼干|曲奇|威化|蛋卷|酥/i, 50, 450],
    [/巧克力|糖果|奶糖|软糖|棒棒糖/i, 30, 500],
    [/蛋糕|面包|吐司|蛋黄派/i, 80, 350],
    [/果冻|布丁/i, 100, 80],
    [/坚果|花生|瓜子|核桃|杏仁|腰果|开心果/i, 30, 600],
    [/牛肉干|猪肉脯|肉干|肉脯|肉松|火腿肠/i, 50, 400],
    [/蜜饯|果脯|话梅|山楂/i, 30, 300],
    [/辣条|豆干|素肉|豆腐干/i, 50, 400],
    [/海苔|紫菜/i, 10, 350],
    // 主食 — 一份
    [/方便面|泡面|面条|粉丝|米线|米粉|河粉|意面|凉皮/i, 100, 350],
    [/米饭|粥|馒头|包子|饺子|馄饨|粽子|汤圆/i, 200, 150],
    [/面包/i, 80, 300],
    // 饮料
    [/汽水|可乐|碳酸饮料|苏打水|气泡水|果汁|奶茶|咖啡|茶/i, 330, 40],
    [/牛奶|酸奶|豆奶|豆浆/i, 250, 65],
    [/冰淇淋|雪糕|冰棍|甜筒/i, 80, 200],
    // 调味品
    [/酱|油|醋|调味|蘸/i, 15, 200],
    // 水果
    [/苹果|香蕉|橙|橘|葡萄|莓|瓜|梨|桃|芒果|荔枝|龙眼|榴莲/i, 200, 55],
    // 炒菜
    [/炒|烧|炖|煮|蒸|炸|烤|煎|焖/i, 300, 150],
    // 肉类主菜
    [/肉排|肉串|叉烧|腊肉|鸡排|牛排|猪排|烤肉/i, 200, 250],
    // 汤羹
    [/汤|羹|煲/i, 400, 40],
    // 蛋类
    [/鸡蛋|鸭蛋|鹌鹑蛋/i, 100, 150],
    // 豆制品
    [/豆腐|腐竹|豆皮/i, 100, 100],
    // 海鲜
    [/虾|蟹|鱼|贝|鱿|海|三文/i, 200, 120],
    // 乳制品
    [/芝士|奶酪|黄油|奶油/i, 30, 350],
  ];

  for (const [regex, portionG, fallbackKcal] of CATEGORY_DEFAULTS) {
    if (regex.test(foodName)) {
      console.log(
        `[food-composition] 📏 分类份量: "${foodName}" → ${portionG}g, 兜底 ${fallbackKcal}kcal/100g`
      );
      return { portionG, fallbackKcalPer100g: fallbackKcal };
    }
  }

  // 最终兜底
  console.log(
    `[food-composition] 📏 默认份量: "${foodName}" → ${STANDARD_PORTION_G}g (未匹配到具体分类)`
  );
  return { portionG: STANDARD_PORTION_G, fallbackKcalPer100g: 200 };
}

// ============================================================
// 食物品类关键词（数据库里大概率存在的食物条目）
// 分两类：食物类型词（高优先级）和 配料/口味词（低优先级）
// ============================================================

const FOOD_TYPE_KEYWORDS: Set<string> = new Set([
  // 零食 — 品类词
  '薯片', '薯条', '马铃薯片', '虾片', '虾条', '玉米片', '锅巴',
  '饼干', '曲奇', '苏打饼干', '威化', '膨化食品',
  '蛋糕', '面包', '吐司', '蛋黄派', '瑞士卷',
  '巧克力', '糖果', '奶糖', '软糖', '硬糖', '棒棒糖', '口香糖',
  '果冻', '布丁',
  '坚果', '花生', '瓜子', '核桃', '杏仁', '腰果', '开心果', '夏威夷果',
  '牛肉干', '猪肉脯', '肉干', '肉脯', '肉松', '火腿肠', '香肠',
  '蜜饯', '果脯', '话梅', '山楂', '红枣', '枣',
  '海苔', '紫菜',
  '辣条', '豆干', '素肉', '豆腐干',
  // 主食 — 品类词
  '方便面', '泡面', '面条', '挂面', '拉面', '切面', '面', '粉丝', '米线', '米粉',
  '河粉', '意面', '通心粉', '凉皮', '凉面', '面筋',
  '米饭', '粥', '馒头', '包子', '饺子', '馄饨', '粽子', '汤圆', '烧饼', '油条',
  '面包', '吐司', '牛角包', '三明治',
  // 饮料 — 品类词
  '汽水', '可乐', '碳酸饮料', '苏打水', '气泡水',
  '果汁', '橙汁', '苹果汁', '葡萄汁', '椰汁', '果蔬汁',
  '奶茶', '咖啡', '绿茶', '红茶', '花茶', '乌龙茶', '普洱茶',
  '牛奶', '酸奶', '豆奶', '豆浆', '乳酸菌饮料',
  '冰淇淋', '雪糕', '冰棍', '甜筒',
  '功能饮料', '运动饮料',
  // 调味品/酱料
  '番茄酱', '沙拉酱', '花生酱', '芝麻酱', '辣酱', '果酱', '蚝油',
  // 罐头/包装
  '午餐肉', '罐头',
  // 蛋奶
  '鸡蛋', '鸭蛋', '鹌鹑蛋',
]);

/** 食物配料/口味词（低优先级，仅在食物类型词没命中时才用） */
const INGREDIENT_KEYWORDS = new Set([
  '鸡肉', '猪肉', '牛肉', '羊肉', '鸭肉', '鱼肉', '虾仁', '蟹肉',
  '鸡蛋', '鸭蛋',
  '青柠', '柠檬', '草莓', '蓝莓', '芒果', '水蜜桃', '白桃', '黄桃',
  '抹茶', '香草', '可可', '奶油', '芝士', '奶酪', '黄油',
  '牛奶', '酸奶', '椰奶', '燕麦', '红豆', '绿豆', '芝麻', '花生',
  '麻辣', '酸辣', '甜辣', '五香', '孜然', '咖喱', '黑胡椒',
  '番茄', '马铃薯', '土豆', '玉米', '红薯', '紫薯',
  '白砂糖', '蔗糖', '蜂蜜', '植物油', '棕榈油',
]);

/**
 * 从完整名称中提取候选词，按优先级分两组
 * - foodTypes: 高优先级（匹配到就是目标食物品类）
 * - others: 低优先级（配料/口味词，容易误匹配）
 */
function extractFoodWords(name: string): { foodTypes: string[]; others: string[] } {
  const cleaned = name.replace(/[（()[\]【】\s]/g, '');
  const foodTypes: string[] = [];
  const others: string[] = [];

  // 1) 完整名称（去味）
  const withoutFlavor = cleaned.replace(/味/g, '');
  if (withoutFlavor !== cleaned && withoutFlavor.length >= 2) {
    others.push(withoutFlavor);
  }

  // 2) 匹配已知食物品类/配料词
  for (const kw of FOOD_TYPE_KEYWORDS) {
    if (cleaned.includes(kw) && !foodTypes.includes(kw)) {
      foodTypes.push(kw);
    }
  }

  for (const kw of INGREDIENT_KEYWORDS) {
    if (cleaned.includes(kw) && !others.includes(kw) && !foodTypes.includes(kw)) {
      others.push(kw);
    }
  }

  // 3) 完整名称始终作为候选
  if (!foodTypes.includes(cleaned) && !others.includes(cleaned)) {
    others.unshift(cleaned);
  }

  return { foodTypes: [...new Set(foodTypes)], others: [...new Set(others)] };
}

// ============================================================
// Tier 4 用：烹饪方式拆解（仅含烹饪字时触发）
// ============================================================

const COOKING_METHOD_CHARS = /[炒煮蒸炸烤烧炖焖煎拌烩熘爆煲焗卤熏腌酱炝汆涮溜煸扒塌贴酥蜜冻]/;
const COOKING_METHODS_RE = /炒|煮|蒸|炸|烤|烧|炖|焖|煎|拌|烩|熘|爆|煲|焗|卤|熏|腌|酱|炝|汆|涮|溜|煸|扒|塌|贴|酥|蜜|冻/g;
const FLAVOR_PREFIXES = /^(清蒸|红烧|糖醋|鱼香|麻辣|酸辣|蒜蓉|葱爆|干煸|香辣|椒盐|豉汁|咖喱|黑椒|茄汁|宫保|鱼香|回锅|水煮|干锅|铁板|砂锅|石锅|炭烤|蒜香|酱香|孜然|香煎|脆皮|避风塘|京酱|蚝油|豉椒|XO酱|沙茶|照烧|味噌|韩式|泰式|川味|湘味)/;
const COOKING_SUFFIXES = /[汤面饭粥羹煲丝片丁块末蓉泥汁球卷包饼饺馄饨]$/;

function splitDishName(name: string): string[] {
  const parts: string[] = [];
  let cleaned = name.replace(FLAVOR_PREFIXES, '');
  cleaned = cleaned.replace(COOKING_SUFFIXES, '');
  const segments = cleaned.split(COOKING_METHODS_RE).filter(Boolean);

  if (segments.length >= 2) {
    for (const seg of segments) {
      const s = seg.trim();
      if (s.length >= 1 && /[一-鿿]/.test(s)) {
        parts.push(s);
        for (let len = 2; len <= s.length; len++) {
          for (let i = 0; i <= s.length - len; i++) {
            parts.push(s.substring(i, i + len));
          }
        }
      }
    }
  } else {
    parts.push(cleaned.trim());
    if (cleaned.length >= 1) {
      for (let len = 1; len <= cleaned.length; len++) {
        for (let i = 0; i <= cleaned.length - len; i++) {
          parts.push(cleaned.substring(i, i + len));
        }
      }
    }
  }

  const unique = [...new Set(parts.filter(p => p.length >= 1))];
  const rawClean = name.replace(/[（()[\]【】]/g, '').replace(FLAVOR_PREFIXES, '');
  if (!unique.includes(rawClean) && rawClean.length >= 2) {
    unique.unshift(rawClean);
  }
  return unique;
}

// ============================================================
// 主查询函数
// ============================================================

export async function lookupFoodComposition(
  dishName: string
): Promise<FoodCompositionMatch | null> {
  if (!dishName) return null;

  const name = dishName.trim();
  console.log(`[food-composition] 查询 "${name}"...`);

  try {
    // ---- Tier 1: 精确匹配 ----
    const { data: exact } = await supabaseAdmin
      .from('food_composition')
      .select('food_name, category, energy_kcal, protein, fat, carbs')
      .eq('food_name', name)
      .limit(1);

    if (exact && exact.length > 0 && Number(exact[0].energy_kcal) > 0) {
      const row = exact[0];
      console.log(`[food-composition] ✅ Tier1 精确匹配: "${row.food_name}" ${row.energy_kcal}kcal/100g`);
      return buildMatch(row);
    }

    // ---- Tier 2: 完整名称 ILIKE（不做拆解） ----
    console.log(`[food-composition] Tier2: ILIKE "%${name}%"`);
    const { data: fullIlike } = await supabaseAdmin
      .from('food_composition')
      .select('food_name, category, energy_kcal, protein, fat, carbs')
      .ilike('food_name', `%${name}%`)
      .gt('energy_kcal', 0)
      .limit(10);

    if (fullIlike && fullIlike.length > 0) {
      const best = rankMatches(name, [name], [], fullIlike);
      console.log(
        `[food-composition] ✅ Tier2 完整ILIK匹配: "${best.food_name}" ${best.energy_kcal}kcal/100g`
      );
      return buildMatch(best);
    }

    // ---- Tier 3a: 仅食物类型关键词（高精度匹配） ----
    const { foodTypes, others } = extractFoodWords(name);
    console.log(`[food-composition] Tier3: foodTypes=[${foodTypes.join(', ')}] others=[${others.slice(0, 6).join(', ')}]`);

    let tier3aHadKeywords = false;
    if (foodTypes.length > 0) {
      tier3aHadKeywords = true;
      const ftFilters = foodTypes
        .slice(0, 15)
        .map(w => `food_name.ilike.%${w}%`)
        .join(',');

      const { data: ftMatch } = await supabaseAdmin
        .from('food_composition')
        .select('food_name, category, energy_kcal, protein, fat, carbs')
        .or(ftFilters)
        .gt('energy_kcal', 0)
        .limit(30);

      if (ftMatch && ftMatch.length > 0) {
        const best = rankMatches(name, foodTypes, foodTypes, ftMatch);
        console.log(
          `[food-composition] ✅ Tier3a 食物类型匹配: "${best.food_name}" ${best.energy_kcal}kcal/100g ` +
          `(候选: ${ftMatch.slice(0, 4).map((r: any) => r.food_name).join(', ')})`
        );
        return buildMatch(best);
      }
    }

    // ---- Tier 3b: 配料/口味关键词降级（仅在没食物类型词时使用） ----
    // 关键：如果已有食物类型词但没命中，说明 DB 里没有这类食物，跳过配料匹配避免误匹配
    if (!tier3aHadKeywords && others.length > 0) {
      const otherFilters = others
        .slice(0, 15)
        .map(w => `food_name.ilike.%${w}%`)
        .join(',');

      const { data: otherMatch } = await supabaseAdmin
        .from('food_composition')
        .select('food_name, category, energy_kcal, protein, fat, carbs')
        .or(otherFilters)
        .gt('energy_kcal', 0)
        .limit(30);

      if (otherMatch && otherMatch.length > 0) {
        const best = rankMatches(name, others, [], otherMatch);
        console.log(
          `[food-composition] ✅ Tier3b 配料降级匹配: "${best.food_name}" ${best.energy_kcal}kcal/100g ` +
          `(候选: ${otherMatch.slice(0, 4).map((r: any) => r.food_name).join(', ')})`
        );
        return buildMatch(best);
      }
    } else if (tier3aHadKeywords) {
      console.log(`[food-composition] Tier3b 跳过（食物类型词未命中，避免配料误匹配）`);
    }

    // ---- Tier 4: 烹饪方式拆解（家常菜降级） ----
    // 触发条件：含烹饪字 OR 含口味前缀（如"宫保""红烧"等）
    const hasCookingMethod = COOKING_METHOD_CHARS.test(name);
    const hasFlavorPrefix = FLAVOR_PREFIXES.test(name);
    const shouldTryTier4 = hasCookingMethod || hasFlavorPrefix;

    if (shouldTryTier4) {
      const splitCandidates = splitDishName(name);
      console.log(`[food-composition] Tier4: 烹饪拆解 [${splitCandidates.slice(0, 8).join(', ')}...]`);

      const splitFilters = splitCandidates
        .slice(0, 20)
        .map(c => `food_name.ilike.%${c}%`)
        .join(',');

      const { data: splitMatch } = await supabaseAdmin
        .from('food_composition')
        .select('food_name, category, energy_kcal, protein, fat, carbs')
        .or(splitFilters)
        .gt('energy_kcal', 0)
        .limit(30);

      if (splitMatch && splitMatch.length > 0) {
        const best = rankMatches(name, splitCandidates, [], splitMatch);
        console.log(
          `[food-composition] ✅ Tier4 拆解匹配: "${best.food_name}" ${best.energy_kcal}kcal/100g ` +
          `(候选: ${splitMatch.slice(0, 3).map((r: any) => r.food_name).join(', ')})`
        );
        return buildMatch(best);
      }
    } else {
      console.log(`[food-composition] Tier4 跳过（非家常菜特征）`);
    }

    // 全部未命中
    console.log(`[food-composition] ❌ 全部未命中: "${name}"`);
    return null;
  } catch (err: any) {
    const message = err?.message || String(err);
    const code = err?.code;
    // 区分基础设施错误（DB 连不上 / 权限）和普通数据缺失
    if (
      message.includes('JWT') ||
      message.includes('PGRST') ||
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT') ||
      message.includes('ENOTFOUND') ||
      message.includes('NetworkError') ||
      code === 'PGRST301' ||
      code === '42501'
    ) {
      console.error(`[food-composition] ❌ 数据库基础设施错误: ${message}`);
      throw new Error(`[food-composition] DB unavailable: ${message}`);
    }
    console.error('[food-composition] 查询异常（应用层）:', err);
    return null;
  }
}

// ============================================================
// 智能排序（食物类型词优先）
// ============================================================

function rankMatches(
  originalName: string,
  candidates: string[],
  foodTypeWords: string[],
  rows: any[]
): any {
  const cleanName = originalName.replace(/[（()[\]【】]/g, '');

  // 找出每个 DB 条目匹配到的最长候选词长度
  const bestMatchLen = (dbClean: string): number => {
    let maxLen = 0;
    for (const c of candidates) {
      if (dbClean.includes(c) && c.length > maxLen) maxLen = c.length;
    }
    return maxLen;
  };

  const score = (row: any): number => {
    const dbName: string = row.food_name;
    const dbClean = dbName.replace(/[（）()]/g, '');

    // 0: 精确匹配原名称
    if (dbClean === cleanName) return 0;
    // 1: 前缀匹配原名称
    if (dbName.startsWith(originalName)) return 1;
    // 2: 精确匹配某个食物类型词（高优先级）
    if (foodTypeWords.some(c => dbClean === c)) return 2;
    // 3: 精确匹配某个候选词
    if (candidates.some(c => dbClean === c)) return 3;
    // 4: 前缀匹配食物类型词
    if (foodTypeWords.some(c => dbName.startsWith(c))) return 4;
    // 5: 包含食物类型词（关键！食物类型匹配优先于配料）
    if (foodTypeWords.some(c => dbClean.includes(c))) return 5;
    // 6: 前缀匹配其他候选词
    if (candidates.some(c => dbName.startsWith(c))) return 6;
    // 7: 包含原名称
    if (dbClean.includes(cleanName)) return 7;
    // 8: 包含候选词
    if (candidates.some(c => dbClean.includes(c))) return 8;
    return 9;
  };

  return rows
    .sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      if (sa !== sb) return sa - sb;

      // 同分优先"代表值"
      const aRep = a.food_name.includes('代表值') ? 0 : 1;
      const bRep = b.food_name.includes('代表值') ? 0 : 1;
      if (aRep !== bRep) return aRep - bRep;

      // 同分优先更长候选词匹配（"排骨"优于"排"）
      const aMatchLen = bestMatchLen(a.food_name.replace(/[（）()]/g, ''));
      const bMatchLen = bestMatchLen(b.food_name.replace(/[（）()]/g, ''));
      if (aMatchLen !== bMatchLen) return bMatchLen - aMatchLen;

      // 同分优先更短名称
      return a.food_name.length - b.food_name.length;
    })[0];
}

function buildMatch(row: any): FoodCompositionMatch {
  const rawKcal = row.energy_kcal;
  const energy_kcal = Number(rawKcal);
  if (isNaN(energy_kcal) || energy_kcal <= 0) {
    console.warn(
      `[food-composition] ⚠️ buildMatch: energy_kcal 异常 ` +
      `raw="${rawKcal}" (type=${typeof rawKcal}) → Number=${energy_kcal} ` +
      `food_name="${row.food_name}"`
    );
  }
  console.log(
    `[food-composition] 📋 buildMatch: "${row.food_name}" ` +
    `raw_energy_kcal=${rawKcal} → energy_kcal=${energy_kcal} ` +
    `protein=${row.protein} fat=${row.fat} carbs=${row.carbs}`
  );
  return {
    food_name: row.food_name,
    category: row.category || '',
    energy_kcal,
    protein: Number(row.protein || 0),
    fat: Number(row.fat || 0),
    carbs: Number(row.carbs || 0),
  };
}

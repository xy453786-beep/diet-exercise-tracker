// ============================================================
// MET（代谢当量）运动对照表 + 模糊匹配
//
// 数据来源：《中国居民膳食指南》、《身体活动汇编》
//           (Compendium of Physical Activities)
//
// 公式: 热量(kcal) = MET × 体重(kg) × 时间(h)
//
// 与 scripts/exercise_calculator.py 的 MET_TABLE 保持同步。
// ============================================================

// ---- Levenshtein 距离（轻量版，避免跨目录引入 server/ 代码） ----

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  if (a.length > b.length) [a, b] = [b, a];

  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);

  for (let i = 0; i <= m; i++) prev[i] = i;

  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(prev[i] + 1, curr[i - 1] + 1, prev[i - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

function similarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const longer = a.length > b.length ? a : b;
  if (longer.length === 0) return 1.0;
  return 1 - levenshteinDistance(a, b) / longer.length;
}

// ---- MET 对照表 ----

export const MET_TABLE: Record<string, number> = {
  // ── 跑步类 ──
  '跑步': 7.0,
  '慢跑': 7.0,
  '快跑': 9.0,
  '冲刺跑': 12.0,
  '马拉松': 8.5,

  // ── 走路类 ──
  '快走': 4.5,
  '散步': 3.0,
  '慢走': 3.0,
  '健走': 5.0,
  '竞走': 6.5,

  // ── 水上运动 ──
  '游泳': 6.0,
  '自由泳': 7.0,
  '蛙泳': 5.5,
  '仰泳': 4.5,
  '蝶泳': 8.0,

  // ── 跳跃类 ──
  '跳绳': 8.0,
  '慢速跳绳': 6.0,
  '开合跳': 8.0,
  '波比跳': 10.0,

  // ── 瑜伽 / 拉伸 ──
  '瑜伽': 2.5,
  '哈他瑜伽': 2.5,
  '流瑜伽': 3.5,
  '普拉提': 3.0,
  '拉伸': 2.0,
  '冥想': 1.0,

  // ── 力量训练 ──
  '力量训练': 5.0,
  '举重': 6.0,
  '俯卧撑': 3.8,
  '深蹲': 5.0,
  '引体向上': 5.5,
  '仰卧起坐': 3.8,
  '哑铃训练': 4.5,
  '杠铃训练': 5.5,

  // ── 单车类 ──
  '动感单车': 7.5,
  '骑行': 6.0,
  '自行车': 6.0,
  '山地骑行': 8.0,

  // ── 球类 ──
  '篮球': 6.5,
  '足球': 7.0,
  '羽毛球': 5.5,
  '乒乓球': 4.0,
  '网球': 7.0,
  '排球': 4.5,
  '高尔夫': 3.5,

  // ── 健身操 ──
  '健身操': 5.5,
  '有氧操': 6.0,
  'HIIT': 8.0,
  'Tabata': 9.0,
  '踏板操': 6.5,
  '搏击操': 7.5,

  // ── 日常活动 ──
  '爬楼梯': 6.0,
  '登山': 6.5,
  '跳舞': 5.0,
  '街舞': 6.5,
  '拳击': 9.0,
  '太极拳': 3.0,
  '八段锦': 2.5,
  '广场舞': 4.0,
  '遛狗': 2.5,
  '做家务': 2.8,
};

/** 未匹配时的默认 MET 值（中等强度运动） */
export const DEFAULT_MET = 5.0;

// ---- 模糊匹配 ----

/**
 * 模糊匹配运动名称 → (标准化名称, MET 值)
 *
 * 1. 先精确匹配（忽略大小写）
 * 2. 再用编辑距离相似度做模糊匹配
 *
 * @param name   用户输入的运动名称
 * @param cutoff 最低相似度阈值（默认 0.4，宽松匹配）
 * @returns 匹配结果或 null
 */
export function matchExercise(
  name: string,
  cutoff: number = 0.4
): { name: string; met: number } | null {
  if (!name || !name.trim()) return null;

  const cleaned = name.trim();
  const keys = Object.keys(MET_TABLE);

  // 1) 精确匹配（忽略大小写）
  for (const key of keys) {
    if (key.toLowerCase() === cleaned.toLowerCase()) {
      return { name: key, met: MET_TABLE[key] };
    }
  }

  // 2) 编辑距离模糊匹配
  let bestScore = 0;
  let bestKey: string | null = null;

  for (const key of keys) {
    const score = similarity(cleaned, key);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  if (bestKey && bestScore >= cutoff) {
    return { name: bestKey, met: MET_TABLE[bestKey] };
  }

  return null;
}

// ---- 热量计算 ----

/**
 * 计算运动消耗热量
 *
 * 标准公式: 热量(kcal) = MET × 体重(kg) × 时间(h)
 *
 * @param met      MET 值
 * @param weightKg 体重（kg）
 * @param minutes  运动时长（分钟）
 * @returns 消耗热量（kcal，四舍五入取整）
 */
export function calcCalories(
  met: number,
  weightKg: number,
  minutes: number
): number {
  return Math.round(met * weightKg * (minutes / 60));
}

// ---- 运动分类与强度 ----

/**
 * 根据 MET 值推断运动分类和强度
 */
export function classifyExercise(met: number): {
  category: 'aerobic' | 'resistance';
  intensity: 'low' | 'medium' | 'high' | 'medium-high';
} {
  // 力量训练通常 MET 在 3.5~6.0 之间
  let category: 'aerobic' | 'resistance' = 'aerobic';
  let intensity: 'low' | 'medium' | 'high' | 'medium-high';

  if (met <= 3.0) {
    intensity = 'low';
  } else if (met <= 5.5) {
    intensity = 'medium';
  } else if (met <= 7.5) {
    intensity = 'medium-high';
  } else {
    intensity = 'high';
  }

  return { category, intensity };
}

/**
 * 一键计算：输入运动名 + 体重 + 时长 → 完整估算结果
 *
 * @returns 包含 MET 值、热量、分类、强度的估算对象
 */
export function estimateWorkout(
  exerciseName: string,
  weightKg: number,
  minutes: number
): {
  matchedName: string;
  met: number;
  calories: number;
  category: 'aerobic' | 'resistance';
  intensity: 'low' | 'medium' | 'high' | 'medium-high';
} {
  const matched = matchExercise(exerciseName);
  const met = matched ? matched.met : DEFAULT_MET;
  const calories = calcCalories(met, weightKg, minutes);
  const { category, intensity } = classifyExercise(met);

  return {
    matchedName: matched?.name ?? exerciseName,
    met,
    calories,
    category,
    intensity,
  };
}

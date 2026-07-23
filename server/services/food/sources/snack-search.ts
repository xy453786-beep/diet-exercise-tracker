// ============================================================
// 零食营养数据获取模块 — v3 百炼 Web Search + 四步校验
//
// 使用阿里云百炼内置 Web Search 插件（enable_search），
// 让 Qwen-Plus 实时联网搜索零食营养数据。
//
// 四步校验流程编码在 System Prompt 中：
//   1. 精准与泛化双关键词检索
//   2. 多源筛选与工艺常识对齐
//   3. 国标换算公式与常识卡点（Sanity Check）
//   4. 兜底与优化反馈
//
// 优势：
//   - 零额外依赖：复用已有 DASHSCOPE_API_KEY
//   - 实时数据：联网搜索获取最新营养表
//   - 内置校验：工艺常识 + kJ→kcal + 品类阈值
// ============================================================

const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY || '';

/** 零食营养搜索结果 */
export interface SnackNutrition {
  package_weight_g: number;          // 标准包装克重
  kcal_per_100g: number;             // 每100g热量 (kcal)
  confidence: 'high' | 'medium';     // 数据置信度
  source_type: 'official_label' | 'cross_reference' | 'industry_average';
  processing_note?: string;          // 工艺-热量关系说明
  suggestion?: string;               // 数据来源说明（展示给用户）
  data_quality?: {
    has_explicit_label: boolean;     // 是否找到明确的营养成分表
    source_domain: string;           // 数据来源域名
    multiple_sources_agree: boolean; // 多源是否一致
  };
}

// ============================================================
// 四步校验 System Prompt
// ============================================================

const WEB_SEARCH_SYSTEM_PROMPT = `你是一个专业的中国食品营养数据查询助手，具备联网搜索能力。
你会收到一个零食的商品全称，请严格按以下四步流程执行查询：

## 第一步：精准与泛化双关键词检索

1. **精准搜索**：搜索词应包含「品牌 + 产品名 + 营养成分表 + 热量」
2. 若精准搜索无果，自动切换为**品类兜底搜索**：
   - 提取品类关键词（如"烘烤薄脆猪肉片" → 品类"猪肉脯/猪肉纸" + 工艺"烘烤脱水"）
   - 搜索「{品类} {工艺} 每100克热量 营养成分表」
   - 或搜索产地特色词（如"靖江猪肉脯 营养成分"）

## 第二步：多源筛选与工艺常识对齐

提取数据前，先识别该零食的**食品工艺类型**，并对照下表的常识范围：

| 食品工艺 | 典型品类 | 热量特征 (kcal/100g) |
|---------|---------|---------------------|
| 深度脱水烘烤/风干 | 肉脯、肉干、肉脆、猪肉纸、牛肉干 | 750-860（极高！深度脱水后脂肪浓缩） |
| 高温油炸膨化 | 薯片、锅巴、油炸方便面 | 500-560 |
| 非油炸膨化 | 虾条、非油炸薯片、玉米片 | 430-500 |
| 夹心饼干/曲奇 | 奥利奥、丹麦曲奇、威化 | 470-530 |
| 普通饼干/苏打 | 太平梳打、早餐饼干 | 400-460 |
| 巧克力/糖果 | 德芙、士力架、奶糖、软糖 | 500-580 |
| 含糖碳酸饮料 | 可乐、雪碧、汽水 | 38-45（液体，注意区分！） |
| 果汁/茶饮料 | 橙汁、椰汁、冰红茶 | 35-55 |
| 瓶装奶茶 | 阿萨姆、统一奶茶 | 40-60 |
| 方便面（油炸面饼） | 康师傅、统一、今麦郎 | 430-500 |
| 辣条/豆干/素肉 | 卫龙、豆制品零食 | 380-500 |
| 冰淇淋/雪糕 | 巧乐兹、可爱多 | 150-300 |
| 坚果炒货 | 核桃、腰果、杏仁、花生 | 550-650 |
| 海苔/紫菜 | 波力海苔、小老板 | 280-380 |

**筛选规则（重要）**：
- ✅ 优先采纳标有「营养成分表」「NRV%」「能量」关键词的来源（产品包装图、电商详情页、品牌官网）
- ❌ 谨慎对待小红书、论坛、个人博客等 UGC 数据，仅作参考
- ❌ 若搜索结果中出现**明显违背工艺常识**的值（例如肉脯标注 200kcal/100g、薯片标注 150kcal/100g），这很可能是错误数据或不同品类，**坚决过滤丢弃**
- ✅ 尽可能从 2-3 个独立来源交叉验证，若不同来源偏差 > 30%，说明存在争议，应采用品类均值
- ⚠️ 特别注意区分：很多电商页面标注的是**千焦(kJ)**而非千卡(kcal)

### 数据源可信度分级（严格遵循）

搜索时自动判断数据来源的可信度，按以下标准分级采信：

| 可信度 | 来源类型 | 示例 |
|--------|---------|------|
| ⭐⭐⭐ 高 | 电商详情页营养成分表图/文 | 京东/天猫商品参数表格、品牌官方商城 |
| ⭐⭐⭐ 高 | 专业营养数据库 | 薄荷网(boohee.com)、食物库、FatSecret中国 |
| ⭐⭐ 中 | 食品包装实拍（含营养表） | 用户评测中附带的包装背面照片 |
| ⭐ 低 | 品牌宣传/广告文案 | 可能只提热量不提克重，数据不完整 |
| ❌ 禁用 | 自媒体文章 | 小红书笔记、公众号文章、百家号、头条号 |
| ❌ 禁用 | 问答社区 | 知乎回答、百度知道、贴吧帖子 |
| ❌ 禁用 | 个人博客 | CSDN博客、简书、个人网站 |

**硬性过滤规则**：
- 任何不带明确数值标注的「低卡」「健康」「零脂」等营销话术 → 忽略
- 任何来自上述 ❌ 禁用来源的数值 → **坚决忽略，绝不采信**
- 数据必须能在页面中找到明确的「营养成分表」字样或「能量：XXX kJ/100g」格式标注
- 如果搜索结果中所有来源都是 ❌ 禁用来源 → 直接输出 error: "no_reliable_source"，不强行估算

## 第三步：国标换算与常识卡点（Sanity Check）

### 3a. 强制千焦→千卡换算
- 若搜到的热量数值在 **1500-2500** 范围 → 这几乎肯定是千焦(kJ)，**必须除以 4.184** 转为 kcal
- 若搜到的数值在 **35-900** 范围 → 这就是千卡(kcal)，无需换算
- 若你不确定原始数据的单位，在 processing_note 中注明"已检查kJ/kcal单位"

### 3b. 绝对阈值校验（以下品类必须通过）

| 品类 | 阈值规则 |
|------|---------|
| 肉干/肉脯/肉脆/猪肉纸 | kcal_per_100g 必须 ≥ 700，否则数据错误 |
| 薯片/锅巴/油炸膨化 | kcal_per_100g 必须 ≥ 430 |
| 饼干/曲奇/威化 | kcal_per_100g 必须 ≥ 370 |
| 巧克力/糖果 | kcal_per_100g 必须 ≥ 460 |
| 碳酸饮料 | kcal_per_100g 应在 30-50 范围（液体密度≈1g/ml） |
| 方便面 | kcal_per_100g 必须 ≥ 400 |

### 3c. 总热量合理性校验
- total_calories = weight_g × kcal_per_100g / 100
- 对于**肉制品零食**：35g 包装总热量绝不可能 < 150kcal
- 对于**薯片**：40g 包装总热量绝不可能 < 160kcal
- 若计算结果低于同类阈值 → 说明 weight_g 或 kcal_per_100g 有误 → 自动用品类均值修正

## 第四步：兜底与优化反馈

**情况 A — 找到官方营养表数据**：
- confidence: "high"
- source_type: "official_label"
- processing_note: 简要说明工艺-热量关系（如"深度脱水烘烤，脂肪浓缩，热量极高"）
- suggestion: 说明数据来源（如"数据来源：京东/天猫商品详情页营养成分表标注"）

**情况 B — 多源交叉验证后采用均值**：
- confidence: "high"
- source_type: "cross_reference"
- processing_note: 简要说明验证情况
- suggestion: 说明为多源交叉验证结果

**情况 C — 未找到官方数据，采用同工艺行业均值**：
- confidence: "medium"
- source_type: "industry_average"
- processing_note: 说明采用的品类均值
- suggestion: "数值属于同工艺行业标准估算，建议拍摄背面营养表以获得 100% 精准度"

---

## 输出格式（严格执行）

请**只输出**以下 JSON，不要任何其他文字、解释或 markdown 代码块标记：

{"weight_g": <整数克重>, "kcal_per_100g": <整数，每100g热量，单位 kcal>, "confidence": "high"|"medium", "source_type": "official_label"|"cross_reference"|"industry_average", "processing_note": "<20字以内>", "suggestion": "<60字以内>", "data_quality": {"has_explicit_label": <true|false>, "source_domain": "<来源域名如jd.com>", "multiple_sources_agree": <true|false>}}

如果你完全不认识该产品且搜索也找不到任何可靠来源的数据，输出：
{"weight_g": 0, "kcal_per_100g": 0, "confidence": "medium", "source_type": "industry_average", "processing_note": "无可靠数据", "suggestion": "未搜索到该产品来自可信源的营养数据", "data_quality": {"has_explicit_label": false, "source_domain": "", "multiple_sources_agree": false}}`;

// ============================================================
// Primary: 百炼 Web Search 联网搜索
// ============================================================

async function queryWebSearch(
  foodName: string
): Promise<{
  weight_g: number;
  kcal_per_100g: number;
  confidence: 'high' | 'medium';
  source_type: 'official_label' | 'cross_reference' | 'industry_average';
  processing_note?: string;
  suggestion?: string;
  data_quality?: {
    has_explicit_label: boolean;
    source_domain: string;
    multiple_sources_agree: boolean;
  };
} | null> {
  if (!DASHSCOPE_KEY) {
    console.warn('[snack-search] DASHSCOPE_API_KEY 未设置');
    return null;
  }

  console.log(
    `[snack-search] 🌐 百炼联网搜索: "${foodName}" (strategy=max, forced=true)...`
  );

  const t0 = Date.now();

  try {
    const resp = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DASHSCOPE_KEY}`,
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [
            { role: 'system', content: WEB_SEARCH_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                `请优先在以下高信赖源中搜索零食「${foodName}」的营养成分数据：`,
                '',
                '**优先搜索站点（按优先级）**：',
                '1. 电商平台商品详情页：优先搜索京东(jd.com)、天猫(tmall.com)的商品参数/规格页面中的营养成分表',
                '2. 专业营养数据库：搜索薄荷网(boohee.com)的食物库数据',
                '3. 品牌官网：搜索品牌官方商城的产品信息页',
                '',
                '**搜索关键词建议**：「${foodName} 营养成分表 能量 千焦 每100克」',
                '**搜索技巧**：可使用 site:jd.com 或 site:boohee.com 限定搜索范围',
                '',
                '⚠️ **重要约束**：',
                '- 不要采信来源不明的自媒体文章（小红书、公众号、百家号）',
                '- 不要采信问答社区估算值（知乎、百度知道、贴吧）',
                '- 不要采信个人博客（CSDN、简书）',
                '- 只采信页面中明确标注了「营养成分表」「每100克」「能量/热量」数值的官方参数',
                '- 如果搜索结果都是不可信来源，宁可采用行业均值也不要采信垃圾数据',
              ].join('\n'),
            },
          ],
          // 百炼 Web Search 扩展参数
          enable_search: true,
          search_options: {
            forced_search: true,
            search_strategy: 'max',
            assigned_site_list: [
              'jd.com',
              'tmall.com',
              'taobao.com',
              'boohee.com',
              'food.daily.taobao.com',
            ],
          },
          temperature: 0.05,
          max_tokens: 512,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    const elapsed = Date.now() - t0;

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.warn(
        `[snack-search] DashScope 返回 ${resp.status} (${elapsed}ms): ${errText.slice(0, 200)}`
      );
      return null;
    }

    const data = await resp.json();
    const content = (data?.choices?.[0]?.message?.content || '').trim();
    console.log(`[snack-search] Qwen 原始输出 (${elapsed}ms): "${content}"`);

    // 提取 JSON（兼容 markdown 代码块包裹）
    let jsonStr = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[snack-search] AI 输出中未找到 JSON');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const weightG = parseInt(String(parsed.weight_g), 10);
    const kcalPer100g = parseInt(String(parsed.kcal_per_100g), 10);
    const confidence = parsed.confidence === 'high' ? 'high' : 'medium';
    const sourceType = ['official_label', 'cross_reference', 'industry_average'].includes(
      parsed.source_type
    )
      ? (parsed.source_type as 'official_label' | 'cross_reference' | 'industry_average')
      : 'industry_average';

    // 验证数值合理性
    if (isNaN(weightG) || isNaN(kcalPer100g) || weightG <= 0 || kcalPer100g <= 0) {
      console.warn(
        `[snack-search] AI 返回无效值: weight_g=${weightG}, kcal=${kcalPer100g}`
      );
      return null;
    }

    if (weightG < 5 || weightG > 5000) {
      console.warn(`[snack-search] weight_g=${weightG} 超出合理范围 [5, 5000]`);
      return null;
    }

    // 品类感知的 kcal 合理性范围
    if (!isKcalInCategoryRange(foodName, kcalPer100g)) {
      console.warn(
        `[snack-search] kcal_per_100g=${kcalPer100g} 超出品类合理范围，数据可能错误`
      );
      return null;
    }

    // 解析 data_quality
    const dataQuality = parsed.data_quality || {};
    const hasExplicitLabel = dataQuality.has_explicit_label === true;
    const sourceDomain = dataQuality.source_domain || '';
    const multipleSourcesAgree = dataQuality.multiple_sources_agree === true;

    // data_quality 二次校验：如果没有明确营养标签，降级 confidence
    let effectiveConfidence: 'high' | 'medium' = confidence;
    if (!hasExplicitLabel && sourceType !== 'industry_average') {
      console.warn(
        `[snack-search] ⚠️ 未找到明确营养成分表标注，confidence: ${confidence} → medium`
      );
      effectiveConfidence = 'medium';
    }

    // 多源不一致时也降级
    if (!multipleSourcesAgree && sourceType === 'cross_reference') {
      console.warn(`[snack-search] ⚠️ 多源数据不一致，confidence 降级`);
      effectiveConfidence = 'medium';
    }

    const totalKcal = Math.round(weightG * kcalPer100g / 100);
    console.log(
      `[snack-search] ✅ 联网搜索成功 (${elapsed}ms): ` +
        `"${foodName}" → ${weightG}g × ${kcalPer100g}/100 = ${totalKcal}kcal ` +
        `(${sourceType}, ${effectiveConfidence}) ` +
        `dq: label=${hasExplicitLabel} domain=${sourceDomain || '?'} multi=${multipleSourcesAgree}`
    );

    return {
      weight_g: weightG,
      kcal_per_100g: kcalPer100g,
      confidence: effectiveConfidence,
      source_type: sourceType,
      processing_note: parsed.processing_note || undefined,
      suggestion: parsed.suggestion || undefined,
      data_quality: {
        has_explicit_label: hasExplicitLabel,
        source_domain: sourceDomain,
        multiple_sources_agree: multipleSourcesAgree,
      },
    };
  } catch (err: any) {
    const elapsed = Date.now() - t0;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      console.warn(`[snack-search] 联网搜索超时 (${elapsed}ms)`);
    } else {
      console.error(`[snack-search] 联网搜索异常 (${elapsed}ms):`, err.message);
    }
    return null;
  }
}

// ============================================================
// 品类感知的 kcal 合理性范围校验
// ============================================================

/** 品类 → [最小 kcal/100g, 最大 kcal/100g] */
const CATEGORY_KCAL_RANGES: [RegExp, [number, number]][] = [
  // 肉制品：脱水烘烤，极高热量
  [/肉干|肉脯|肉脆|肉松|猪肉脯|牛肉干|猪肉纸|肉纸/i, [600, 900]],
  // 油炸膨化
  [/薯片|锅巴|油炸|膨化/i, [400, 600]],
  // 饼干/曲奇/威化/酥
  [/饼干|曲奇|威化|蛋卷|酥|派/i, [350, 600]],
  // 巧克力/糖果
  [/巧克力|糖果|奶糖|软糖|棒棒糖|士力架/i, [400, 600]],
  // 方便面
  [/方便面|泡面|杯面|碗面|即食面|速食面|酸辣粉|螺蛳粉|火鸡面|红油面皮/i, [380, 550]],
  // 辣条/豆干/素肉
  [/辣条|豆干|素肉|面筋/i, [350, 550]],
  // 坚果
  [/坚果|瓜子|花生|核桃|杏仁|腰果|开心果|夏威夷果|松子/i, [450, 700]],
  // 海苔/紫菜
  [/海苔|紫菜/i, [200, 450]],
  // 冰淇淋/雪糕
  [/冰淇淋|雪糕|冰棍|甜筒/i, [100, 350]],
  // 碳酸饮料
  [/可乐|汽水|碳酸|苏打水|气泡水/i, [25, 55]],
  // 果汁/茶饮料/奶茶
  [/果汁|奶茶|冰红茶|绿茶|乌龙|椰汁|柠檬茶|功能饮料|能量饮料|运动饮料/i, [20, 65]],
  // 膨化零食（非薯片类）
  [/虾片|虾条|玉米片|爆米花|仙贝|雪饼|小小酥|膨化/i, [350, 550]],
  // 蛋糕/面包/吐司
  [/蛋糕|面包|吐司|蛋黄派|瑞士卷|华夫/i, [250, 500]],
  // 果冻/布丁
  [/果冻|布丁|龟苓膏/i, [30, 150]],
  // 蜜饯/果脯
  [/蜜饯|果脯|话梅|山楂/i, [200, 400]],
  // 口香糖/薄荷糖
  [/口香糖|薄荷糖|润喉糖/i, [100, 300]],
  // 蛋白棒/能量棒/代餐
  [/蛋白棒|能量棒|代餐|奶片|奶贝/i, [300, 550]],
  // 火腿肠
  [/火腿肠|香肠|热狗/i, [150, 350]],
];

/**
 * 检查 kcal_per_100g 是否在品类的合理范围内。
 * 使用品类感知的动态范围替代原来硬编码的 [10, 900]。
 */
function isKcalInCategoryRange(foodName: string, kcalPer100g: number): boolean {
  // 先检查是否有品类特定范围
  for (const [regex, [min, max]] of CATEGORY_KCAL_RANGES) {
    if (regex.test(foodName)) {
      if (kcalPer100g < min) {
        console.warn(
          `[snack-search] 🔴 "${foodName}" kcal=${kcalPer100g} < 品类下限 ${min}，数据可疑`
        );
        return false;
      }
      if (kcalPer100g > max) {
        console.warn(
          `[snack-search] 🟡 "${foodName}" kcal=${kcalPer100g} > 品类上限 ${max}，数据偏高但放行`
        );
        // 超过上限只警告，不放行过高值
        return false;
      }
      return true;
    }
  }

  // 未匹配到特定品类，使用通用宽范围
  if (kcalPer100g < 10 || kcalPer100g > 900) {
    console.warn(
      `[snack-search] "${foodName}" kcal=${kcalPer100g} 超出通用范围 [10, 900]`
    );
    return false;
  }
  return true;
}

// ============================================================
// 主入口：获取零食营养数据
// ============================================================

/**
 * 使用百炼 Web Search 联网搜索获取零食的营养数据。
 *
 * 通过 Qwen-Plus + enable_search 实现实时联网搜索，
 * 四步校验逻辑（双关键词检索、工艺对齐、kJ换算、阈值卡点）
 * 编码在 System Prompt 中由模型自动执行。
 *
 * @param foodName - 完整食物名称（如 "乐事青柠味薯片"）
 * @returns SnackNutrition 或 null（搜索失败/超时）
 */
export async function searchSnackNutrition(
  foodName: string
): Promise<SnackNutrition | null> {
  const t0 = Date.now();

  // ===== 百炼 Web Search 联网搜索 =====
  const result = await queryWebSearch(foodName);

  if (result) {
    const elapsed = Date.now() - t0;
    const totalKcal = Math.round(result.weight_g * result.kcal_per_100g / 100);
    console.log(
      `[snack-search] ✅ 成功 (${elapsed}ms, 百炼WebSearch): ` +
        `"${foodName}" → ${result.weight_g}g × ${result.kcal_per_100g}/100 = ${totalKcal}kcal ` +
        `(${result.source_type}, ${result.confidence})`
    );
    return {
      package_weight_g: result.weight_g,
      kcal_per_100g: result.kcal_per_100g,
      confidence: result.confidence,
      source_type: result.source_type,
      processing_note: result.processing_note,
      suggestion: result.suggestion,
    };
  }

  console.warn(`[snack-search] ❌ "${foodName}" 联网搜索失败，返回 null 触发兜底`);
  return null;
}

// ============================================================
// 零食判定：判断是否为应触发零食数据获取的零食/饮料
// ============================================================

const SNACK_PATTERN =
  /薯片|薯条|虾片|虾条|锅巴|玉米片|爆米花|饼干|曲奇|威化|蛋卷|酥|巧克力|糖果|奶糖|软糖|棒棒糖|蛋糕|面包|吐司|蛋黄派|果冻|布丁|坚果|瓜子|花生|核桃|杏仁|腰果|开心果|牛肉干|猪肉脯|肉干|肉脯|肉松|火腿肠|蜜饯|果脯|话梅|山楂|辣条|豆干|素肉|海苔|紫菜|方便面|泡面|杯面|碗面|即食面|速食面|酸辣粉|螺蛳粉|红油面皮|可乐|汽水|碳酸|苏打水|气泡水|果汁|奶茶|冰淇淋|雪糕|冰棍|甜筒|龟苓膏|口香糖|薄荷糖|润喉糖|功能饮料|能量饮料|运动饮料|蛋白棒|能量棒|代餐|奶片|奶贝|膨化|仙贝|雪饼|小小酥|康师傅|统一|今麦郎|白象|汤达人|合味道|农心|三养|出前一丁|阿宽|莫小仙|自嗨锅|火鸡面|老坛酸菜|自热/i;

/** 判断食物名是否属于零食/饮料（应触发零食数据获取） */
export function isSnackFood(foodName: string): boolean {
  return SNACK_PATTERN.test(foodName);
}

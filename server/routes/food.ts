import { Router, Request, Response } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { runPipeline, analyzeFoodByName } from '../services/food/pipeline.js';
import { saveUserCorrection } from '../services/food/sources/cache.js';

export const foodRouter = Router();

// ============================================================
// POST /api/food/analyze-image
//
// 食物图片识别管线（v7）：
//   Stage 0: zxing 条码扫描 → Open Food Facts
//   Stage 1: Qwen-VL-Plus 识别食物名称
//   Stage 2: food_cache 精确缓存命中
//   Stage 3: food_composition 表模糊查询
//   Stage 4: 百炼联网搜索零食营养（仅零食触发）
//   Stage 5: 分类兜底估算
//
// Body: { imageUrl: string }
// ============================================================
foodRouter.post('/analyze-image', requireAuth, async (req: Request, res: Response) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      res.status(400).json({ error: '请提供食物图片 URL' });
      return;
    }

    console.log('[food/analyze-image] 启动识别管线...');
    const result = await runPipeline(imageUrl.trim());
    console.log(`[food/analyze-image] 管线完成: source=${result.source} weight=${result.weight}g calories=${result.nutrition.calories}kcal`);

    res.json(result);
  } catch (err: any) {
    console.error('[food/analyze-image] 管线错误:', err);
    res.status(500).json({ error: '食物分析失败，请重试' });
  }
});

// ============================================================
// POST /api/food/cache/correct
//
// 保存用户手动校正的营养数据到缓存表。
// 标注 is_user_calibrated = true，下次相同食物优先返回校正值。
//
// Body: { foodName, brand?, weight?, calories?, protein?, carbs?, fat? }
// ============================================================
foodRouter.post('/cache/correct', requireAuth, async (req: Request, res: Response) => {
  try {
    const { foodName, brand, weight, calories, protein, carbs, fat } = req.body;

    if (!foodName || typeof foodName !== 'string' || !foodName.trim()) {
      res.status(400).json({ error: '请提供食物名称' });
      return;
    }

    if (!calories || typeof calories !== 'number' || calories <= 0) {
      res.status(400).json({ error: '请提供有效的热量值' });
      return;
    }

    await saveUserCorrection(
      foodName.trim(),
      brand || null,
      calories,
      weight || 100,
      protein || 0,
      carbs || 0,
      fat || 0
    );

    console.log(`[food/cache/correct] 已保存用户校正: "${foodName}" ${weight || 100}g ${calories}kcal`);

    res.json({ success: true, message: '校正数据已保存，下次识别将优先使用' });
  } catch (err: any) {
    console.error('[food/cache/correct] 错误:', err);
    res.status(500).json({ error: '保存校正数据失败' });
  }
});

// ============================================================
// POST /api/food/analyze
//
// 文本食物营养分析（纯文字，无需图片）：
//   缓存 → 食物成分表 → 联网搜索（零食）→ 兜底估算
//
// Body: { foodName: string, weight?: number }
// ============================================================
foodRouter.post('/analyze', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { foodName, weight } = req.body;

    if (!foodName || typeof foodName !== 'string' || !foodName.trim()) {
      res.status(400).json({ error: '请提供食物名称' });
      return;
    }

    console.log(`[food/analyze] 文本分析: "${foodName}" ${weight || 100}g`);
    const result = await analyzeFoodByName(foodName.trim(), weight || 100);
    console.log(`[food/analyze] 完成: source=${result.source} calories=${result.nutrition.calories}kcal`);

    res.json(result);
  } catch (err: any) {
    console.error('[food/analyze] 错误:', err);
    res.status(500).json({ error: '食物分析失败，请重试' });
  }
});

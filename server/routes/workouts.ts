import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../supabase/client';

export const workoutsRouter = Router();

/**
 * GET /api/workouts?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Get workout entries in a date range.
 */
workoutsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      res.status(400).json({ error: '请提供日期范围参数 from 和 to' });
      return;
    }

    const { data: entries, error } = await supabaseAdmin
      .from('workout_entries')
      .select('*')
      .eq('user_id', req.userId)
      .gte('entry_date', String(from))
      .lte('entry_date', String(to))
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: '查询运动记录失败' });
      return;
    }

    // Group by entry_date
    const workoutsByDay: Record<string, any[]> = {};
    for (const w of entries || []) {
      if (!workoutsByDay[w.entry_date]) {
        workoutsByDay[w.entry_date] = [];
      }
      workoutsByDay[w.entry_date].push({
        id: w.id,
        type: w.type,
        duration: w.duration,
        calories: w.calories,
        intensity: w.intensity,
        category: w.category,
        time: w.time_of_day,
        distance: w.distance,
      });
    }

    res.json({ workoutsByDay });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/workouts
 * Add a workout entry.
 * Body: { date, type, duration, calories, intensity, category, time, distance? }
 */
workoutsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date, type, duration, calories, intensity, category, time, distance } = req.body;

    if (!date || !type || !duration || !calories || !intensity || !category) {
      res.status(400).json({ error: '请提供完整的运动信息' });
      return;
    }

    const validIntensity = ['low', 'medium', 'high', 'medium-high'];
    const validCategory = ['aerobic', 'resistance'];

    if (!validIntensity.includes(intensity)) {
      res.status(400).json({ error: '无效的运动强度' });
      return;
    }
    if (!validCategory.includes(category)) {
      res.status(400).json({ error: '无效的运动类别' });
      return;
    }

    const { data: entry, error } = await supabaseAdmin
      .from('workout_entries')
      .insert({
        user_id: req.userId,
        entry_date: date,
        type,
        duration,
        calories,
        intensity,
        category,
        time_of_day: time || null,
        distance: distance || null,
      })
      .select('*')
      .single();

    if (error) {
      res.status(500).json({ error: '添加运动记录失败' });
      return;
    }

    res.json({
      workout: {
        id: entry.id,
        type: entry.type,
        duration: entry.duration,
        calories: entry.calories,
        intensity: entry.intensity,
        category: entry.category,
        time: entry.time_of_day,
        distance: entry.distance,
      },
    });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * DELETE /api/workouts/:id
 * Delete a workout entry.
 */
workoutsRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('workout_entries')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing) {
      res.status(404).json({ error: '运动记录未找到' });
      return;
    }

    if (existing.user_id !== req.userId) {
      res.status(403).json({ error: '无权删除此记录' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('workout_entries')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: '删除失败' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../supabase/client';

export const weightsRouter = Router();

/**
 * GET /api/weights?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Get weight entries in a date range.
 */
weightsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      res.status(400).json({ error: '请提供日期范围参数 from 和 to' });
      return;
    }

    const { data: entries, error } = await supabaseAdmin
      .from('weight_entries')
      .select('id, entry_date, weight')
      .eq('user_id', req.userId)
      .gte('entry_date', String(from))
      .lte('entry_date', String(to))
      .order('entry_date', { ascending: true });

    if (error) {
      res.status(500).json({ error: '查询失败' });
      return;
    }

    res.json({
      entries: (entries || []).map((e) => ({
        id: e.id,
        entryDate: e.entry_date,
        weight: e.weight,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/weights
 * Upsert a weight entry for a specific date.
 * Body: { date: "YYYY-MM-DD", weight: 72.5 }
 */
weightsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date, weight } = req.body;

    if (!date || weight === undefined) {
      res.status(400).json({ error: '请提供 date 和 weight 字段' });
      return;
    }

    const { data: entry, error } = await supabaseAdmin
      .from('weight_entries')
      .upsert(
        {
          user_id: req.userId,
          entry_date: date,
          weight: parseFloat(weight),
        },
        { onConflict: 'user_id,entry_date' }
      )
      .select('id, entry_date, weight')
      .single();

    if (error) {
      res.status(500).json({ error: '保存体重记录失败' });
      return;
    }

    res.json({
      entry: {
        id: entry.id,
        entryDate: entry.entry_date,
        weight: entry.weight,
      },
    });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * DELETE /api/weights/:date
 * Delete weight entry for a specific date.
 */
weightsRouter.delete('/:date', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date } = req.params;

    const { error } = await supabaseAdmin
      .from('weight_entries')
      .delete()
      .eq('user_id', req.userId)
      .eq('entry_date', date);

    if (error) {
      res.status(500).json({ error: '删除失败' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

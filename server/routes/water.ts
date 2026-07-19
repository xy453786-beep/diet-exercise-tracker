import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../supabase/client';

export const waterRouter = Router();

/**
 * GET /api/water?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Get water intakes in a date range.
 */
waterRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      res.status(400).json({ error: '请提供日期范围参数 from 和 to' });
      return;
    }

    const { data: entries, error } = await supabaseAdmin
      .from('water_intakes')
      .select('entry_date, amount_ml')
      .eq('user_id', req.userId)
      .gte('entry_date', String(from))
      .lte('entry_date', String(to));

    if (error) {
      res.status(500).json({ error: '查询饮水记录失败' });
      return;
    }

    // Return as record keyed by date
    const intakes: Record<string, number> = {};
    for (const e of entries || []) {
      intakes[e.entry_date] = e.amount_ml;
    }

    res.json({ intakes });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * PUT /api/water
 * Set (or add to) water intake for a date.
 * Body: { date, amount }
 * Query param: ?mode=add (defaults to set)
 */
waterRouter.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date, amount } = req.body;
    const mode = req.query.mode === 'add' ? 'add' : 'set';

    if (!date || amount === undefined) {
      res.status(400).json({ error: '请提供 date 和 amount 字段' });
      return;
    }

    if (mode === 'add') {
      // Get current amount, then add
      const { data: existing } = await supabaseAdmin
        .from('water_intakes')
        .select('amount_ml')
        .eq('user_id', req.userId)
        .eq('entry_date', date)
        .maybeSingle();

      const currentAmount = existing?.amount_ml || 0;
      const newAmount = Math.min(4000, currentAmount + parseInt(amount, 10));

      const { data: entry, error } = await supabaseAdmin
        .from('water_intakes')
        .upsert(
          {
            user_id: req.userId,
            entry_date: date,
            amount_ml: newAmount,
          },
          { onConflict: 'user_id,entry_date' }
        )
        .select('entry_date, amount_ml')
        .single();

      if (error) {
        res.status(500).json({ error: '更新饮水记录失败' });
        return;
      }

      res.json({ entryDate: entry.entry_date, amountMl: entry.amount_ml });
    } else {
      // Set mode: directly set the amount
      const { data: entry, error } = await supabaseAdmin
        .from('water_intakes')
        .upsert(
          {
            user_id: req.userId,
            entry_date: date,
            amount_ml: Math.max(0, parseInt(amount, 10)),
          },
          { onConflict: 'user_id,entry_date' }
        )
        .select('entry_date, amount_ml')
        .single();

      if (error) {
        res.status(500).json({ error: '更新饮水记录失败' });
        return;
      }

      res.json({ entryDate: entry.entry_date, amountMl: entry.amount_ml });
    }
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

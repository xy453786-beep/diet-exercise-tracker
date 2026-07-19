import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../supabase/client';

export const mealsRouter = Router();

const MEAL_META: Record<string, { name: string; icon: string }> = {
  breakfast: { name: '早餐', icon: '🌅' },
  lunch: { name: '午餐', icon: '☀️' },
  dinner: { name: '晚餐', icon: '🌙' },
};

/**
 * Ensure a meal_record row exists for the given user/date/category.
 * Returns the meal record ID.
 */
async function ensureMealRecord(
  userId: string,
  date: string,
  category: string
): Promise<string> {
  // Check existing
  const { data: existing } = await supabaseAdmin
    .from('meal_records')
    .select('id')
    .eq('user_id', userId)
    .eq('entry_date', date)
    .eq('category', category)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new
  const meta = MEAL_META[category] || { name: category, icon: '🍽️' };
  const { data: created } = await supabaseAdmin
    .from('meal_records')
    .insert({
      user_id: userId,
      entry_date: date,
      category,
      name: meta.name,
      icon: meta.icon,
    })
    .select('id')
    .single();

  if (!created) throw new Error('Failed to create meal record');
  return created.id;
}

/**
 * GET /api/meals?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Get all meal records with their items for a date range.
 */
mealsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      res.status(400).json({ error: '请提供日期范围参数 from 和 to' });
      return;
    }

    // Fetch meal records
    const { data: records, error } = await supabaseAdmin
      .from('meal_records')
      .select('id, entry_date, category, name, icon')
      .eq('user_id', req.userId)
      .gte('entry_date', String(from))
      .lte('entry_date', String(to))
      .order('entry_date', { ascending: true })
      .order('category', { ascending: true });

    if (error) {
      res.status(500).json({ error: '查询饮食记录失败' });
      return;
    }

    if (!records || records.length === 0) {
      res.json({ mealsByDay: {} });
      return;
    }

    // Fetch all items for these meal records
    const recordIds = records.map((r) => r.id);
    const { data: allItems, error: itemsError } = await supabaseAdmin
      .from('meal_items')
      .select('id, meal_record_id, name, calories, protein, carbs, fat, portion, image')
      .in('meal_record_id', recordIds)
      .order('created_at', { ascending: true });

    if (itemsError) {
      res.status(500).json({ error: '查询食物条目失败' });
      return;
    }

    // Group items by meal_record_id
    const itemsByRecord: Record<string, any[]> = {};
    for (const item of allItems || []) {
      if (!itemsByRecord[item.meal_record_id]) {
        itemsByRecord[item.meal_record_id] = [];
      }
      itemsByRecord[item.meal_record_id].push({
        id: item.id,
        name: item.name,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        portion: item.portion,
        image: item.image,
      });
    }

    // Build mealsByDay response
    const mealsByDay: Record<string, any[]> = {};
    for (const record of records) {
      if (!mealsByDay[record.entry_date]) {
        mealsByDay[record.entry_date] = [];
      }
      mealsByDay[record.entry_date].push({
        id: record.id,
        category: record.category,
        name: record.name,
        icon: record.icon,
        items: itemsByRecord[record.id] || [],
      });
    }

    res.json({ mealsByDay });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/meals/items
 * Add a food item to a meal. Auto-creates the meal record if needed.
 * Body: { date, category, item: { name, calories, protein, carbs, fat, portion, image? } }
 */
mealsRouter.post('/items', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date, category, item } = req.body;

    if (!date || !category || !item?.name || item.calories === undefined) {
      res.status(400).json({ error: '请提供 date, category, 和 item (name, calories) 字段' });
      return;
    }

    if (!MEAL_META[category]) {
      res.status(400).json({ error: `无效的餐次类别: ${category}` });
      return;
    }

    // Ensure meal record exists
    const mealRecordId = await ensureMealRecord(req.userId, date, category);

    // Insert the food item
    const { data: created, error } = await supabaseAdmin
      .from('meal_items')
      .insert({
        meal_record_id: mealRecordId,
        name: item.name,
        calories: item.calories,
        protein: item.protein || 0,
        carbs: item.carbs || 0,
        fat: item.fat || 0,
        portion: item.portion || '1份',
        image: item.image || null,
      })
      .select('id, name, calories, protein, carbs, fat, portion, image')
      .single();

    if (error) {
      res.status(500).json({ error: '添加食物失败' });
      return;
    }

    res.json({ item: created });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * DELETE /api/meals/items/:itemId
 * Delete a specific meal item.
 */
mealsRouter.delete('/items/:itemId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;

    // Verify ownership through the meal record chain
    const { data: item } = await supabaseAdmin
      .from('meal_items')
      .select('meal_record_id')
      .eq('id', itemId)
      .single();

    if (!item) {
      res.status(404).json({ error: '食物条目未找到' });
      return;
    }

    const { data: record } = await supabaseAdmin
      .from('meal_records')
      .select('user_id')
      .eq('id', item.meal_record_id)
      .single();

    if (!record || record.user_id !== req.userId) {
      res.status(403).json({ error: '无权删除此条目' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('meal_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      res.status(500).json({ error: '删除失败' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

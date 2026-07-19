import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../supabase/client';

export const profileRouter = Router();

/**
 * GET /api/profile
 * Get current user's full profile.
 */
profileRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, avatar_url, height')
      .eq('id', req.userId)
      .single();

    if (error || !profile) {
      res.status(404).json({ error: '用户信息未找到' });
      return;
    }

    // Get latest weight
    const { data: latestWeight } = await supabaseAdmin
      .from('weight_entries')
      .select('weight')
      .eq('user_id', req.userId)
      .order('entry_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    res.json({
      id: profile.id,
      username: profile.username,
      avatarUrl: profile.avatar_url,
      height: profile.height || 178,
      weight: latestWeight?.weight || null,
    });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * PUT /api/profile
 * Update profile fields. Only provided fields are updated.
 * Body: { username?, avatarUrl?, height? }
 */
profileRouter.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (req.body.username !== undefined) updates.username = req.body.username;
    if (req.body.avatarUrl !== undefined) updates.avatar_url = req.body.avatarUrl;
    if (req.body.height !== undefined) updates.height = req.body.height;

    if (Object.keys(updates).length <= 1) {
      res.status(400).json({ error: '未提供要更新的字段' });
      return;
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', req.userId)
      .select('id, username, avatar_url, height')
      .single();

    if (error) {
      res.status(500).json({ error: '更新失败' });
      return;
    }

    res.json({
      id: profile.id,
      username: profile.username,
      avatarUrl: profile.avatar_url,
      height: profile.height,
    });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

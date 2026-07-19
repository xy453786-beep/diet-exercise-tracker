import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../supabase/client';

export const authRouter = Router();

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile.
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
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
      user: {
        id: profile.id,
        username: profile.username,
        avatarUrl: profile.avatar_url,
        height: profile.height,
        weight: latestWeight?.weight || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

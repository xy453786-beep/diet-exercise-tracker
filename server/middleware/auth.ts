import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../supabase/client';

// Augment Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证令牌' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: '认证令牌无效或已过期' });
      return;
    }

    req.userId = data.user.id;
    next();
  } catch {
    res.status(401).json({ error: '认证验证失败' });
  }
}

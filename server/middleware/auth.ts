import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../supabase/client';

// Augment Express Request to include userId (optional with optionalAuth)
declare global {
  namespace Express {
    interface Request {
      userId: string | undefined;
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

/**
 * 可选认证中间件 — 尽可能获取用户身份，但不强制。
 *
 * - 无 Bearer token → req.userId = undefined，直接放行
 * - 有 token 但验证失败 → 记录 warning 日志，req.userId = undefined，放行
 * - 有 token 且验证通过 → req.userId = data.user.id，放行
 *
 * 用于允许游客调用的接口（如 AI 食物分析），同时保留有 token 时的用户身份。
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 无 token — 游客模式放行
    req.userId = undefined;
    next();
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      console.warn('[optionalAuth] token 验证失败，以游客身份继续:', error?.message);
      req.userId = undefined;
      next();
      return;
    }

    req.userId = data.user.id;
    next();
  } catch (err: any) {
    console.warn('[optionalAuth] token 验证异常，以游客身份继续:', err.message);
    req.userId = undefined;
    next();
  }
}

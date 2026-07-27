import { Request, Response, NextFunction } from 'express';
import { DEMO_USER_ID } from '../constants';

// Augment Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

/**
 * 注入 Demo 用户中间件。
 *
 * 所有请求无条件使用 DEMO_USER_ID，不校验任何 token。
 * 适用于无登录系统的 Vibe Coding 展示项目。
 */
export function injectDemoUser(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  req.userId = DEMO_USER_ID;
  next();
}

// 保留旧名称导出兼容（实际均使用 injectDemoUser）
export const requireAuth = injectDemoUser;
export const optionalAuth = injectDemoUser;

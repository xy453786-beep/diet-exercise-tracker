// ============================================================
// 全局常量
// ============================================================

/**
 * Demo 用户 ID（固定，不依赖 Supabase Auth）。
 *
 * 使用前需在 Supabase 执行：
 *   INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
 *   VALUES ('00000000-0000-0000-0000-000000000001', 'demo@app.com', '',
 *           '{"username":"Demo用户"}', now(), now());
 *   INSERT INTO public.profiles (id, username, height, has_completed_survey, updated_at)
 *   VALUES ('00000000-0000-0000-0000-000000000001', 'Demo用户', 178, true, now());
 */
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

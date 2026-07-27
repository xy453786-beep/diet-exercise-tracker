-- ============================================================
-- 创建 demo 用户（无登录系统，固定用户 ID 管理数据）
-- 在 Supabase Dashboard → SQL Editor 执行
-- ============================================================

-- 1) 在 auth.users 创建 demo 用户（供外键约束使用）
INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@app.com',
  '',
  '{"username":"Demo用户"}',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- 2) 创建对应的 profile
INSERT INTO public.profiles (id, username, height, has_completed_survey, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo用户', 178, true, now()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS 策略：允许 anon key 读写 demo 用户的数据
-- ============================================================

-- profiles 表：字段名为 id
DROP POLICY IF EXISTS anon_demo_profiles ON public.profiles;
CREATE POLICY anon_demo_profiles ON public.profiles
  FOR ALL
  USING (id = '00000000-0000-0000-0000-000000000001');

-- 有 user_id 字段的业务表
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'meal_records', 'workout_entries',
    'weight_entries', 'water_intakes', 'user_metrics',
    'weight_predictions', 'ai_diet_analyses'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS anon_demo_all ON %I; CREATE POLICY anon_demo_all ON %I FOR ALL USING (user_id = %L) WITH CHECK (user_id = %L);',
      t, t, '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    );
  END LOOP;
END $$;

-- meal_items：无 user_id 字段，通过 meal_record_id 关联到 meal_records
-- 为简化 demo，允许 anon 对所有 meal_items 进行操作
DROP POLICY IF EXISTS anon_demo_meal_items ON public.meal_items;
CREATE POLICY anon_demo_meal_items ON public.meal_items
  FOR ALL USING (true) WITH CHECK (true);

-- ai_analysis_ingredients：无 user_id 字段，通过 analysis_id 关联到 ai_diet_analyses
DROP POLICY IF EXISTS anon_demo_ai_ingredients ON public.ai_analysis_ingredients;
CREATE POLICY anon_demo_ai_ingredients ON public.ai_analysis_ingredients
  FOR ALL USING (true) WITH CHECK (true);

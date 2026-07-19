-- ============================================================
-- 健康管理 App — Supabase 初始数据库迁移
-- ============================================================

-- 1. profiles: 用户扩展信息
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL DEFAULT '健康达人',
  avatar_url TEXT,
  height NUMERIC(5,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: 用户只能读写自己的 profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger: 自动创建 profile（新用户注册时）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, height)
  VALUES (NEW.id, '健康达人', NEW.raw_user_meta_data->>'avatar_url', 175);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. weight_entries: 体重记录
CREATE TABLE IF NOT EXISTS weight_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  weight NUMERIC(5,1) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own weights"
  ON weight_entries FOR ALL
  USING (auth.uid() = user_id);


-- 3. meal_records: 餐次记录
CREATE TABLE IF NOT EXISTS meal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('breakfast', 'lunch', 'dinner')),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE meal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meal records"
  ON meal_records FOR ALL
  USING (auth.uid() = user_id);


-- 4. meal_items: 食物条目
CREATE TABLE IF NOT EXISTS meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_record_id UUID NOT NULL REFERENCES meal_records(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein NUMERIC(5,1) DEFAULT 0,
  carbs NUMERIC(5,1) DEFAULT 0,
  fat NUMERIC(5,1) DEFAULT 0,
  portion TEXT,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meal items"
  ON meal_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM meal_records
      WHERE meal_records.id = meal_items.meal_record_id
      AND meal_records.user_id = auth.uid()
    )
  );


-- 5. workout_entries: 运动记录
CREATE TABLE IF NOT EXISTS workout_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  type TEXT NOT NULL,
  duration TEXT NOT NULL,
  calories INTEGER NOT NULL,
  intensity TEXT NOT NULL CHECK (intensity IN ('low', 'medium', 'high', 'medium-high')),
  category TEXT NOT NULL CHECK (category IN ('aerobic', 'resistance')),
  time_of_day TEXT,
  distance TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE workout_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workouts"
  ON workout_entries FOR ALL
  USING (auth.uid() = user_id);


-- 6. water_intakes: 饮水记录
CREATE TABLE IF NOT EXISTS water_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  amount_ml INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

ALTER TABLE water_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own water intakes"
  ON water_intakes FOR ALL
  USING (auth.uid() = user_id);


-- 7. ai_diet_analyses: AI 饮食分析
CREATE TABLE IF NOT EXISTS ai_diet_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein_amount INTEGER,
  protein_percentage INTEGER,
  carbs_amount INTEGER,
  carbs_percentage INTEGER,
  fat_amount INTEGER,
  fat_percentage INTEGER,
  optimization_suggestion TEXT,
  exercise_suggestion TEXT,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_diet_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own analyses"
  ON ai_diet_analyses FOR ALL
  USING (auth.uid() = user_id);


-- 8. ai_analysis_ingredients: AI 分析食材明细
CREATE TABLE IF NOT EXISTS ai_analysis_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES ai_diet_analyses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  portion TEXT,
  calories INTEGER NOT NULL
);

ALTER TABLE ai_analysis_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own analysis ingredients"
  ON ai_analysis_ingredients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ai_diet_analyses
      WHERE ai_diet_analyses.id = ai_analysis_ingredients.analysis_id
      AND ai_diet_analyses.user_id = auth.uid()
    )
  );

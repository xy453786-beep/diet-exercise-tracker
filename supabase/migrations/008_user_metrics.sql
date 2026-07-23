-- ============================================================
-- 008_user_metrics: 动态 BMR/TDEE 计算系统
--
-- 每次用户添加/修改/删除食物、运动、饮水、体重记录后，
-- 自动用热量盈余估算最新体重，重算 BMR/TDEE 并存表。
-- 前端通过 Supabase Realtime 订阅实时变化。
-- ============================================================

-- 1. user_metrics 表
CREATE TABLE IF NOT EXISTS user_metrics (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_weight NUMERIC(6,2) NOT NULL,
  bmr INTEGER NOT NULL,
  tdee INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metrics"
  ON user_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own metrics"
  ON user_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metrics"
  ON user_metrics FOR UPDATE
  USING (auth.uid() = user_id);

-- 加入 Realtime publication（前端实时订阅）
-- REPLICA IDENTITY FULL 确保 Realtime 在 UPDATE 时发送完整行数据
ALTER TABLE user_metrics REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE user_metrics;

-- 性能索引（加速热量盈余查询中的 JOIN 和日期筛选）
CREATE INDEX IF NOT EXISTS idx_meal_records_user_date
  ON meal_records(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_workout_entries_user_date
  ON workout_entries(user_id, entry_date);


-- 2. 核心计算函数
CREATE OR REPLACE FUNCTION public.update_metrics_for_user(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_height       NUMERIC(5,1);
  v_age          INTEGER;
  v_gender       TEXT;
  v_activity_level TEXT;
  v_last_weight  NUMERIC(6,2);
  v_last_weigh_date DATE;
  v_total_intake INTEGER;
  v_total_workout_burn INTEGER;
  v_days_since   INTEGER;
  v_activity_factor NUMERIC(5,3);
  v_approx_bmr   INTEGER;
  v_approx_tdee  INTEGER;
  v_total_burn   INTEGER;
  v_surplus      INTEGER;
  v_weight_delta NUMERIC(8,4);
  v_today_water_ml INTEGER;
  v_water_weight NUMERIC(6,2);
  v_current_weight NUMERIC(6,2);
  v_bmr          INTEGER;
  v_tdee         INTEGER;
BEGIN
  -- Step 1: 取用户档案（带默认值）
  SELECT height, COALESCE(age, 30), COALESCE(gender, 'male'), COALESCE(activity_level, 'sedentary')
  INTO v_height, v_age, v_gender, v_activity_level
  FROM profiles WHERE id = p_user_id;

  IF v_height IS NULL OR v_height <= 0 THEN v_height := 175; END IF;

  -- Step 2: 取最近体重记录
  SELECT weight, entry_date INTO v_last_weight, v_last_weigh_date
  FROM weight_entries
  WHERE user_id = p_user_id
  ORDER BY entry_date DESC
  LIMIT 1;

  IF v_last_weight IS NULL OR v_last_weight <= 0 THEN
    v_last_weight := 70;
    v_last_weigh_date := CURRENT_DATE;
  END IF;

  -- Step 3: 热量盈余 = 总摄入 - 总消耗

  -- 3a. 总摄入（从最后称重日至今所有食物的热量之和）
  SELECT COALESCE(SUM(mi.calories), 0) INTO v_total_intake
  FROM meal_items mi
  JOIN meal_records mr ON mi.meal_record_id = mr.id
  WHERE mr.user_id = p_user_id
    AND mr.entry_date >= v_last_weigh_date;

  -- 3b. 总运动消耗
  SELECT COALESCE(SUM(calories), 0) INTO v_total_workout_burn
  FROM workout_entries
  WHERE user_id = p_user_id
    AND entry_date >= v_last_weigh_date;

  -- 3c. 距离最后称重日的天数
  v_days_since := CURRENT_DATE - v_last_weigh_date;

  -- 3d. 活动系数
  CASE v_activity_level
    WHEN 'sedentary'    THEN v_activity_factor := 1.2;
    WHEN 'light'        THEN v_activity_factor := 1.375;
    WHEN 'moderate'     THEN v_activity_factor := 1.55;
    WHEN 'active'       THEN v_activity_factor := 1.725;
    WHEN 'very_active'  THEN v_activity_factor := 1.9;
    ELSE v_activity_factor := 1.2;
  END CASE;

  -- 3e. 用 last_weight 近似计算每日 TDEE（避免循环依赖）
  IF v_gender = 'male' THEN
    v_approx_bmr := ROUND(10 * v_last_weight + 6.25 * v_height - 5 * v_age + 5);
  ELSE
    v_approx_bmr := ROUND(10 * v_last_weight + 6.25 * v_height - 5 * v_age - 161);
  END IF;
  v_approx_tdee := ROUND(v_approx_bmr * v_activity_factor);

  -- 3f. 总消耗 = 运动消耗 + 每日 TDEE × (天数+1)（含今天）
  v_total_burn := v_total_workout_burn + (v_approx_tdee * (v_days_since + 1));

  -- 3g. 盈余 + 体重变化（7700 kcal = 1 kg）
  v_surplus := v_total_intake - v_total_burn;
  v_weight_delta := v_surplus::NUMERIC / 7700.0;

  -- Step 4: 水重（当日饮水 × 0.5，取体内留存均值）
  SELECT COALESCE(amount_ml, 0) INTO v_today_water_ml
  FROM water_intakes
  WHERE user_id = p_user_id AND entry_date = CURRENT_DATE;

  v_water_weight := (v_today_water_ml::NUMERIC / 1000.0) * 0.5;

  -- Step 5: 当前体重（限制合理范围）
  v_current_weight := v_last_weight + v_weight_delta + v_water_weight;
  IF v_current_weight < 30  THEN v_current_weight := 30;  END IF;
  IF v_current_weight > 300 THEN v_current_weight := 300; END IF;

  -- Step 6: BMR（Mifflin-St Jeor）
  IF v_gender = 'male' THEN
    v_bmr := ROUND(10 * v_current_weight + 6.25 * v_height - 5 * v_age + 5);
  ELSE
    v_bmr := ROUND(10 * v_current_weight + 6.25 * v_height - 5 * v_age - 161);
  END IF;

  -- Step 7: TDEE
  v_tdee := ROUND(v_bmr * v_activity_factor);

  -- Step 8: Upsert
  INSERT INTO user_metrics (user_id, current_weight, bmr, tdee, updated_at)
  VALUES (p_user_id, v_current_weight, v_bmr, v_tdee, now())
  ON CONFLICT (user_id) DO UPDATE SET
    current_weight = EXCLUDED.current_weight,
    bmr            = EXCLUDED.bmr,
    tdee           = EXCLUDED.tdee,
    updated_at     = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. 统一触发器函数（根据 TG_TABLE_NAME 自动提取 user_id）
CREATE OR REPLACE FUNCTION public.trg_update_metrics()
RETURNS trigger AS $$
DECLARE
  p_user_id UUID;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'meal_items' THEN
      IF TG_OP = 'DELETE' THEN
        SELECT user_id INTO p_user_id FROM meal_records WHERE id = OLD.meal_record_id;
      ELSE
        SELECT user_id INTO p_user_id FROM meal_records WHERE id = NEW.meal_record_id;
      END IF;

    WHEN 'workout_entries' THEN
      IF TG_OP = 'DELETE' THEN p_user_id := OLD.user_id;
      ELSE p_user_id := NEW.user_id;
      END IF;

    WHEN 'water_intakes' THEN
      p_user_id := NEW.user_id;

    WHEN 'weight_entries' THEN
      IF TG_OP = 'DELETE' THEN p_user_id := OLD.user_id;
      ELSE p_user_id := NEW.user_id;
      END IF;

    WHEN 'profiles' THEN
      p_user_id := NEW.id;

    ELSE
      RETURN NULL;
  END CASE;

  IF p_user_id IS NOT NULL THEN
    PERFORM update_metrics_for_user(p_user_id);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. 在五个表上创建触发器

-- 4a. meal_items（食物条目变化 → 热量摄入变化）
DROP TRIGGER IF EXISTS trg_meal_items_metrics ON meal_items;
CREATE TRIGGER trg_meal_items_metrics
  AFTER INSERT OR UPDATE OR DELETE ON meal_items
  FOR EACH ROW EXECUTE FUNCTION trg_update_metrics();

-- 4b. workout_entries（运动记录变化 → 消耗变化）
DROP TRIGGER IF EXISTS trg_workout_metrics ON workout_entries;
CREATE TRIGGER trg_workout_metrics
  AFTER INSERT OR UPDATE OR DELETE ON workout_entries
  FOR EACH ROW EXECUTE FUNCTION trg_update_metrics();

-- 4c. water_intakes（饮水变化 → 水重变化）
DROP TRIGGER IF EXISTS trg_water_metrics ON water_intakes;
CREATE TRIGGER trg_water_metrics
  AFTER INSERT OR UPDATE ON water_intakes
  FOR EACH ROW EXECUTE FUNCTION trg_update_metrics();

-- 4d. weight_entries（体重记录变化 → 重置基准线）
DROP TRIGGER IF EXISTS trg_weight_metrics ON weight_entries;
CREATE TRIGGER trg_weight_metrics
  AFTER INSERT OR UPDATE ON weight_entries
  FOR EACH ROW EXECUTE FUNCTION trg_update_metrics();

-- 4e. profiles（档案参数变化 → 影响 BMR/TDEE 计算）
DROP TRIGGER IF EXISTS trg_profile_metrics ON profiles;
CREATE TRIGGER trg_profile_metrics
  AFTER UPDATE OF height, age, gender, activity_level ON profiles
  FOR EACH ROW EXECUTE FUNCTION trg_update_metrics();

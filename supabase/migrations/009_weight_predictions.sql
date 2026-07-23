-- ============================================================
-- 009_weight_predictions: 体重预测自动重算系统
--
-- 每次用户添加/修改/删除食物、运动、体重记录后，
-- 自动用日均热量差 / 7700 × 天数 算出 7 天和 30 天后的预测体重（斤），
-- 存入 weight_predictions 表。前端通过 Supabase Realtime 订阅实时变化。
-- ============================================================

-- 1. weight_predictions 表
CREATE TABLE IF NOT EXISTS weight_predictions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  predicted_weight_7d_jin NUMERIC(6,2) NOT NULL,   -- 7天后预测体重（斤）
  predicted_weight_30d_jin NUMERIC(6,2) NOT NULL,  -- 30天后预测体重（斤）
  base_weight_kg NUMERIC(6,2) NOT NULL,            -- 预测基准体重（kg）
  avg_daily_surplus INTEGER NOT NULL,              -- 日均热量差（kcal），负数为赤字
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE weight_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own predictions"
  ON weight_predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own predictions"
  ON weight_predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own predictions"
  ON weight_predictions FOR UPDATE
  USING (auth.uid() = user_id);

-- 加入 Realtime publication（前端实时订阅）
ALTER TABLE weight_predictions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE weight_predictions;


-- 2. 核心预测函数
CREATE OR REPLACE FUNCTION public.update_weight_prediction(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_height          NUMERIC(5,1);
  v_age             INTEGER;
  v_gender          TEXT;
  v_activity_level  TEXT;
  v_activity_factor NUMERIC(5,3);
  v_base_weight     NUMERIC(6,2);
  v_approx_bmr      INTEGER;
  v_approx_tdee     INTEGER;
  v_lookback_days   INTEGER := 7;
  v_avg_intake      NUMERIC(10,2);
  v_avg_workout     NUMERIC(10,2);
  v_avg_surplus     NUMERIC(10,2);
  v_delta_7d_kg     NUMERIC(8,4);
  v_delta_30d_kg    NUMERIC(8,4);
  v_pred_7d_jin     NUMERIC(6,2);
  v_pred_30d_jin    NUMERIC(6,2);
BEGIN
  -- Step 1: 取用户档案
  SELECT height, COALESCE(age, 30), COALESCE(gender, 'male'), COALESCE(activity_level, 'sedentary')
  INTO v_height, v_age, v_gender, v_activity_level
  FROM profiles WHERE id = p_user_id;

  IF v_height IS NULL OR v_height <= 0 THEN v_height := 175; END IF;

  -- Step 2: 取当前估算体重（优先 user_metrics，其次 weight_entries，最后默认 70kg）
  SELECT current_weight INTO v_base_weight
  FROM user_metrics WHERE user_id = p_user_id;

  IF v_base_weight IS NULL OR v_base_weight <= 0 THEN
    SELECT weight INTO v_base_weight
    FROM weight_entries
    WHERE user_id = p_user_id
    ORDER BY entry_date DESC LIMIT 1;

    IF v_base_weight IS NULL OR v_base_weight <= 0 THEN
      v_base_weight := 70;
    END IF;
  END IF;

  -- Step 3: 活动系数
  CASE v_activity_level
    WHEN 'sedentary'    THEN v_activity_factor := 1.2;
    WHEN 'light'        THEN v_activity_factor := 1.375;
    WHEN 'moderate'     THEN v_activity_factor := 1.55;
    WHEN 'active'       THEN v_activity_factor := 1.725;
    WHEN 'very_active'  THEN v_activity_factor := 1.9;
    ELSE v_activity_factor := 1.2;
  END CASE;

  -- Step 4: 基于基准体重估算 TDEE
  IF v_gender = 'male' THEN
    v_approx_bmr := ROUND(10 * v_base_weight + 6.25 * v_height - 5 * v_age + 5);
  ELSE
    v_approx_bmr := ROUND(10 * v_base_weight + 6.25 * v_height - 5 * v_age - 161);
  END IF;
  v_approx_tdee := ROUND(v_approx_bmr * v_activity_factor);

  -- Step 5: 最近 7 天平均每日摄入
  SELECT COALESCE(SUM(mi.calories), 0)::NUMERIC / v_lookback_days INTO v_avg_intake
  FROM meal_items mi
  JOIN meal_records mr ON mi.meal_record_id = mr.id
  WHERE mr.user_id = p_user_id
    AND mr.entry_date >= (CURRENT_DATE - (v_lookback_days - 1));

  -- Step 6: 最近 7 天平均每日运动消耗
  SELECT COALESCE(SUM(calories), 0)::NUMERIC / v_lookback_days INTO v_avg_workout
  FROM workout_entries
  WHERE user_id = p_user_id
    AND entry_date >= (CURRENT_DATE - (v_lookback_days - 1));

  -- Step 7: 日均热量差 = 摄入 - 运动消耗 - TDEE
  v_avg_surplus := v_avg_intake - v_avg_workout - v_approx_tdee;

  -- Step 8: 预测体重变化 = 日均热量差 / 7700 × 天数（7700 kcal = 1 kg）
  v_delta_7d_kg := v_avg_surplus / 7700.0 * 7;
  v_delta_30d_kg := v_avg_surplus / 7700.0 * 30;

  -- Step 9: 转换为斤（1 kg = 2 斤）
  v_pred_7d_jin := ROUND((v_base_weight + v_delta_7d_kg) * 2, 2);
  v_pred_30d_jin := ROUND((v_base_weight + v_delta_30d_kg) * 2, 2);

  -- Step 10: 限制合理范围（60 斤 = 30 kg，600 斤 = 300 kg）
  IF v_pred_7d_jin < 60 THEN v_pred_7d_jin := 60; END IF;
  IF v_pred_7d_jin > 600 THEN v_pred_7d_jin := 600; END IF;
  IF v_pred_30d_jin < 60 THEN v_pred_30d_jin := 60; END IF;
  IF v_pred_30d_jin > 600 THEN v_pred_30d_jin := 600; END IF;

  -- Step 11: Upsert
  INSERT INTO weight_predictions
    (user_id, predicted_weight_7d_jin, predicted_weight_30d_jin,
     base_weight_kg, avg_daily_surplus, updated_at)
  VALUES
    (p_user_id, v_pred_7d_jin, v_pred_30d_jin,
     v_base_weight, ROUND(v_avg_surplus), now())
  ON CONFLICT (user_id) DO UPDATE SET
    predicted_weight_7d_jin  = EXCLUDED.predicted_weight_7d_jin,
    predicted_weight_30d_jin = EXCLUDED.predicted_weight_30d_jin,
    base_weight_kg           = EXCLUDED.base_weight_kg,
    avg_daily_surplus        = EXCLUDED.avg_daily_surplus,
    updated_at               = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. 修改统一触发器函数，在更新 user_metrics 后也更新 weight_predictions
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
    PERFORM update_weight_prediction(p_user_id);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

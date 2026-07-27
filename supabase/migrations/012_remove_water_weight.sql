-- ============================================================
-- 012_remove_water_weight: 移除此前加入的水重估算逻辑
--
-- 之前 update_metrics_for_user() 会把当日饮水 × 0.5 算入
-- current_weight，导致喝水后体重预测随即跳动，让用户困惑。
-- 水重是短时水分波动，不应影响中长期体重预测的基准值。
-- ============================================================

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

  -- Step 4: 当前体重（仅基于热量盈余，不含短期水重）
  v_current_weight := v_last_weight + v_weight_delta;
  IF v_current_weight < 30  THEN v_current_weight := 30;  END IF;
  IF v_current_weight > 300 THEN v_current_weight := 300; END IF;

  -- Step 5: BMR（Mifflin-St Jeor）
  IF v_gender = 'male' THEN
    v_bmr := ROUND(10 * v_current_weight + 6.25 * v_height - 5 * v_age + 5);
  ELSE
    v_bmr := ROUND(10 * v_current_weight + 6.25 * v_height - 5 * v_age - 161);
  END IF;

  -- Step 6: TDEE
  v_tdee := ROUND(v_bmr * v_activity_factor);

  -- Step 7: Upsert
  INSERT INTO user_metrics (user_id, current_weight, bmr, tdee, updated_at)
  VALUES (p_user_id, v_current_weight, v_bmr, v_tdee, now())
  ON CONFLICT (user_id) DO UPDATE SET
    current_weight = EXCLUDED.current_weight,
    bmr            = EXCLUDED.bmr,
    tdee           = EXCLUDED.tdee,
    updated_at     = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

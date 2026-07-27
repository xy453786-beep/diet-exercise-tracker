-- ============================================================
-- 011_adaptive_weight_prediction: 自适应体重预测
--
-- 在原有纯公式预测基础上，根据历史实际体重数据计算个人
-- 代谢校正系数（correction_factor），让预测越来越贴合
-- 个人的真实代谢特征，而非死套 7700 kcal = 1 kg 的通用值。
--
-- 原理：
--   每次有新的体重记录时，对比「公式预测的变化量」vs
--   「实际变化量」，算出比值，用指数平滑法更新校正系数。
--   后续预测 = 公式预测 × 校正系数。
-- ============================================================

-- 1. 添加校正系数字段
ALTER TABLE weight_predictions
  ADD COLUMN IF NOT EXISTS correction_factor NUMERIC(5,3) NOT NULL DEFAULT 1.000;

COMMENT ON COLUMN weight_predictions.correction_factor
  IS '个人代谢校正系数：公式预测 × 系数 = 校正后预测。1.0=未校正，<1=代谢比公式慢，>1=代谢比公式快';


-- 2. 核心预测函数（自适应版本）
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

  -- 自适应校正相关变量
  v_w1_weight       NUMERIC(6,2);
  v_w1_date         DATE;
  v_w2_weight       NUMERIC(6,2);
  v_w2_date         DATE;
  v_days_between    INTEGER;
  v_actual_daily    NUMERIC(10,6);    -- 每日实际体重变化（kg/天）
  v_period_intake   NUMERIC(10,2);    -- 期间总摄入
  v_period_workout  NUMERIC(10,2);    -- 期间总运动消耗
  v_predicted_total NUMERIC(10,6);    -- 公式预测的期间总变化
  v_predicted_daily NUMERIC(10,6);    -- 公式预测的每日变化
  v_raw_ratio       NUMERIC(10,6);    -- 实际/预测比值
  v_old_factor      NUMERIC(5,3);     -- 旧的校正系数
  v_new_factor      NUMERIC(5,3);     -- 新的校正系数
  v_weight_count    INTEGER;
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

  -- Step 8: 公式预测体重变化 = 日均热量差 / 7700 × 天数
  v_delta_7d_kg := v_avg_surplus / 7700.0 * 7;
  v_delta_30d_kg := v_avg_surplus / 7700.0 * 30;

  -- ============================================================
  -- Step 9: 自适应校正系数计算
  -- ============================================================

  -- 9a. 读取旧的校正系数（如果有）
  SELECT correction_factor INTO v_old_factor
  FROM weight_predictions
  WHERE user_id = p_user_id;

  IF v_old_factor IS NULL OR v_old_factor <= 0 THEN
    v_old_factor := 1.0;
  END IF;

  -- 9b. 获取最近 2 次体重记录（用于计算实际变化 vs 公式预测）
  SELECT COUNT(*) INTO v_weight_count
  FROM weight_entries
  WHERE user_id = p_user_id;

  v_new_factor := v_old_factor;  -- 默认保持旧值

  IF v_weight_count >= 2 THEN
    -- 取最近两次体重记录（最新为 w2，上一次为 w1）
    WITH ranked AS (
      SELECT weight, entry_date,
             ROW_NUMBER() OVER (ORDER BY entry_date DESC) AS rn
      FROM weight_entries
      WHERE user_id = p_user_id AND weight > 0
    )
    SELECT w2.weight, w2.entry_date, w1.weight, w1.entry_date
    INTO v_w2_weight, v_w2_date, v_w1_weight, v_w1_date
    FROM ranked w2, ranked w1
    WHERE w2.rn = 1 AND w1.rn = 2;

    v_days_between := v_w2_date - v_w1_date;

    -- 要求至少间隔 3 天，避免单日水分波动干扰
    IF v_days_between >= 3 THEN
      -- 实际每日变化
      v_actual_daily := (v_w2_weight - v_w1_weight)::NUMERIC / v_days_between;

      -- 计算公式对该期间预测的每日变化
      -- 期间总摄入
      SELECT COALESCE(SUM(mi.calories), 0) INTO v_period_intake
      FROM meal_items mi
      JOIN meal_records mr ON mi.meal_record_id = mr.id
      WHERE mr.user_id = p_user_id
        AND mr.entry_date >= v_w1_date
        AND mr.entry_date < v_w2_date;

      -- 期间总运动消耗
      SELECT COALESCE(SUM(calories), 0) INTO v_period_workout
      FROM workout_entries
      WHERE user_id = p_user_id
        AND entry_date >= v_w1_date
        AND entry_date < v_w2_date;

      -- 公式预测期间总变化 = (总摄入 - 总运动 - TDEE × 天数) / 7700
      v_predicted_total := (v_period_intake - v_period_workout - v_approx_tdee * v_days_between) / 7700.0;
      v_predicted_daily := v_predicted_total / v_days_between;

      -- 只在公式预测变化量 >= 0.05 kg/天（约 385 kcal 赤字/盈余）时才有意义
      -- 太小的预测值信噪比低，容易因水分波动产生误导
      IF ABS(v_predicted_daily) >= 0.007 THEN
        -- 计算比值（需符号一致，否则说明公式方向都错了，跳过不更新）
        IF (v_actual_daily >= 0 AND v_predicted_daily >= 0)
           OR (v_actual_daily <= 0 AND v_predicted_daily <= 0) THEN
          v_raw_ratio := v_actual_daily / v_predicted_daily;

          -- 限制极端值 [0.2, 3.0]
          IF v_raw_ratio < 0.2 THEN v_raw_ratio := 0.2; END IF;
          IF v_raw_ratio > 3.0 THEN v_raw_ratio := 3.0; END IF;

          -- 指数平滑：新因子 = 旧 × 0.6 + 新比值 × 0.4
          -- 权重偏向历史，防止单次水分波动过度影响
          v_new_factor := ROUND((v_old_factor * 0.6 + v_raw_ratio * 0.4)::NUMERIC, 3);

          -- 再次限幅
          IF v_new_factor < 0.2 THEN v_new_factor := 0.2; END IF;
          IF v_new_factor > 3.0 THEN v_new_factor := 3.0; END IF;
        END IF;
        -- 符号不一致（公式说减但实际增，或反之）→ 跳过，保留旧因子
      END IF;
      -- 预测变化太接近零 → 跳过，保留旧因子
    END IF;
    -- 间隔 < 3 天 → 跳过，保留旧因子
  END IF;
  -- 少于 2 条体重记录 → 保持 1.0 默认值

  -- ============================================================
  -- Step 10: 应用校正
  -- ============================================================
  v_delta_7d_kg := v_delta_7d_kg * v_new_factor;
  v_delta_30d_kg := v_delta_30d_kg * v_new_factor;

  -- Step 11: 转换为斤（1 kg = 2 斤）
  v_pred_7d_jin := ROUND((v_base_weight + v_delta_7d_kg) * 2, 2);
  v_pred_30d_jin := ROUND((v_base_weight + v_delta_30d_kg) * 2, 2);

  -- Step 12: 限制合理范围
  IF v_pred_7d_jin < 60 THEN v_pred_7d_jin := 60; END IF;
  IF v_pred_7d_jin > 600 THEN v_pred_7d_jin := 600; END IF;
  IF v_pred_30d_jin < 60 THEN v_pred_30d_jin := 60; END IF;
  IF v_pred_30d_jin > 600 THEN v_pred_30d_jin := 600; END IF;

  -- Step 13: Upsert
  INSERT INTO weight_predictions
    (user_id, predicted_weight_7d_jin, predicted_weight_30d_jin,
     base_weight_kg, avg_daily_surplus, correction_factor, updated_at)
  VALUES
    (p_user_id, v_pred_7d_jin, v_pred_30d_jin,
     v_base_weight, ROUND(v_avg_surplus), v_new_factor, now())
  ON CONFLICT (user_id) DO UPDATE SET
    predicted_weight_7d_jin  = EXCLUDED.predicted_weight_7d_jin,
    predicted_weight_30d_jin = EXCLUDED.predicted_weight_30d_jin,
    base_weight_kg           = EXCLUDED.base_weight_kg,
    avg_daily_surplus        = EXCLUDED.avg_daily_surplus,
    correction_factor        = EXCLUDED.correction_factor,
    updated_at               = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

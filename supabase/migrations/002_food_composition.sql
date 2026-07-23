-- ============================================================
-- 中国食物成分表 — 公开参考数据表
-- 数据来源: https://github.com/Sanotsu/china-food-composition-data
-- 数据版本: json_data_vision_251206_Qwen2-5-VL-72B-Instruct (约 1,677 条)
-- ============================================================

-- 启用 pg_trgm 扩展用于中文模糊匹配
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS food_composition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_code TEXT UNIQUE NOT NULL,       -- 食物编码 (如 111101x)
  food_name TEXT NOT NULL,              -- 食物名称 (如 鸡蛋（代表值）)
  category TEXT NOT NULL,               -- 大类 (如 蛋类及其制品)
  subcategory TEXT,                     -- 小类 (如 鸡蛋)
  energy_kcal NUMERIC(7,2),             -- 热量 kcal/100g
  energy_kj NUMERIC(7,2),               -- 热量 kJ/100g
  protein NUMERIC(5,2),                 -- 蛋白质 g/100g
  fat NUMERIC(5,2),                     -- 脂肪 g/100g
  carbs NUMERIC(5,2),                   -- 碳水 g/100g (原 CHO 字段)
  dietary_fiber NUMERIC(5,2),           -- 膳食纤维 g/100g
  cholesterol NUMERIC(7,2),             -- 胆固醇 mg/100g
  water NUMERIC(5,2),                   -- 水分 g/100g
  edible NUMERIC(5,2),                  -- 可食部 %
  ash NUMERIC(5,2),                     -- 灰分 g/100g
  vitamin_a NUMERIC(7,2),               -- 维生素A μgRAE/100g
  carotene NUMERIC(7,2),                -- 胡萝卜素 μg/100g
  retinol NUMERIC(7,2),                 -- 视黄醇 μg/100g
  thiamin NUMERIC(5,2),                 -- 硫胺素 mg/100g (维生素B1)
  riboflavin NUMERIC(5,2),              -- 核黄素 mg/100g (维生素B2)
  niacin NUMERIC(5,2),                  -- 烟酸 mg/100g (维生素B3)
  vitamin_c NUMERIC(5,2),               -- 维生素C mg/100g
  vitamin_e_total NUMERIC(5,2),         -- 总维生素E mg/100g
  ca NUMERIC(7,2),                      -- 钙 mg/100g
  p NUMERIC(7,2),                       -- 磷 mg/100g
  k NUMERIC(7,2),                       -- 钾 mg/100g
  na NUMERIC(7,2),                      -- 钠 mg/100g
  mg NUMERIC(7,2),                      -- 镁 mg/100g
  fe NUMERIC(5,2),                      -- 铁 mg/100g
  zn NUMERIC(5,2),                      -- 锌 mg/100g
  se NUMERIC(7,2),                      -- 硒 μg/100g
  cu NUMERIC(5,2),                      -- 铜 mg/100g
  mn NUMERIC(5,2),                      -- 锰 mg/100g
  remark TEXT,                          -- 备注
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIN 索引：pg_trgm 模糊匹配（支持中文三元组相似度搜索）
CREATE INDEX IF NOT EXISTS idx_food_name_trgm
  ON food_composition USING GIN (food_name gin_trgm_ops);

-- B-tree 索引：精确匹配和前缀搜索
CREATE INDEX IF NOT EXISTS idx_food_name
  ON food_composition (food_name);

-- 分类索引
CREATE INDEX IF NOT EXISTS idx_food_category
  ON food_composition (category);

-- RLS: 公开参考数据，允许所有人读取
ALTER TABLE food_composition ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON food_composition;
CREATE POLICY "Public read access"
  ON food_composition FOR SELECT
  USING (true);

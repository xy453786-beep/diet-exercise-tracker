-- ============================================================
-- 004_food_cache: 食物识别缓存表
--
-- 缓存所有外部数据源的查询结果，下次相同食物优先从本地读取。
-- 支持用户手动校正（is_user_calibrated 标记，校正值优先）。
-- ============================================================

-- 1. 创建 food_cache 表
CREATE TABLE IF NOT EXISTS food_cache (
  id              BIGSERIAL PRIMARY KEY,
  food_name       TEXT NOT NULL,
  brand           TEXT,
  barcode         TEXT,
  net_weight_g    REAL,
  energy_kcal     REAL NOT NULL,
  protein_g       REAL DEFAULT 0,
  carbs_g         REAL DEFAULT 0,
  fat_g           REAL DEFAULT 0,
  per100g         JSONB,
  source          TEXT NOT NULL CHECK (source IN (
                    'open_food_facts',
                    'nutrition_label',
                    'usda',
                    'snacks_db',
                    'food_composition',
                    'ai_estimated'
                  )),
  is_user_calibrated BOOLEAN DEFAULT FALSE,
  user_calories   REAL,
  user_weight_g   REAL,
  lookup_count    INT DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_food_cache_name_brand
  ON food_cache(food_name, COALESCE(brand, ''));

CREATE INDEX IF NOT EXISTS idx_food_cache_barcode
  ON food_cache(barcode) WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_food_cache_lookup
  ON food_cache(lookup_count DESC);

-- 3. RLS: 公开读取（缓存全院共享）
ALTER TABLE food_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Food cache public read" ON food_cache;
CREATE POLICY "Food cache public read" ON food_cache
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Food cache authenticated insert" ON food_cache;
CREATE POLICY "Food cache authenticated insert" ON food_cache
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Food cache authenticated update" ON food_cache;
CREATE POLICY "Food cache authenticated update" ON food_cache
  FOR UPDATE
  USING (true);

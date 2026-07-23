-- ============================================================
-- 005_food_cache_add_sources: 新增 barcode_scan + aliyun_ocr
--
-- 重构后新增两种数据来源，需要更新 CHECK 约束。
-- ============================================================

-- 删除旧约束（PostgreSQL 自动生成的名称）
ALTER TABLE food_cache DROP CONSTRAINT IF EXISTS food_cache_source_check;

-- 重新创建约束（包含新增的两个 source）
ALTER TABLE food_cache ADD CONSTRAINT food_cache_source_check CHECK (source IN (
  'barcode_scan',
  'open_food_facts',
  'nutrition_label',
  'aliyun_ocr',
  'usda',
  'snacks_db',
  'food_composition',
  'ai_estimated'
));

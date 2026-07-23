-- ============================================================
-- 010_food_cache_add_snack_search: 新增 snack_search 数据来源
--
-- 零食联网搜索功能引入新的数据来源，需要更新 CHECK 约束。
-- ============================================================

-- 删除旧约束
ALTER TABLE food_cache DROP CONSTRAINT IF EXISTS food_cache_source_check;

-- 重新创建约束（新增 snack_search）
ALTER TABLE food_cache ADD CONSTRAINT food_cache_source_check CHECK (source IN (
  'barcode_scan',
  'open_food_facts',
  'nutrition_label',
  'aliyun_ocr',
  'usda',
  'snacks_db',
  'food_composition',
  'snack_search',
  'ai_estimated'
));

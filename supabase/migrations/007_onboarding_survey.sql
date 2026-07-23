-- ============================================================
-- 007_onboarding_survey: 新用户调研问卷
-- 给 profiles 表添加性别、年龄、活动水平、问卷完成标记
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activity_level TEXT DEFAULT 'sedentary';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_completed_survey BOOLEAN DEFAULT FALSE;

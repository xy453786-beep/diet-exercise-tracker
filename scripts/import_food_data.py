#!/usr/bin/env python3
"""
中国食物成分表 数据导入脚本
================================
从 GitHub 仓库 Sanotsu/china-food-composition-data 下载 JSON 数据，
解析并批量导入到 Supabase food_composition 表中。

数据来源: json_data_vision_251206_Qwen2-5-VL-72B-Instruct/ (约 1,677 条记录)

用法:
  1. pip install supabase python-dotenv requests
  2. python scripts/import_food_data.py

环境变量 (从项目根目录 .env 读取):
  SUPABASE_URL           - Supabase 项目 URL
  SUPABASE_SERVICE_ROLE_KEY - Supabase service_role key (绕过 RLS)
"""

import os
import sys
import json
import re
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from supabase import create_client, Client

# ============================================================
# 配置
# ============================================================

GITHUB_REPO = "Sanotsu/china-food-composition-data"
GITHUB_BRANCH = "main"
DATA_FOLDER = "json_data_vision_251206_Qwen2-5-VL-72B-Instruct"
GITHUB_API_URL = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{DATA_FOLDER}?ref={GITHUB_BRANCH}"
GITHUB_RAW_BASE = f"https://raw.githubusercontent.com/{GITHUB_REPO}/{GITHUB_BRANCH}/{DATA_FOLDER}"

BATCH_SIZE = 100  # 每批 upsert 条数


# ============================================================
# 辅助函数
# ============================================================

def safe_numeric(value: str):
    """
    将字符串转为 float（JSON 可序列化，直接用于 Supabase）。
    特殊值处理:
      - "—" (未检测)    → None (NULL)
      - "Tr" (微量)     → 0.001
      - "(0)" (估计0值) → 0
      - "un" (不能计算) → None (NULL)
      - "" (空字符串)   → None (NULL)
    """
    if not isinstance(value, str):
        return None
    v = value.strip()
    if v in ("—", "un", "", ".."):
        return None
    if v == "Tr":
        return 0.001
    if v == "(0)":
        return 0.0
    # 某些值末尾带星号 * (参考值标记)
    v = v.rstrip("*")
    # 去掉千分位逗号
    v = v.replace(",", "")
    try:
        return float(v)
    except (ValueError, OverflowError):
        return None


def parse_category_from_filename(filename: str):
    """
    从文件名解析 category 和 subcategory。
    文件名格式: merged_{category}-{subcategory}.json
    示例:
      "merged_蛋类及其制品-鸡蛋.json" → ("蛋类及其制品", "鸡蛋")
      "merged_蔬菜类及其制品-嫩茎叶花菜类.json" → ("蔬菜类及其制品", "嫩茎叶花菜类")
      "merged_植物油-植物油.json" → ("植物油", None)
    """
    name = filename.replace(".json", "")
    # 去掉 merged_ 或 merged- 前缀
    name = re.sub(r"^merged[_-]", "", name)
    parts = name.split("-", 1)
    category = parts[0]
    subcategory = parts[1] if len(parts) > 1 else None
    # 如果 subcategory 和 category 相同，设为 None
    if subcategory == category:
        subcategory = None
    return category, subcategory


def load_env():
    """加载项目根目录 .env 文件"""
    # 从脚本路径推断项目根目录
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    env_path = project_root / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✅ 已加载环境变量: {env_path}")
    else:
        print(f"⚠️ 未找到 .env 文件: {env_path}")
        print("   请确保在项目根目录创建 .env 文件")


def get_supabase_client() -> Client:
    """初始化 Supabase 客户端"""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("❌ 缺少环境变量 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY")
        print("   请在 .env 文件中配置")
        sys.exit(1)
    return create_client(url, key)


def fetch_file_list():
    """从 GitHub API 获取 DATA_FOLDER 下的所有 JSON 文件"""
    headers = {"Accept": "application/vnd.github.v3+json"}
    print(f"📡 获取文件列表: {GITHUB_API_URL}")
    resp = requests.get(GITHUB_API_URL, headers=headers, timeout=30)
    resp.raise_for_status()
    files = []
    for item in resp.json():
        if item["type"] == "file" and item["name"].endswith(".json"):
            files.append(item["name"])
    print(f"   找到 {len(files)} 个 JSON 文件")
    return files


def download_and_parse(filename: str):
    """下载单个 JSON 文件并解析（支持多镜像重试）"""
    # 多镜像地址列表（优先使用速度最快的）
    urls = [
        f"{GITHUB_RAW_BASE}/{filename}",
        f"https://ghproxy.net/https://raw.githubusercontent.com/{GITHUB_REPO}/{GITHUB_BRANCH}/{DATA_FOLDER}/{filename}",
        f"https://gh-proxy.com/https://raw.githubusercontent.com/{GITHUB_REPO}/{GITHUB_BRANCH}/{DATA_FOLDER}/{filename}",
    ]

    last_err = None
    for attempt, url in enumerate(urls):
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            raw_data = resp.json()
            break
        except requests.exceptions.SSLError as e:
            last_err = e
            if attempt < len(urls) - 1:
                time.sleep(0.5)
                continue
            raise
        except Exception as e:
            last_err = e
            if attempt < len(urls) - 1:
                time.sleep(0.5)
                continue
            raise
    else:
        raise last_err or Exception(f"无法下载 {filename}")

    category, subcategory = parse_category_from_filename(filename)
    records = []
    skipped = 0

    for item in raw_data:
        food_name = (item.get("foodName") or "").strip()
        food_code = (item.get("foodCode") or "").strip()

        if not food_name or not food_code:
            skipped += 1
            continue

        record = {
            "food_code": food_code,
            "food_name": food_name,
            "category": category,
            "subcategory": subcategory,
            "energy_kcal": safe_numeric(item.get("energyKCal", "")),
            "energy_kj": safe_numeric(item.get("energyKJ", "")),
            "protein": safe_numeric(item.get("protein", "")),
            "fat": safe_numeric(item.get("fat", "")),
            "carbs": safe_numeric(item.get("CHO", "")),
            "dietary_fiber": safe_numeric(item.get("dietaryFiber", "")),
            "cholesterol": safe_numeric(item.get("cholesterol", "")),
            "water": safe_numeric(item.get("water", "")),
            "edible": safe_numeric(item.get("edible", "")),
            "ash": safe_numeric(item.get("ash", "")),
            "vitamin_a": safe_numeric(item.get("vitaminA", "")),
            "carotene": safe_numeric(item.get("carotene", "")),
            "retinol": safe_numeric(item.get("retinol", "")),
            "thiamin": safe_numeric(item.get("thiamin", "")),
            "riboflavin": safe_numeric(item.get("riboflavin", "")),
            "niacin": safe_numeric(item.get("niacin", "")),
            "vitamin_c": safe_numeric(item.get("vitaminC", "")),
            "vitamin_e_total": safe_numeric(item.get("vitaminETotal", "")),
            "ca": safe_numeric(item.get("Ca", "")),
            "p": safe_numeric(item.get("P", "")),
            "k": safe_numeric(item.get("K", "")),
            "na": safe_numeric(item.get("Na", "")),
            "mg": safe_numeric(item.get("Mg", "")),
            "fe": safe_numeric(item.get("Fe", "")),
            "zn": safe_numeric(item.get("Zn", "")),
            "se": safe_numeric(item.get("Se", "")),
            "cu": safe_numeric(item.get("Cu", "")),
            "mn": safe_numeric(item.get("Mn", "")),
            "remark": (item.get("remark") or "").strip() or None,
        }
        records.append(record)

    return records, skipped


def clear_table(supabase: Client):
    """清空 food_composition 表"""
    print("🗑️  清空现有数据...")
    try:
        # 批量删除所有记录
        while True:
            resp = (
                supabase.table("food_composition")
                .select("id")
                .limit(500)
                .execute()
            )
            ids = [r["id"] for r in resp.data]
            if not ids:
                break
            supabase.table("food_composition").delete().in_("id", ids).execute()
        print("   表已清空")
    except Exception as e:
        print(f"   ⚠️ 清空表时出错 (可忽略): {e}")


def batch_upsert(supabase: Client, records: list, batch_size: int = BATCH_SIZE):
    """批量 upsert 记录到 Supabase"""
    total = len(records)
    imported = 0

    for i in range(0, total, batch_size):
        batch = records[i : i + batch_size]
        try:
            result = (
                supabase.table("food_composition")
                .upsert(batch, on_conflict="food_code")
                .execute()
            )
            imported += len(batch)
            progress = min(i + batch_size, total)
            print(f"   [{progress}/{total}] 已导入 {progress} 条 ({progress*100//total}%)")
        except Exception as e:
            print(f"   ❌ 批次 {i//batch_size} 导入失败: {e}")
            # 逐条重试
            for record in batch:
                try:
                    supabase.table("food_composition").upsert(
                        record, on_conflict="food_code"
                    ).execute()
                    imported += 1
                except Exception as e2:
                    print(f"      ❌ {record['food_name']}: {e2}")
                    continue

    return imported


# ============================================================
# 主流程
# ============================================================

def main():
    print("=" * 60)
    print("🍎 中国食物成分表数据导入脚本")
    print("=" * 60)

    # 1. 加载环境变量
    load_env()

    # 2. 初始化 Supabase
    supabase = get_supabase_client()
    print("✅ Supabase 连接成功")

    # 3. 获取文件列表
    files = fetch_file_list()

    # 4. 下载并解析所有文件
    all_records = []
    total_skipped = 0

    print("\n📥 下载并解析 JSON 数据...")
    for idx, filename in enumerate(files, 1):
        category, subcategory = parse_category_from_filename(filename)
        try:
            records, skipped = download_and_parse(filename)
            all_records.extend(records)
            total_skipped += skipped
            print(f"   [{idx:2d}/{len(files)}] {filename} → {len(records)} 条 "
                  f"({category} / {subcategory or '—'})")
        except Exception as e:
            print(f"   [{idx:2d}/{len(files)}] ❌ {filename}: {e}")

    print(f"\n📊 解析完成: 共 {len(all_records)} 条有效记录, 跳过 {total_skipped} 条")

    if not all_records:
        print("❌ 没有数据可导入")
        sys.exit(1)

    # 5. 清空表
    print("\n🧹 准备导入...")
    clear_table(supabase)

    # 6. 批量导入
    print(f"\n💾 批量导入 {len(all_records)} 条记录...")
    imported = batch_upsert(supabase, all_records)
    print(f"\n✅ 导入完成! 成功: {imported} 条, 总计: {len(all_records)} 条")

    # 7. 验证
    print("\n🔍 验证数据...")
    count_resp = supabase.table("food_composition").select("id", count="exact").execute()
    print(f"   数据库共 {count_resp.count} 条记录")

    # 各类别统计
    cat_resp = (
        supabase.table("food_composition")
        .select("category")
        .execute()
    )
    cats = {}
    for r in cat_resp.data:
        c = r["category"]
        cats[c] = cats.get(c, 0) + 1
    print("   各类别分布:")
    for cat, cnt in sorted(cats.items()):
        print(f"     {cat}: {cnt} 条")


if __name__ == "__main__":
    main()

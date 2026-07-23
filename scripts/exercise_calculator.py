#!/usr/bin/env python3
"""
运动热量计算模块 — 本地 MET 映射表 + GLM-4-Flash 兜底
=====================================================

基于《中国居民膳食指南》和《身体活动汇编》(Compendium of Physical Activities)
的 MET（代谢当量）标准值，通过模糊匹配 + AI 兜底计算运动消耗热量。

公式: 热量(kcal) = MET × 体重(kg) × 时间(h)

用法:
  # 命令行
  python exercise_calculator.py "慢跑" 70 30
  python exercise_calculator.py "跑步" 70 30 --user-id=abc123

  # Python 模块
  from exercise_calculator import calculate_exercise_burn, add_custom_exercise
  result = calculate_exercise_burn("慢跑", 70, 30, user_id="abc123")

依赖:
  pip install requests python-dotenv
  (sqlite3, difflib, json 均为标准库)

环境变量 (从 ../../.env 读取):
  ZHIPU_API_KEY — 智谱 API Key (GLM-4-Flash 兜底用，可选)
"""

import os
import sys
import json
import sqlite3
from pathlib import Path
from difflib import get_close_matches
from typing import Optional, Tuple

# ============================================================
# Part 0: 环境初始化
# ============================================================

# 数据库文件路径（与脚本同目录）
DB_PATH = Path(__file__).parent / "exercise_met.db"

# 尝试加载 .env（可选，没有 dotenv 也能跑）
try:
    from dotenv import load_dotenv
    _ENV_FILE = Path(__file__).parent.parent / ".env"
    load_dotenv(_ENV_FILE)
except ImportError:
    pass


# ============================================================
# Part 1: MET 值对照表
# 数据来源：《中国居民膳食指南》、《身体活动汇编》
# ============================================================

MET_TABLE: dict[str, float] = {
    # ── 跑步类 ──
    "跑步": 7.0,
    "慢跑": 7.0,
    "快跑": 9.0,
    "冲刺跑": 12.0,
    "马拉松": 8.5,

    # ── 走路类 ──
    "快走": 4.5,
    "散步": 3.0,
    "慢走": 3.0,
    "健走": 5.0,
    "竞走": 6.5,

    # ── 水上运动 ──
    "游泳": 6.0,
    "自由泳": 7.0,
    "蛙泳": 5.5,
    "仰泳": 4.5,
    "蝶泳": 8.0,

    # ── 跳跃类 ──
    "跳绳": 8.0,
    "慢速跳绳": 6.0,
    "开合跳": 8.0,
    "波比跳": 10.0,

    # ── 瑜伽 / 拉伸 ──
    "瑜伽": 2.5,
    "哈他瑜伽": 2.5,
    "流瑜伽": 3.5,
    "普拉提": 3.0,
    "拉伸": 2.0,
    "冥想": 1.0,

    # ── 力量训练 ──
    "力量训练": 5.0,
    "举重": 6.0,
    "俯卧撑": 3.8,
    "深蹲": 5.0,
    "引体向上": 5.5,
    "仰卧起坐": 3.8,
    "哑铃训练": 4.5,
    "杠铃训练": 5.5,

    # ── 单车类 ──
    "动感单车": 7.5,
    "骑行": 6.0,
    "自行车": 6.0,
    "山地骑行": 8.0,

    # ── 球类 ──
    "篮球": 6.5,
    "足球": 7.0,
    "羽毛球": 5.5,
    "乒乓球": 4.0,
    "网球": 7.0,
    "排球": 4.5,
    "高尔夫": 3.5,

    # ── 健身操 ──
    "健身操": 5.5,
    "有氧操": 6.0,
    "HIIT": 8.0,
    "Tabata": 9.0,
    "踏板操": 6.5,
    "搏击操": 7.5,

    # ── 日常活动 ──
    "爬楼梯": 6.0,
    "登山": 6.5,
    "跳舞": 5.0,
    "街舞": 6.5,
    "拳击": 9.0,
    "太极拳": 3.0,
    "八段锦": 2.5,
    "广场舞": 4.0,
    "遛狗": 2.5,
    "做家务": 2.8,
}


# ============================================================
# Part 2: SQLite 用户自定义运动库
# ============================================================

def _get_db() -> sqlite3.Connection:
    """获取数据库连接（自动建表）"""
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row
    db.execute("""
        CREATE TABLE IF NOT EXISTS user_exercise_met (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT    NOT NULL,
            exercise_name TEXT  NOT NULL,
            met_value   REAL    NOT NULL,
            created_at  TEXT    DEFAULT (datetime('now')),
            UNIQUE(user_id, exercise_name)
        )
    """)
    db.commit()
    return db


def add_custom_exercise(user_id: str, exercise_name: str, met_value: float) -> dict:
    """
    添加或更新用户自定义运动的 MET 值。

    Returns:
        {"success": True, "exercise_name": "...", "met_value": 6.0}
    """
    if not user_id or not exercise_name:
        return {"success": False, "error": "user_id 和 exercise_name 不能为空"}
    if met_value <= 0 or met_value > 25:
        return {"success": False, "error": "MET 值必须在 0~25 之间"}

    db = _get_db()
    try:
        db.execute(
            "INSERT OR REPLACE INTO user_exercise_met (user_id, exercise_name, met_value, created_at) "
            "VALUES (?, ?, ?, datetime('now'))",
            (user_id, exercise_name.strip(), met_value),
        )
        db.commit()
        return {"success": True, "exercise_name": exercise_name.strip(), "met_value": met_value}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        db.close()


def remove_custom_exercise(user_id: str, exercise_name: str) -> dict:
    """删除用户自定义运动"""
    db = _get_db()
    try:
        db.execute(
            "DELETE FROM user_exercise_met WHERE user_id = ? AND exercise_name = ?",
            (user_id, exercise_name.strip()),
        )
        db.commit()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        db.close()


def list_custom_exercises(user_id: str) -> list[dict]:
    """列出用户的所有自定义运动"""
    db = _get_db()
    try:
        rows = db.execute(
            "SELECT exercise_name, met_value, created_at FROM user_exercise_met WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        db.close()


def _lookup_custom(user_id: str, exercise_name: str) -> Tuple[str, float] | None:
    """在用户自定义库中查找运动（精确匹配）"""
    db = _get_db()
    try:
        row = db.execute(
            "SELECT exercise_name, met_value FROM user_exercise_met WHERE user_id = ? AND exercise_name = ?",
            (user_id, exercise_name.strip()),
        ).fetchone()
        if row:
            return row["exercise_name"], row["met_value"]
        return None
    finally:
        db.close()


# ============================================================
# Part 3: 模糊匹配（Python difflib.get_close_matches）
# ============================================================

def match_exercise(name: str, cutoff: float = 0.4) -> Tuple[str, float] | None:
    """
    模糊匹配运动名称 → (标准化名称, MET值)

    使用 Python difflib.get_close_matches，基于
    最长公共子序列（SequenceMatcher）计算相似度。

    Args:
        name: 用户输入的运动名称（如 "跑步"、"满跑"）
        cutoff: 最低相似度阈值 (0~1)

    Returns:
        (标准化运动名, MET值) 或 None
    """
    if not name or not name.strip():
        return None

    cleaned = name.strip()

    # 1) 先尝试精确匹配（忽略大小写）
    for key in MET_TABLE:
        if key.lower() == cleaned.lower():
            return key, MET_TABLE[key]

    # 2) difflib 模糊匹配
    matches = get_close_matches(cleaned, MET_TABLE.keys(), n=1, cutoff=cutoff)
    if matches:
        key = matches[0]
        return key, MET_TABLE[key]

    return None


# ============================================================
# Part 4: GLM-4-Flash 兜底估算
# ============================================================

GLM_ESTIMATE_PROMPT = """# 角色
你是运动生理学专家，精通《身体活动汇编》(Compendium of Physical Activities) 中的 MET 值标准。

# 任务
根据用户输入的运动描述，估算该运动的 MET（代谢当量）值。

# MET 值参考
- 1.0~2.0: 静坐、办公、冥想、轻微拉伸
- 2.0~3.5: 散步、太极拳、瑜伽、做家务
- 3.5~5.0: 快走、乒乓球、高尔夫
- 5.0~7.0: 慢跑、骑行、力量训练、篮球
- 7.0~9.0: 快跑、跳绳、HIIT、动感单车
- 9.0~12.0: 冲刺跑、拳击、Tabata、波比跳
- 12.0+: 竞技比赛级别强度

# 输出格式
严格只输出 JSON（不要 markdown 代码块，不要任何额外文字）：
{"exercise_name":"标准化运动名","met_value":6.0,"reasoning":"简短依据"}

# 示例
输入: 攀岩
输出: {"exercise_name":"攀岩","met_value":7.5,"reasoning":"攀岩属于高强度全身运动，参考《身体活动汇编》约7~8 MET"}
"""


def estimate_met_via_glm(exercise_name: str) -> dict | None:
    """
    通过 GLM-4-Flash 估算未知运动的 MET 值。

    Returns:
        {"exercise_name": str, "met_value": float, "reasoning": str} 或 None
    """
    zhipu_key = os.environ.get("ZHIPU_API_KEY", "").strip()

    if not zhipu_key:
        print("[exercise_calculator] ZHIPU_API_KEY 未配置，跳过 GLM 兜底", file=sys.stderr)
        return None

    try:
        import requests
    except ImportError:
        print("[exercise_calculator] requests 库未安装，跳过 GLM 兜底", file=sys.stderr)
        return None

    try:
        resp = requests.post(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {zhipu_key}",
            },
            json={
                "model": "glm-4-flash",
                "messages": [
                    {"role": "system", "content": GLM_ESTIMATE_PROMPT},
                    {"role": "user", "content": f"请估算：{exercise_name}"},
                ],
                "temperature": 0.1,
                "max_tokens": 256,
            },
            timeout=15,
        )

        if resp.status_code == 200:
            data = resp.json()
            text = data.get("choices", [{}])[0].get("message", {}).get("content", "")

            if text:
                json_str = text.strip()
                if json_str.startswith("```json"):
                    json_str = json_str[7:]
                elif json_str.startswith("```"):
                    json_str = json_str[3:]
                if json_str.endswith("```"):
                    json_str = json_str[:-3]
                json_str = json_str.strip()

                parsed = json.loads(json_str)
                met_val = float(parsed.get("met_value", 0))
                if met_val > 0 and met_val <= 25:
                    return {
                        "exercise_name": parsed.get("exercise_name", exercise_name),
                        "met_value": met_val,
                        "reasoning": parsed.get("reasoning", ""),
                    }
        else:
            print(f"[exercise_calculator] GLM-4-Flash 调用失败: {resp.status_code}", file=sys.stderr)

    except Exception as e:
        print(f"[exercise_calculator] GLM-4-Flash 异常: {e}", file=sys.stderr)

    return None


# ============================================================
# Part 5: 核心计算函数
# ============================================================

def calculate_exercise_burn(
    exercise_name: str,
    weight_kg: float,
    duration_minutes: int,
    user_id: str | None = None,
) -> dict:
    """
    计算运动消耗热量。

    公式: 热量(kcal) = MET × 体重(kg) × 时间(h)

    查找优先级:
        1. 用户自定义库 (SQLite) → source="user_custom"
        2. 本地 MET 表模糊匹配    → source="lookup"
        3. GLM-4-Flash 估算       → source="glm_estimated"
        4. 默认值 5.0 MET         → source="default"

    Args:
        exercise_name: 运动名称（如 "慢跑"、"跑步"、"攀岩"）
        weight_kg: 用户体重 (kg)
        duration_minutes: 运动时长 (分钟)
        user_id: 可选，用于查用户自定义运动库

    Returns:
        {
            "exercise_name": str,          # 标准化后的运动名称
            "met_value": float,            # 使用的 MET 值
            "total_calories_burned": int,  # 消耗热量 (kcal)
            "source": str,                 # "lookup" | "glm_estimated" | "user_custom" | "default"
            "confidence": str,             # "high" | "medium" | "low"
            "reasoning": str | None,       # GLM 返回的依据（仅 glm_estimated）
        }
    """
    if not exercise_name or not exercise_name.strip():
        return _empty_result("运动名称不能为空")
    if weight_kg <= 0 or weight_kg > 300:
        return _empty_result(f"体重必须在 0~300kg 之间，当前: {weight_kg}")
    if duration_minutes <= 0 or duration_minutes > 1440:
        return _empty_result(f"时长必须在 1~1440 分钟之间，当前: {duration_minutes}")

    name = exercise_name.strip()
    met_value: float = 0
    source: str = ""
    confidence: str = ""
    reasoning: str | None = None
    matched_name: str = name

    # ── 优先级 1: 用户自定义库 ──
    if user_id:
        custom = _lookup_custom(user_id, name)
        if custom is not None:
            matched_name, met_value = custom
            source = "user_custom"
            confidence = "high"

    # ── 优先级 2: 本地 MET 表模糊匹配 ──
    if met_value <= 0:
        matched = match_exercise(name)
        if matched is not None:
            matched_name, met_value = matched
            # 判断匹配置信度
            similarity = _calc_similarity(name, matched_name)
            if similarity >= 0.9:
                confidence = "high"
            elif similarity >= 0.6:
                confidence = "medium"
            else:
                confidence = "low"
            source = "lookup"

    # ── 优先级 3: GLM-4-Flash 估算 ──
    if met_value <= 0:
        glm_result = estimate_met_via_glm(name)
        if glm_result is not None and glm_result.get("met_value", 0) > 0:
            matched_name = glm_result["exercise_name"]
            met_value = glm_result["met_value"]
            source = "glm_estimated"
            confidence = "medium"
            reasoning = glm_result.get("reasoning")

    # ── 优先级 4: 绝对兜底 (默认 5.0 MET，中等强度运动) ──
    if met_value <= 0:
        met_value = 5.0
        source = "default"
        confidence = "low"
        reasoning = "未找到匹配运动，使用默认 MET=5.0（中等强度）"

    # 热量计算: MET × 体重(kg) × 时间(h)
    duration_hours = duration_minutes / 60.0
    total_calories = int(round(met_value * weight_kg * duration_hours))

    return {
        "exercise_name": matched_name,
        "met_value": round(met_value, 1),
        "total_calories_burned": total_calories,
        "source": source,
        "confidence": confidence,
        "reasoning": reasoning,
    }


def _calc_similarity(a: str, b: str) -> float:
    """计算两个字符串的编辑距离相似度 (0~1)"""
    from difflib import SequenceMatcher
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _empty_result(reason: str) -> dict:
    return {
        "exercise_name": "",
        "met_value": 0,
        "total_calories_burned": 0,
        "source": "error",
        "confidence": "low",
        "reasoning": reason,
    }


# ============================================================
# Part 6: 命令行入口
# ============================================================

def _parse_args():
    """解析命令行参数"""
    import argparse
    parser = argparse.ArgumentParser(
        description="运动热量计算器 — 基于 MET 映射表 + GLM-4-Flash 兜底",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python exercise_calculator.py "慢跑" 70 30
  python exercise_calculator.py "跑步" 70 30 --user-id abc123
  python exercise_calculator.py "攀岩" 70 45
  python exercise_calculator.py --add-custom "划船机" 6.5 --user-id abc123
  python exercise_calculator.py --list-custom --user-id abc123
  python exercise_calculator.py --remove-custom "划船机" --user-id abc123
        """,
    )
    parser.add_argument("exercise", nargs="?", help="运动名称")
    parser.add_argument("weight", nargs="?", type=float, help="体重 (kg)")
    parser.add_argument("duration", nargs="?", type=int, help="运动时长 (分钟)")
    parser.add_argument("--user-id", default=None, help="用户 ID（查自定义运动库）")
    parser.add_argument("--add-custom", nargs=2, metavar=("NAME", "MET"),
                        help="添加自定义运动: 名称 MET值")
    parser.add_argument("--remove-custom", metavar="NAME",
                        help="删除自定义运动: 名称")
    parser.add_argument("--list-custom", action="store_true",
                        help="列出所有自定义运动")
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    # 自定义运动管理
    if args.add_custom:
        name, met_str = args.add_custom
        result = add_custom_exercise(args.user_id or "default", name, float(met_str))
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(0)

    if args.remove_custom:
        result = remove_custom_exercise(args.user_id or "default", args.remove_custom)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(0)

    if args.list_custom:
        exercises = list_custom_exercises(args.user_id or "default")
        print(json.dumps(exercises, ensure_ascii=False, indent=2))
        sys.exit(0)

    # 计算热量
    if not args.exercise or args.weight is None or args.duration is None:
        print("用法: python exercise_calculator.py <运动名> <体重kg> <时长分钟> [--user-id ID]", file=sys.stderr)
        print("示例: python exercise_calculator.py 慢跑 70 30", file=sys.stderr)
        sys.exit(1)

    result = calculate_exercise_burn(
        exercise_name=args.exercise,
        weight_kg=args.weight,
        duration_minutes=args.duration,
        user_id=args.user_id,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))

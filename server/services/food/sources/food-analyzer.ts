// ============================================================
// Food Name Recognizer — Qwen-VL-Plus 识别食物完整名称
// 支持：品牌+品类+口味（如 "乐事青柠味薯片"）+ 家常菜名
// ============================================================

// DashScope
const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY || '';

// ============================================================
// 主入口：识别图片中的食物完整名称
// ============================================================

export async function callFoodNameRecognizer(imageUrl: string): Promise<string> {
  const t0 = Date.now();
  const foodName = await callDashScope(imageUrl);
  console.log(`[food-analyzer] 识别完成，耗时 ${Date.now() - t0}ms → "${foodName}"`);
  return foodName;
}

// ============================================================
// DashScope Qwen-VL-Plus
// ============================================================

const FOOD_NAME_PROMPT = [
  '识别图片中的食物，输出完整的食物名称。',
  '如果是包装食品/零食/饮料，请包含品牌、品类和口味（例如："乐事青柠味薯片"、"康师傅红烧牛肉面"、"奥利奥巧克力夹心饼干"、"元气森林白桃味苏打气泡水"）。',
  '如果是家常菜/堂食菜品，输出菜名即可（例如："番茄炒鸡蛋"、"宫保鸡丁"）。',
  '如果是水果/生鲜，输出品种名（例如："红富士苹果"、"巨峰葡萄"）。',
  '只输出食物名称，不要解释、不要换行。',
].join(' ');

async function callDashScope(imageUrl: string): Promise<string> {
  if (!DASHSCOPE_KEY) throw new Error('DASHSCOPE_API_KEY not set');

  console.log('[food-analyzer] DashScope Qwen-VL-Plus 识别食物...');

  const resp = await fetch(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DASHSCOPE_KEY}`,
      },
      body: JSON.stringify({
        model: 'qwen-vl-plus',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: FOOD_NAME_PROMPT },
          ],
        }],
        temperature: 0.1,
        max_tokens: 128,
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error(`DashScope ${resp.status}: ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  const text = (data?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('DashScope 返回空内容');

  return text;
}

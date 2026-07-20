export interface ZhipuIngredient {
  name: string;
  weight: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ZhipuFoodAnalysis {
  mealName: string;
  ingredients: ZhipuIngredient[];
  suggestion: string;
  exercise: string;
}

const SYSTEM_PROMPT = `你是一个专业的营养师和食物分析专家。根据食物图片，识别菜品名称、列出所有食材、估算重量和营养成分。

请严格按以下 JSON 格式返回（不要包含 markdown 代码块标记）：

{
  "mealName": "菜品名称（中文）",
  "ingredients": [
    {
      "name": "食材名称",
      "weight": 克数(数字),
      "calories": 总热量千卡(数字),
      "protein": 蛋白质克数(数字),
      "carbs": 碳水化合物克数(数字),
      "fat": 脂肪克数(数字)
    }
  ],
  "suggestion": "饮食优化建议（中文，50字以内）",
  "exercise": "运动建议（中文，50字以内）"
}

注意：
- weight 是单个食材的估重（克），不是每100g的数据
- calories/protein/carbs/fat 是该食材在该重量下的实际数值
- 尽可能识别所有可见食材，至少列出2-5种
- 如果看不清，根据常见做法合理推测
- 保持数值合理：一餐总热量通常在300-1200千卡之间`;

/**
 * Analyze a food image using Zhipu GLM-4V (智谱视觉模型).
 */
export async function analyzeFoodImage(
  imageDataUrl: string,
  apiKey: string
): Promise<ZhipuFoodAnalysis> {
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'glm-4v-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: SYSTEM_PROMPT },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    let msg = `API 请求失败 (${response.status})`;
    try {
      const j = JSON.parse(err);
      msg = j?.error?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('智谱 AI 未返回有效响应');
  }

  // Parse JSON (handle possible markdown code blocks)
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
  else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
  jsonStr = jsonStr.trim();

  const analysis: ZhipuFoodAnalysis = JSON.parse(jsonStr);
  if (!analysis.mealName || !analysis.ingredients?.length) {
    throw new Error('智谱 AI 返回数据不完整');
  }
  return analysis;
}

/** Get Zhipu API key from environment. */
export function getZhipuApiKey(): string | null {
  return import.meta.env.VITE_ZHIPU_API_KEY || null;
}

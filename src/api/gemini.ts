export interface GeminiIngredient {
  name: string;
  weight: number;       // grams
  calories: number;     // total kcal for this ingredient
  protein: number;      // grams
  carbs: number;        // grams
  fat: number;          // grams
}

export interface GeminiFoodAnalysis {
  mealName: string;
  ingredients: GeminiIngredient[];
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
 * Analyze a food image using Gemini Vision REST API (no SDK).
 * Uses direct fetch to avoid SDK compatibility issues with AQ. API keys.
 * @param imageDataUrl - base64 data URL from canvas capture (data:image/jpeg;base64,...)
 * @param apiKey - Gemini API key
 */
export async function analyzeFoodImage(
  imageDataUrl: string,
  apiKey: string
): Promise<GeminiFoodAnalysis> {
  // Extract base64 data (remove "data:image/jpeg;base64," prefix)
  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          },
        ],
      }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `API 请求失败 (${response.status})`;
    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson?.error?.message || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini 未返回有效响应');
  }

  // Parse JSON from response (handle possible markdown code blocks)
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  try {
    const analysis: GeminiFoodAnalysis = JSON.parse(jsonStr);
    // Validate
    if (!analysis.mealName || !analysis.ingredients?.length) {
      throw new Error('Gemini 返回数据不完整');
    }
    return analysis;
  } catch (e: any) {
    if (e instanceof SyntaxError) {
      console.error('Gemini response parse error:', jsonStr);
      throw new Error('AI 分析结果格式异常，请重试');
    }
    throw e;
  }
}

/**
 * Get Gemini API key from environment.
 */
export function getGeminiApiKey(): string | null {
  return import.meta.env.VITE_GEMINI_API_KEY || null;
}

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

const SYSTEM_PROMPT = `你是专业营养师，根据食物图片识别菜品并分析营养。必须只输出 JSON，不准说"抱歉无法识别"。不确定就推测。

常用食物参考（每100g/ml）：
- 黑咖啡 2cal, 美式咖啡 5cal, 拿铁咖啡 60cal, 卡布奇诺 45cal
- 白米饭 116cal, 馒头 223cal, 面条 110cal
- 鸡胸肉 133cal, 三文鱼 208cal, 鸡蛋 144cal
- 西兰花 34cal, 菠菜 23cal, 番茄 18cal
- 牛奶 66cal(全脂)/35cal(脱脂), 酸奶 61cal

严格只输出此 JSON（数字不加引号）：
{"mealName":"菜品","ingredients":[{"name":"食材","weight":总克,"calories":总千卡,"protein":蛋白质克,"carbs":碳水克,"fat":脂肪克}],"suggestion":"优化建议","exercise":"运动建议"}

每次分析必须基于图片实际内容，使用参考数据估算，保证同类食物结果相近。`;

import { supabase } from './client';

/**
 * Upload a base64 image to Supabase Storage and return the public URL.
 */
async function uploadImageToStorage(imageDataUrl: string): Promise<string> {
  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const fileName = `food-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage
    .from('food-photos')
    .upload(fileName, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) throw new Error(`图片上传失败: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from('food-photos')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Analyze a food image using Zhipu GLM-4V (智谱视觉模型).
 * Accepts an image URL (GLM-4V-Flash free tier only supports URLs, not base64).
 */
export async function analyzeFoodImage(
  imageDataUrl: string,
  apiKey: string
): Promise<ZhipuFoodAnalysis> {
  // Step 1: Upload to Supabase Storage to get a public URL
  const imageUrl = await uploadImageToStorage(imageDataUrl);

  // Step 2: Call Zhipu API with URL
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
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: SYSTEM_PROMPT },
          ],
        },
      ],
      temperature: 0.01,
      top_p: 0.3,
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

  try {
    const analysis: ZhipuFoodAnalysis = JSON.parse(jsonStr);
    if (!analysis.mealName || !analysis.ingredients?.length) {
      throw new Error('智谱 AI 返回数据不完整');
    }
    return analysis;
  } catch (e: any) {
    if (e instanceof SyntaxError) {
      console.error('智谱原始返回:', text);
      throw new Error(`AI 返回格式异常：${text.slice(0, 80)}...`);
    }
    throw e;
  }
}

/** Get Zhipu API key from environment. */
export function getZhipuApiKey(): string | null {
  return import.meta.env.VITE_ZHIPU_API_KEY || null;
}

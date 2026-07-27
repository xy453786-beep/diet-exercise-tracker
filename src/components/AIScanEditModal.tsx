import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, Trash2, Sparkles, Scale, Utensils, Loader2, Database } from 'lucide-react';
import { AIDietAnalysis, MealCategory } from '../types';
import type { ZhipuFoodAnalysis } from '../api/zhipu';
import { saveFoodCorrection } from '../api/zhipu';
import { analyzeFood } from '../api/endpoints';

interface EditableIngredient {
  id: string;
  name: string;
  weight: number;
  unit: 'g' | 'ml';
  caloriesPerGram: number;
  proteinPerGram: number;
  carbsPerGram: number;
  fatPerGram: number;
}

interface AIScanEditModalProps {
  isOpen: boolean;
  presetIndex: number;
  category: MealCategory;
  capturedImage?: string | null;
  geminiAnalysis?: ZhipuFoodAnalysis | null;
  geminiLoading?: boolean;
  geminiError?: string | null;
  onClose: () => void;
  onConfirm: (finalAnalysis: AIDietAnalysis) => void;
}

/** 数据来源徽章 — 显示数据来自哪个 API */
function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    'barcode_scan': { label: '条码识别', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    'open_food_facts': { label: '条码识别', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    'food_analyzer': { label: 'AI 食物分析', bg: 'bg-purple-100', text: 'text-purple-700' },
    'food_composition': { label: '食物成分表', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    'snack_search': { label: 'AI 联网搜索', bg: 'bg-blue-100', text: 'text-blue-700' },
    'cache': { label: '缓存命中', bg: 'bg-blue-100', text: 'text-blue-700' },
    'ai_estimated': { label: 'AI 估算', bg: 'bg-amber-100', text: 'text-amber-700' },
  };

  // 解析 source 字段（格式："source_key|中文标签"）
  const key = source.split('|')[0];
  const cfg = config[key] || { label: key, bg: 'bg-gray-100', text: 'text-gray-600' };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
      <Database size={10} />
      {cfg.label}
    </span>
  );
}

export default function AIScanEditModal({
  isOpen,
  presetIndex,
  category,
  capturedImage,
  geminiAnalysis,
  geminiLoading,
  geminiError,
  onClose,
  onConfirm,
}: AIScanEditModalProps) {
  const [mealName, setMealName] = useState('');
  const [ingredients, setIngredients] = useState<EditableIngredient[]>([]);
  const [servingSize, setServingSize] = useState('');
  const [editingCalories, setEditingCalories] = useState(false);
  const [manualCalories, setManualCalories] = useState<number | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // 追踪组件是否已卸载，防止异步回调中 setState 导致 DOM 报错
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const handleRecalculate = async () => {
    if (!mealName.trim() || isRecalculating) return;
    setIsRecalculating(true);
    try {
      const result = await analyzeFood(mealName.trim(), 100);
      if (!mountedRef.current) return;
      setIngredients([{
        id: `ing-ai-${Date.now()}`,
        name: mealName.trim(),
        weight: 100,
        unit: 'g',
        caloriesPerGram: result.nutrition.calories / 100,
        proteinPerGram: result.nutrition.protein / 100,
        carbsPerGram: result.nutrition.carbs / 100,
        fatPerGram: result.nutrition.fat / 100,
      }]);
    } catch {
      // Keep existing data on failure
    } finally {
      if (mountedRef.current) setIsRecalculating(false);
    }
  };

  // Guess unit from ingredient name
  const guessUnit = (name: string): 'g' | 'ml' => {
    const liquids = ['咖啡', '牛奶', '奶茶', '果汁', '豆浆', '酸奶', '汤', '汁', '酱', '饮', '水', '茶', '酒', '奶', '油', '醋', '露', '液'];
    return liquids.some(kw => name.includes(kw)) ? 'ml' : 'g';
  };

  const makeIngredient = (name: string, weight: number, calories: number, protein: number, carbs: number, fat: number): EditableIngredient => {
    const w = weight > 0 ? weight : 1;
    return {
      id: `ing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      weight: w,
      unit: guessUnit(name),
      caloriesPerGram: calories / w,
      proteinPerGram: protein / w,
      carbsPerGram: carbs / w,
      fatPerGram: fat / w,
    };
  };

  // Initialize data based on presetIndex or Gemini analysis
  useEffect(() => {
    if (!isOpen) return;

    // Gemini AI analysis data
    if (presetIndex === -1 && geminiAnalysis) {
      setMealName(geminiAnalysis.mealName);
      setIngredients(geminiAnalysis.ingredients.map(ing =>
        makeIngredient(ing.name, ing.weight, ing.calories, ing.protein, ing.carbs, ing.fat)
      ));
      return;
    }

    if (presetIndex === 0) {
      setMealName('');
      setIngredients([]);
    } else {
      setMealName('水煮鸡胸肉沙拉');
      setIngredients([
        makeIngredient('水煮鸡胸肉', 120, 160, 26, 0, 3),
        makeIngredient('圣女果与西蓝花', 100, 44, 3, 8, 0.5),
        makeIngredient('低卡醋汁', 30, 130, 3, 7, 2.5),
      ]);
    }
  }, [isOpen, presetIndex]);

  // Dynamic loading text: switch to snack-search message after 2s
  const [loadingPhase, setLoadingPhase] = useState<'analyzing' | 'searching'>('analyzing');

  useEffect(() => {
    if (!geminiLoading) {
      setLoadingPhase('analyzing');
      return;
    }
    // After 2 seconds, switch to "searching the web" phase
    const timer = setTimeout(() => {
      setLoadingPhase('searching');
    }, 2000);
    return () => clearTimeout(timer);
  }, [geminiLoading]);

  if (!isOpen) return null;

  // Loading state while waiting for Gemini
  if (geminiLoading) {
    const loadingTitle = loadingPhase === 'searching'
      ? 'AI 正在查询零食营养数据库，请稍候...'
      : 'AI 正在分析食物...';
    const loadingSubtitle = loadingPhase === 'searching'
      ? '联网搜索营养成分表与热量信息'
      : 'AI 视觉识别 + 联网搜索营养成分';
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-[380px] p-8 shadow-2xl flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center">
            <Loader2 size={28} className="text-[#8B5CF6] animate-spin" />
          </div>
          <div className="text-center">
            <h3 className="text-base font-bold text-gray-900">{loadingTitle}</h3>
            <p className="text-xs text-gray-500 mt-1">{loadingSubtitle}</p>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] animate-loading-bar rounded-full" style={{width: '60%'}} />
          </div>
        </div>
        <style>{`@keyframes loadingBar { 0% { width: 0%; } 50% { width: 70%; } 100% { width: 95%; } } .animate-loading-bar { animation: loadingBar 2.5s ease-in-out infinite; }`}</style>
      </div>
    );
  }

  // Handle Weight Change
  const handleWeightChange = (id: string, newWeight: number) => {
    const validWeight = Math.max(0, newWeight);
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, weight: validWeight } : ing))
    );
  };

  // Handle Name Change
  const handleNameChange = (id: string, newName: string) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, name: newName } : ing))
    );
  };

  // Delete Ingredient
  const handleDeleteIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((ing) => ing.id !== id));
  };

  // Toggle unit between g and ml
  const handleUnitToggle = (id: string) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, unit: ing.unit === 'g' ? 'ml' : 'g' } : ing))
    );
  };

  // Add Custom Ingredient
  const handleAddIngredient = () => {
    const newIng: EditableIngredient = {
      id: `ing-custom-${Date.now()}`,
      name: '自定义食材',
      weight: 100,
      unit: 'g',
      caloriesPerGram: 1.2,
      proteinPerGram: 0.08,
      carbsPerGram: 0.15,
      fatPerGram: 0.03,
    };
    setIngredients((prev) => [...prev, newIng]);
  };

  // Dynamic Calculations
  const calculatedStats = ingredients.reduce(
    (acc, ing) => {
      const calories = ing.weight * ing.caloriesPerGram;
      const protein = ing.weight * ing.proteinPerGram;
      const carbs = ing.weight * ing.carbsPerGram;
      const fat = ing.weight * ing.fatPerGram;

      return {
        calories: acc.calories + calories,
        protein: acc.protein + protein,
        carbs: acc.carbs + carbs,
        fat: acc.fat + fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const totalCalories = Math.round(calculatedStats.calories);
  const effectiveCalories = manualCalories !== null ? manualCalories : totalCalories;
  const totalProtein = Math.round(calculatedStats.protein * 10) / 10;
  const totalCarbs = Math.round(calculatedStats.carbs * 10) / 10;
  const totalFat = Math.round(calculatedStats.fat * 10) / 10;

  const totalMacros = totalProtein + totalCarbs + totalFat || 1;
  const proteinPercent = Math.round((totalProtein / totalMacros) * 100);
  const carbsPercent = Math.round((totalCarbs / totalMacros) * 100);
  const fatPercent = 100 - proteinPercent - carbsPercent;

  const handleConfirm = () => {
    // Standard advice template customized dynamically
    const categoryName = category === 'breakfast' ? '早餐' : category === 'lunch' ? '午餐' : '晚餐';
    const finalAnalysis: AIDietAnalysis = {
      name: mealName || 'AI 识图餐食',
      calories: effectiveCalories,
      protein: { amount: Math.round(totalProtein), percentage: proteinPercent },
      carbs: { amount: Math.round(totalCarbs), percentage: carbsPercent },
      fat: { amount: Math.round(totalFat), percentage: fatPercent > 0 ? fatPercent : 0 },
      suggestions: {
        optimization: geminiAnalysis?.suggestion ||
          `经过调整后的这餐${categoryName}总热量为 ${effectiveCalories} kcal。蛋白质占比 ${proteinPercent}%，比例适中。建议配合足够的水分，在下一餐适量增加高纤维蔬菜，更有利于肠道代谢。`,
        exercise: geminiAnalysis?.exercise ||
          `该餐富含能量与营养储备，建议在餐后 1.5 小时进行 40 分钟的有氧慢跑或 30 分钟的高效全身抗阻力量训练，将碳水化合物充分转化为肌糖原。`,
      },
      ingredients: ingredients.map((ing) => ({
        name: ing.name,
        portion: `${ing.weight}${ing.unit}`,
        calories: Math.round(ing.weight * ing.caloriesPerGram),
      })),
      image:
        capturedImage ||
        (presetIndex === 0
          ? 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=300&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80'),
    };

    // 如果 AI 分析有数据来源，保存校正后的数据到后端缓存（fire-and-forget）
    if (geminiAnalysis?.source && geminiAnalysis.source !== 'ai_estimated') {
      const totalWeight = Math.round(ingredients.reduce((s, i) => s + i.weight, 0));
      saveFoodCorrection({
        foodName: mealName || geminiAnalysis.mealName || '未知食物',
        weight: totalWeight || 100,
        calories: effectiveCalories,
        protein: Math.round(totalProtein * 10) / 10,
        carbs: Math.round(totalCarbs * 10) / 10,
        fat: Math.round(totalFat * 10) / 10,
      }).catch(() => {}); // 静默失败，不影响主流程
    }

    onConfirm(finalAnalysis);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      {/* Absolute click-outside handler */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="bg-white rounded-3xl w-full max-w-[420px] z-10 overflow-hidden shadow-2xl relative border border-gray-100 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-lg">
              <Sparkles size={18} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                AI 识图结果校对
                {geminiAnalysis?.source && (
                  <SourceBadge source={geminiAnalysis.source} />
                )}
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">您可以微调食物重量以确保报告100%精准</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/80 rounded-full shadow-sm transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Gemini Error Banner */}
          {geminiError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
              <span className="text-amber-500 text-sm flex-shrink-0">⚠️</span>
              <div>
                <p className="text-xs font-bold text-amber-700">AI 分析失败，使用默认数据</p>
                <p className="text-[11px] text-amber-600 mt-0.5">{geminiError}</p>
              </div>
            </div>
          )}

          {/* Snack Search Awareness Banner */}
          {geminiAnalysis?.source?.startsWith('snack_search') && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2">
              <span className="text-blue-500 text-sm flex-shrink-0">💡</span>
              <div>
                <p className="text-xs font-bold text-blue-700">数据来自 AI 联网搜索</p>
                <p className="text-[11px] text-blue-600 mt-0.5">
                  若发现热量与包装标注不一致，可直接点击上方热量数字进行修改。
                </p>
              </div>
            </div>
          )}

          {/* 食物名称与分量 */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Utensils size={11} /> 食物名称与分量
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
                placeholder="输入食物名称"
              />
              <input
                type="text"
                value={servingSize}
                onChange={(e) => setServingSize(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
                placeholder="规格"
              />
            </div>
            <button
              type="button"
              onClick={handleRecalculate}
              disabled={isRecalculating || !mealName.trim()}
              className="w-full py-2.5 rounded-xl bg-[#F3EEFF] text-[#8B5CF6] font-bold text-[12px] flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all disabled:opacity-50 shadow-sm"
            >
              {isRecalculating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              AI 智能快速测算热量
            </button>
          </div>

          {/* Dynamic Nutrients Breakdown */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FAF8FF] to-[#F1EAFF] border border-[#E9E1FF] space-y-3">
            <div className="flex justify-between items-end">
              <span className="text-xs font-semibold text-[#4B1BB3]">预计总热量</span>
              <div className="flex items-baseline gap-0.5">
                {editingCalories ? (
                  <input
                    type="number"
                    autoFocus
                    value={manualCalories ?? effectiveCalories}
                    onChange={e => setManualCalories(e.target.value === '' ? null : Number(e.target.value))}
                    onBlur={() => setEditingCalories(false)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') setEditingCalories(false);
                      if (e.key === 'Escape') { setManualCalories(null); setEditingCalories(false); }
                    }}
                    className="w-20 text-xl font-extrabold text-[#4B1BB3] bg-white border border-[#8B5CF6]/30 rounded-lg px-2 py-0.5 text-right outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setManualCalories(effectiveCalories); setEditingCalories(true); }}
                    className="text-xl font-extrabold text-[#4B1BB3] hover:bg-[#8B5CF6]/10 px-2 py-0.5 -ml-2 rounded-lg transition-colors active:scale-95"
                  >
                    {effectiveCalories}
                  </button>
                )}
                <span className="text-[10px] font-bold text-[#8B5CF6]">千卡 (kcal)</span>
              </div>
            </div>

            {/* Micro progress bar */}
            <div className="h-1.5 w-full rounded-full bg-white flex overflow-hidden shadow-inner">
              <div
                style={{ width: `${proteinPercent}%` }}
                className="h-full bg-[#3B82F6] transition-all duration-300"
                title={`蛋白质 ${proteinPercent}%`}
              />
              <div
                style={{ width: `${carbsPercent}%` }}
                className="h-full bg-[#10B981] transition-all duration-300"
                title={`碳水 ${carbsPercent}%`}
              />
              <div
                style={{ width: `${fatPercent}%` }}
                className="h-full bg-[#F59E0B] transition-all duration-300"
                title={`脂肪 ${fatPercent}%`}
              />
            </div>

            {/* Nutrients Breakdown numbers */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div>
                <div className="text-[10px] text-gray-400 font-bold flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                  蛋白质
                </div>
                <div className="text-xs font-extrabold text-gray-700 mt-0.5">
                  {totalProtein}g <span className="text-[9px] text-gray-400 font-normal">({proteinPercent}%)</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-bold flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  碳水
                </div>
                <div className="text-xs font-extrabold text-gray-700 mt-0.5">
                  {totalCarbs}g <span className="text-[9px] text-gray-400 font-normal">({carbsPercent}%)</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-bold flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                  脂肪
                </div>
                <div className="text-xs font-extrabold text-gray-700 mt-0.5">
                  {totalFat}g <span className="text-[9px] text-gray-400 font-normal">({fatPercent > 0 ? fatPercent : 0}%)</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all"
          >
            重新拍照
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-[1.5] py-3 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-100 hover:shadow-purple-200 flex items-center justify-center gap-1 active:scale-[0.99]"
          >
            <Sparkles size={14} />
            确认，生成AI分析
          </button>
        </div>
      </div>
    </div>
  );
}

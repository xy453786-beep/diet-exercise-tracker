import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Trash2, Sparkles, Scale, Utensils, Loader2 } from 'lucide-react';
import { AIDietAnalysis, MealCategory } from '../types';
import type { GeminiFoodAnalysis } from '../api/gemini';

interface EditableIngredient {
  id: string;
  name: string;
  weight: number; // grams
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
  geminiAnalysis?: GeminiFoodAnalysis | null;
  geminiLoading?: boolean;
  onClose: () => void;
  onConfirm: (finalAnalysis: AIDietAnalysis) => void;
}

export default function AIScanEditModal({
  isOpen,
  presetIndex,
  category,
  capturedImage,
  geminiAnalysis,
  geminiLoading,
  onClose,
  onConfirm,
}: AIScanEditModalProps) {
  const [mealName, setMealName] = useState('');
  const [ingredients, setIngredients] = useState<EditableIngredient[]>([]);

  // Initialize data based on presetIndex or Gemini analysis
  useEffect(() => {
    if (!isOpen) return;

    // Gemini AI analysis data
    if (presetIndex === -1 && geminiAnalysis) {
      setMealName(geminiAnalysis.mealName);
      setIngredients(geminiAnalysis.ingredients.map((ing, i) => ({
        id: `gemini-${i}-${Date.now()}`,
        name: ing.name,
        weight: ing.weight,
        caloriesPerGram: ing.weight > 0 ? ing.calories / ing.weight : 0,
        proteinPerGram: ing.weight > 0 ? ing.protein / ing.weight : 0,
        carbsPerGram: ing.weight > 0 ? ing.carbs / ing.weight : 0,
        fatPerGram: ing.weight > 0 ? ing.fat / ing.weight : 0,
      })));
      return;
    }

    if (presetIndex === 0) {
      setMealName('香煎三文鱼藜麦碗');
      setIngredients([
        {
          id: 'ing-1',
          name: '烤三文鱼',
          weight: 150,
          caloriesPerGram: 2.08,
          proteinPerGram: 0.20,
          carbsPerGram: 0.00,
          fatPerGram: 0.10,
        },
        {
          id: 'ing-2',
          name: '三色藜麦',
          weight: 100,
          caloriesPerGram: 1.20,
          proteinPerGram: 0.04,
          carbsPerGram: 0.24,
          fatPerGram: 0.02,
        },
        {
          id: 'ing-3',
          name: '新鲜牛油果',
          weight: 50,
          caloriesPerGram: 1.60,
          proteinPerGram: 0.02,
          carbsPerGram: 0.08,
          fatPerGram: 0.14,
        },
        {
          id: 'ing-4',
          name: '混合蔬菜与柠檬酱汁',
          weight: 50,
          caloriesPerGram: 0.60,
          proteinPerGram: 0.02,
          carbsPerGram: 0.10,
          fatPerGram: 0.00,
        },
      ]);
    } else {
      setMealName('水煮鸡胸肉沙拉');
      setIngredients([
        {
          id: 'ing-1',
          name: '水煮鸡胸肉',
          weight: 120,
          caloriesPerGram: 1.33,
          proteinPerGram: 0.217,
          carbsPerGram: 0.00,
          fatPerGram: 0.025,
        },
        {
          id: 'ing-2',
          name: '圣女果与西蓝花',
          weight: 100,
          caloriesPerGram: 0.44,
          proteinPerGram: 0.03,
          carbsPerGram: 0.08,
          fatPerGram: 0.005,
        },
        {
          id: 'ing-3',
          name: '低卡醋汁',
          weight: 30,
          caloriesPerGram: 4.33,
          proteinPerGram: 0.10,
          carbsPerGram: 0.233,
          fatPerGram: 0.083,
        },
      ]);
    }
  }, [isOpen, presetIndex]);

  if (!isOpen) return null;

  // Loading state while waiting for Gemini
  if (geminiLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-[380px] p-8 shadow-2xl flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center">
            <Loader2 size={28} className="text-[#8B5CF6] animate-spin" />
          </div>
          <div className="text-center">
            <h3 className="text-base font-bold text-gray-900">AI 正在分析食物...</h3>
            <p className="text-xs text-gray-500 mt-1">Gemini 2.5 Flash 识别食材并估算营养成分</p>
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

  // Add Custom Ingredient
  const handleAddIngredient = () => {
    const newIng: EditableIngredient = {
      id: `ing-custom-${Date.now()}`,
      name: '自定义食材',
      weight: 100,
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
  const totalProtein = Math.round(calculatedStats.protein * 10) / 10;
  const totalCarbs = Math.round(calculatedStats.carbs * 10) / 10;
  const totalFat = Math.round(calculatedStats.fat * 10) / 10;

  const totalMacros = totalProtein + totalCarbs + totalFat || 1;
  const proteinPercent = Math.round((totalProtein / totalMacros) * 100);
  const carbsPercent = Math.round((totalCarbs / totalMacros) * 100);
  const fatPercent = 100 - proteinPercent - carbsPercent;

  // Handle Confirm Submission
  const handleConfirm = () => {
    // Standard advice template customized dynamically
    const categoryName = category === 'breakfast' ? '早餐' : category === 'lunch' ? '午餐' : '晚餐';
    const finalAnalysis: AIDietAnalysis = {
      name: mealName || 'AI 识图餐食',
      calories: totalCalories,
      protein: { amount: Math.round(totalProtein), percentage: proteinPercent },
      carbs: { amount: Math.round(totalCarbs), percentage: carbsPercent },
      fat: { amount: Math.round(totalFat), percentage: fatPercent > 0 ? fatPercent : 0 },
      suggestions: {
        optimization: geminiAnalysis?.suggestion ||
          `经过调整后的这餐${categoryName}总热量为 ${totalCalories} kcal。蛋白质占比 ${proteinPercent}%，比例适中。建议配合足够的水分，在下一餐适量增加高纤维蔬菜，更有利于肠道代谢。`,
        exercise: geminiAnalysis?.exercise ||
          `该餐富含能量与营养储备，建议在餐后 1.5 小时进行 40 分钟的有氧慢跑或 30 分钟的高效全身抗阻力量训练，将碳水化合物充分转化为肌糖原。`,
      },
      ingredients: ingredients.map((ing) => ({
        name: ing.name,
        portion: `${ing.weight}g`,
        calories: Math.round(ing.weight * ing.caloriesPerGram),
      })),
      image:
        capturedImage ||
        (presetIndex === 0
          ? 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=300&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80'),
    };

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
              <h3 className="text-[16px] font-bold text-gray-900">AI 识图结果校对</h3>
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
          {/* Meal Name Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Utensils size={11} /> 菜品名称
            </label>
            <input
              type="text"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
              placeholder="请输入菜品名称"
            />
          </div>

          {/* Ingredients list */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Scale size={11} /> 识别到的食材与估重
              </label>
              <button
                type="button"
                onClick={handleAddIngredient}
                className="text-[11px] font-semibold text-[#8B5CF6] hover:text-[#7C3AED] hover:underline flex items-center gap-0.5"
              >
                + 添加食材
              </button>
            </div>

            {ingredients.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                <p className="text-xs text-gray-400">暂无食材，请添加</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {ingredients.map((ing) => (
                  <div
                    key={ing.id}
                    className="flex items-center gap-2.5 p-3 rounded-2xl border border-gray-100 bg-white shadow-sm hover:border-gray-200 transition-all"
                  >
                    {/* Name Edit Input */}
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => handleNameChange(ing.id, e.target.value)}
                      className="flex-1 min-w-0 bg-transparent text-xs font-bold text-gray-700 border-b border-transparent hover:border-gray-200 focus:border-[#8B5CF6] focus:outline-none py-0.5"
                    />

                    {/* Weight Adjustment Controls */}
                    <div className="flex items-center gap-1.5 bg-gray-50/80 px-2 py-1 rounded-xl border border-gray-100">
                      <button
                        type="button"
                        onClick={() => handleWeightChange(ing.id, ing.weight - 10)}
                        className="w-5 h-5 rounded-md bg-white hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-all shadow-sm active:scale-95"
                      >
                        <Minus size={10} />
                      </button>
                      
                      <div className="flex items-center">
                        <input
                          type="number"
                          value={ing.weight}
                          onChange={(e) => handleWeightChange(ing.id, parseInt(e.target.value) || 0)}
                          className="w-10 text-center text-xs font-extrabold text-gray-800 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-[10px] text-gray-400 font-bold ml-0.5">g</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleWeightChange(ing.id, ing.weight + 10)}
                        className="w-5 h-5 rounded-md bg-white hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-all shadow-sm active:scale-95"
                      >
                        <Plus size={10} />
                      </button>
                    </div>

                    {/* Delete Icon */}
                    <button
                      type="button"
                      onClick={() => handleDeleteIngredient(ing.id)}
                      className="text-gray-300 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic Nutrients Breakdown */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FAF8FF] to-[#F1EAFF] border border-[#E9E1FF] space-y-3">
            <div className="flex justify-between items-end">
              <span className="text-xs font-semibold text-[#4B1BB3]">预计总热量</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xl font-extrabold text-[#4B1BB3]">{totalCalories}</span>
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

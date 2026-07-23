import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Sparkles, Scale, Utensils, Flame, Loader2, Minus, Search } from 'lucide-react';
import { MealCategory, MealItem, FoodCompositionResult } from '../types';
import { searchFood, analyzeFood } from '../api/endpoints';

interface AddFoodModalProps {
  isOpen: boolean;
  category: MealCategory | null;
  onClose: () => void;
  onAdd: (category: MealCategory, item: MealItem) => void;
}


/** 从份量字符串中解析克数 */
function parseWeight(portionStr: string): number {
  const weightMatch = portionStr.match(/(\d+)\s*(g|克)/i);
  if (weightMatch) return parseInt(weightMatch[1], 10);
  return 100; // 默认 100g
}

export default function AddFoodModal({ isOpen, category, onClose, onAdd }: AddFoodModalProps) {
  const [customName, setCustomName] = useState('');
  const [customPortion, setCustomPortion] = useState('150g');
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');

  // UI States
  const [isEstimating, setIsEstimating] = useState(false);
  const [hasEstimated, setHasEstimated] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [analyzeSource, setAnalyzeSource] = useState('');

  // Search-as-you-type
  const [searchResults, setSearchResults] = useState<FoodCompositionResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen || !category) return null;

  const categoryNames = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
  };

  // 食物名称输入变化 → 实时搜索
  const handleNameChange = (value: string) => {
    setCustomName(value);
    if (errorMessage) setErrorMessage('');

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchFood(value.trim(), 8);
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  // 选中搜索结果 → 调用 analyzeFood 获取精确营养数据
  const handleSelectResult = async (result: FoodCompositionResult) => {
    setCustomName(result.food_name);
    setShowDropdown(false);
    setSearchResults([]);
    setErrorMessage('');

    const weight = parseWeight(customPortion || '150g');
    setIsEstimating(true);
    try {
      const analysis = await analyzeFood(result.food_name, weight);
      setCustomCalories(analysis.nutrition.calories.toString());
      setCustomProtein(analysis.nutrition.protein.toString());
      setCustomCarbs(analysis.nutrition.carbs.toString());
      setCustomFat(analysis.nutrition.fat.toString());
      setHasEstimated(true);
      setAnalyzeSource(
        analysis.source === 'database'
          ? '（来自中国食物成分表数据库）'
          : analysis.source === 'ai_estimated'
          ? '（AI 智能估算）'
          : '（数据库匹配）'
      );
    } catch (err: any) {
      // 回退：直接使用搜索结果中的每 100g 数据
      const ratio = weight / 100;
      setCustomCalories(Math.round(result.energy_kcal * ratio).toString());
      setCustomProtein((result.protein * ratio).toFixed(1));
      setCustomCarbs((result.carbs * ratio).toFixed(1));
      setCustomFat((result.fat * ratio).toFixed(1));
      setHasEstimated(true);
      setAnalyzeSource('（数据库直接换算）');
    } finally {
      setIsEstimating(false);
    }
  };

  // AI Estimate Trigger — 使用后端分析
  const handleAIEstimate = async () => {
    if (!customName.trim()) {
      setErrorMessage('请输入食物名称，以便 AI 进行热量测算');
      return;
    }
    setErrorMessage('');
    setIsEstimating(true);

    const weight = parseWeight(customPortion || '150g');
    try {
      const analysis = await analyzeFood(customName.trim(), weight);
      setCustomCalories(analysis.nutrition.calories.toString());
      setCustomProtein(analysis.nutrition.protein.toString());
      setCustomCarbs(analysis.nutrition.carbs.toString());
      setCustomFat(analysis.nutrition.fat.toString());
      setHasEstimated(true);
      setAnalyzeSource(
        analysis.source === 'database'
          ? '（来自中国食物成分表数据库）'
          : analysis.source === 'ai_estimated'
          ? '（AI 智能估算）'
          : '（数据库匹配）'
      );
      if (analysis.matchedFood && analysis.matchedFood !== customName.trim()) {
        setCustomName(analysis.matchedFood);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'AI 测算失败，请手动输入营养成分');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      setErrorMessage('请输入食物名称');
      return;
    }

    const finalCalories = parseInt(customCalories, 10);
    if (isNaN(finalCalories)) {
      setErrorMessage('请输入或使用 AI 测算热量');
      return;
    }

    const newItem: MealItem = {
      id: 'f_custom_' + Date.now(),
      name: customName.trim(),
      calories: finalCalories,
      protein: parseFloat(customProtein) || 0,
      carbs: parseFloat(customCarbs) || 0,
      fat: parseFloat(customFat) || 0,
      portion: customPortion || '1份',
    };

    onAdd(category, newItem);

    // Reset state
    setCustomName('');
    setCustomCalories('');
    setCustomProtein('');
    setCustomCarbs('');
    setCustomFat('');
    setCustomPortion('150g');
    setHasEstimated(false);
    setErrorMessage('');

    onClose();
  };

  // Safe manual adjustments
  const adjustValue = (field: 'cal' | 'p' | 'c' | 'f', amount: number) => {
    if (field === 'cal') {
      const cur = parseInt(customCalories, 10) || 0;
      setCustomCalories(Math.max(0, cur + amount).toString());
    } else if (field === 'p') {
      const cur = parseFloat(customProtein) || 0;
      setCustomProtein(Math.max(0, cur + amount).toFixed(1).replace(/\.0$/, ''));
    } else if (field === 'c') {
      const cur = parseFloat(customCarbs) || 0;
      setCustomCarbs(Math.max(0, cur + amount).toFixed(1).replace(/\.0$/, ''));
    } else if (field === 'f') {
      const cur = parseFloat(customFat) || 0;
      setCustomFat(Math.max(0, cur + amount).toFixed(1).replace(/\.0$/, ''));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Background overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="bg-white border border-gray-100 rounded-t-3xl sm:rounded-3xl w-full max-w-[430px] z-10 max-h-[90vh] overflow-y-auto pb-6 shadow-2xl relative animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        
        {/* Sticky Header */}
        <div className="flex justify-between items-center px-5 py-4.5 border-b border-gray-100 bg-white sticky top-0 z-20">
          <div>
            <h2 className="text-[16px] font-bold text-gray-900">手动记录食物至 &quot;{categoryNames[category]}&quot;</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">可直接手动输入或使用 AI 智能快速测算热量</p>
          </div>
          <button
            id="close-food-modal-btn"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Form */}
          <form onSubmit={handleAddCustom} className="space-y-4">
            {errorMessage && (
              <div className="p-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl font-medium animate-pulse">
                {errorMessage}
              </div>
            )}

            {/* Inputs: Name & Portion */}
            <div className="space-y-3 bg-gray-50/50 p-4.5 rounded-2xl border border-gray-100/80">
              <div className="grid grid-cols-5 gap-3.5 items-end">
                <div className="col-span-3 space-y-1.5 relative" ref={dropdownRef}>
                  <label htmlFor="custom-food-name" className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Utensils size={11} /> 食物名称
                  </label>
                  <div className="relative">
                    <input
                      id="custom-food-name"
                      type="text"
                      required
                      placeholder="例如：全麦吐司、香煎鸡胸肉"
                      value={customName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
                    />
                    {isSearching && (
                      <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 animate-spin" />
                    )}
                  </div>
                  {/* 搜索建议下拉 */}
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map((r, i) => (
                        <button
                          key={r.food_code || i}
                          type="button"
                          onClick={() => handleSelectResult(r)}
                          className="w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F1EAFF] transition-colors border-b border-gray-50 last:border-0"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-gray-800 block truncate">
                              {r.food_name}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {r.category}{r.subcategory ? ` · ${r.subcategory}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            <span className="text-[10px] font-bold text-amber-600">
                              {r.energy_kcal} kcal
                            </span>
                            <Search size={11} className="text-gray-300" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label htmlFor="custom-food-portion" className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Scale size={11} /> 规格分量
                  </label>
                  <input
                    id="custom-food-portion"
                    type="text"
                    required
                    placeholder="例如：150g"
                    value={customPortion}
                    onChange={(e) => setCustomPortion(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
                  />
                </div>
              </div>

              {/* AI Estimator Call-To-Action Button */}
              <button
                type="button"
                id="ai-estimate-trigger-btn"
                onClick={handleAIEstimate}
                disabled={isEstimating}
                className="w-full mt-2 py-2.5 px-4 rounded-xl border border-[#DCD0FF] bg-gradient-to-r from-[#FAF8FF] to-[#F1EAFF] hover:from-[#F1EAFF] hover:to-[#E8DDFF] text-[#8B5CF6] text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] disabled:opacity-75 cursor-pointer shadow-sm"
              >
                {isEstimating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>AI 正在测算成分与热量...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} className="animate-pulse text-[#8B5CF6]" />
                    <span>AI 智能快速测算热量</span>
                  </>
                )}
              </button>
            </div>

            {/* Editable Calories & Macros inputs */}
            <div className="space-y-3.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                能量与营养素成分 {hasEstimated ? `✨ ${analyzeSource || 'AI 测算生成，可手动微调'}` : '（可直接手动输入）'}
              </span>

              {/* Total calories input row */}
              <div className="p-3.5 rounded-2xl border border-gray-100 bg-gradient-to-r from-orange-50/30 to-amber-50/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                    <Flame size={15} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-800">总热量 (Calories)</span>
                    <p className="text-[10px] text-gray-400">大卡 (kcal)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustValue('cal', -20)}
                    className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all"
                  >
                    <Minus size={11} />
                  </button>
                  <input
                    id="custom-food-calories"
                    type="number"
                    required
                    placeholder="0"
                    value={customCalories}
                    onChange={(e) => setCustomCalories(e.target.value)}
                    className="w-18 px-2 py-1 border border-gray-200 rounded-lg bg-white text-center text-sm font-extrabold text-gray-800 focus:outline-none focus:border-[#8B5CF6]"
                  />
                  <button
                    type="button"
                    onClick={() => adjustValue('cal', 20)}
                    className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>

              {/* Macros columns */}
              <div className="grid grid-cols-3 gap-2.5">
                {/* Protein */}
                <div className="p-2.5 rounded-2xl border border-gray-100 bg-blue-50/10 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> 蛋白质
                  </span>
                  <div className="flex items-center gap-1 mt-1.5">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={customProtein}
                      onChange={(e) => setCustomProtein(e.target.value)}
                      className="w-10 bg-transparent text-center text-xs font-extrabold text-gray-800 focus:outline-none border-b border-gray-200 focus:border-blue-500 py-0.5"
                    />
                    <span className="text-[10px] text-gray-400 font-bold">g</span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => adjustValue('p', -2)}
                      className="w-5 h-5 rounded bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustValue('p', 2)}
                      className="w-5 h-5 rounded bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Carbs */}
                <div className="p-2.5 rounded-2xl border border-gray-100 bg-emerald-50/10 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> 碳水
                  </span>
                  <div className="flex items-center gap-1 mt-1.5">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={customCarbs}
                      onChange={(e) => setCustomCarbs(e.target.value)}
                      className="w-10 bg-transparent text-center text-xs font-extrabold text-gray-800 focus:outline-none border-b border-gray-200 focus:border-emerald-500 py-0.5"
                    />
                    <span className="text-[10px] text-gray-400 font-bold">g</span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => adjustValue('c', -5)}
                      className="w-5 h-5 rounded bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustValue('c', 5)}
                      className="w-5 h-5 rounded bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Fat */}
                <div className="p-2.5 rounded-2xl border border-gray-100 bg-amber-50/10 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> 脂肪
                  </span>
                  <div className="flex items-center gap-1 mt-1.5">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={customFat}
                      onChange={(e) => setCustomFat(e.target.value)}
                      className="w-10 bg-transparent text-center text-xs font-extrabold text-gray-800 focus:outline-none border-b border-gray-200 focus:border-amber-500 py-0.5"
                    />
                    <span className="text-[10px] text-gray-400 font-bold">g</span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => adjustValue('f', -2)}
                      className="w-5 h-5 rounded bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustValue('f', 2)}
                      className="w-5 h-5 rounded bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              id="submit-food-btn"
              type="submit"
              className="w-full bg-[#111827] hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl text-xs transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-1.5 mt-4"
            >
              <Plus size={15} />
              添加至今日饮食
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

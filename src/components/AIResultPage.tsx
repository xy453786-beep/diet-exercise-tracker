import React, { useState } from 'react';
import { Sparkles, Calendar, Heart, ShieldAlert, Dumbbell, Save, ArrowLeft, Plus } from 'lucide-react';
import { AIDietAnalysis, MealCategory, MealItem } from '../types';

interface AIResultPageProps {
  analysisData: AIDietAnalysis;
  defaultCategory?: MealCategory;
  onSaveToLog: (category: MealCategory, item: MealItem) => void;
  onBack: () => void;
}

export default function AIResultPage({ analysisData, defaultCategory = 'lunch', onSaveToLog, onBack }: AIResultPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<MealCategory>(defaultCategory);

  const handleSave = () => {
    // Construct meal item based on analysis data
    const totalWeight = analysisData.ingredients.reduce((acc, ing) => {
      const match = ing.portion.match(/(\d+)/);
      return acc + (match ? parseInt(match[1]) : 0);
    }, 0);
    const mealToSave: MealItem = {
      id: 'ai_scanned_' + Date.now(),
      name: analysisData.name,
      calories: analysisData.calories,
      protein: analysisData.protein.amount,
      carbs: analysisData.carbs.amount,
      fat: analysisData.fat.amount,
      portion: totalWeight > 0 ? `1份 (${totalWeight}g)` : '1份',
      image: analysisData.image || 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=300&auto=format&fit=crop&q=80'
    };
    onSaveToLog(selectedCategory, mealToSave);
  };

  const categoryLabels = {
    breakfast: '早餐 🌅',
    lunch: '午餐 ☀️',
    dinner: '晚餐 🌙',
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in relative">
      
      {/* Visual Plate Header Section */}
      <div className="relative rounded-[16px] overflow-hidden aspect-[16/10] shadow-md border border-white/40 bg-gray-950">
        <img 
          src={analysisData.image} 
          alt={analysisData.name} 
          className="w-full h-full object-cover opacity-80"
          referrerPolicy="no-referrer"
        />

        {/* Back Button */}
        <button 
          id="back-from-ai-btn"
          onClick={onBack}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-all active:scale-95"
        >
          <ArrowLeft size={16} />
        </button>

        {/* Camera Tag Overlay */}
        <div className="absolute top-3 right-3 bg-[#8B5CF6] text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-md animate-pulse">
          <Sparkles size={10} fill="currentColor" />
          AI 智能扫描
        </div>

        {/* Dynamic Scan Hotspot Markers */}
        <div className="absolute top-[22%] left-[45%] group">
          <div className="w-3.5 h-3.5 bg-[#8B5CF6] border-2 border-white rounded-full animate-ping absolute" />
          <div className="w-3.5 h-3.5 bg-[#8B5CF6] border-2 border-white rounded-full relative z-10" />
          <div className="absolute left-5 -top-1 bg-black/75 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap opacity-100 group-hover:opacity-100 transition-all shadow-md">
            香煎三文鱼 150g (P:32g)
          </div>
        </div>

        <div className="absolute top-[55%] left-[28%] group">
          <div className="w-3.5 h-3.5 bg-[#8B5CF6] border-2 border-white rounded-full animate-ping absolute" />
          <div className="w-3.5 h-3.5 bg-[#8B5CF6] border-2 border-white rounded-full relative z-10" />
          <div className="absolute left-5 -top-1 bg-black/75 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap opacity-100 group-hover:opacity-100 transition-all shadow-md">
            新鲜牛油果 50g (F:11g)
          </div>
        </div>

        <div className="absolute top-[70%] left-[58%] group">
          <div className="w-3.5 h-3.5 bg-[#8B5CF6] border-2 border-white rounded-full animate-ping absolute" />
          <div className="w-3.5 h-3.5 bg-[#8B5CF6] border-2 border-white rounded-full relative z-10" />
          <div className="absolute left-5 -top-1 bg-black/75 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap opacity-100 group-hover:opacity-100 transition-all shadow-md">
            三色藜麦饭 100g (C:45g)
          </div>
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <h2 className="text-white text-[20px] font-extrabold leading-tight">{analysisData.name}</h2>
          <span className="text-[10px] text-gray-300 font-medium">多维视觉识别 · 膳食营养精准估算</span>
        </div>
      </div>

      {/* Main Calories Stats Card */}
      <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm">
        <span className="text-[11px] font-semibold text-[#6B7280] block mb-0.5">预估总热量</span>
        <div className="flex justify-between items-baseline">
          <div className="flex items-baseline gap-0.5">
            <span className="text-[32px] font-black text-gray-900">{analysisData.calories}</span>
            <span className="text-[14px] text-gray-400 font-bold ml-1">kcal</span>
          </div>
          <span className="text-xs font-bold text-[#10B981] flex items-center gap-1.5 bg-[#E8F8F5]/80 backdrop-blur-sm px-3 py-1 rounded-full">
            <Heart size={12} fill="currentColor" className="animate-pulse" />
            符合减脂目标
          </span>
        </div>
      </div>

      {/* Macronutrient Components bar charts */}
      <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm">
        <h3 className="text-xs font-bold text-gray-800 mb-3.5">营养成分深度分析</h3>
        
        <div className="space-y-3">
          {/* Protein */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-gray-500 font-semibold">蛋白质</span>
              <span className="font-extrabold text-gray-800">{analysisData.protein.amount}g ({analysisData.protein.percentage}%)</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#8B5CF6] transition-all duration-500" 
                style={{ width: `${analysisData.protein.percentage}%` }}
              />
            </div>
          </div>

          {/* Carbs */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-gray-500 font-semibold">碳水化合物</span>
              <span className="font-extrabold text-gray-800">{analysisData.carbs.amount}g ({analysisData.carbs.percentage}%)</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-black transition-all duration-500" 
                style={{ width: `${analysisData.carbs.percentage}%` }}
              />
            </div>
          </div>

          {/* Fat */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-gray-500 font-semibold">脂肪</span>
              <span className="font-extrabold text-gray-800">{analysisData.fat.amount}g ({analysisData.fat.percentage}%)</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gray-400 transition-all duration-500" 
                style={{ width: `${analysisData.fat.percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* AI Smart Suggestions Sections */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 px-1 text-gray-800">
          <Sparkles size={16} className="text-[#8B5CF6]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">✨ AI 智能膳食建议</h3>
        </div>

        {/* Optimisation advice */}
        <div className="bg-white/40 backdrop-blur-sm rounded-[16px] p-4 border border-white/30 flex gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#F3EEFF]/80 backdrop-blur-sm text-[#8B5CF6] flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={16} />
          </div>
          <div>
            <span className="text-xs font-extrabold text-gray-800 block mb-1">优化建议</span>
            <p className="text-xs text-gray-500 leading-relaxed">{analysisData.suggestions.optimization}</p>
          </div>
        </div>

        {/* Exercise matching */}
        <div className="bg-white/40 backdrop-blur-sm rounded-[16px] p-4 border border-white/30 flex gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#F3EEFF]/80 backdrop-blur-sm text-[#8B5CF6] flex items-center justify-center flex-shrink-0">
            <Dumbbell size={16} />
          </div>
          <div>
            <span className="text-xs font-extrabold text-gray-800 block mb-1">运动配合</span>
            <p className="text-xs text-gray-500 leading-relaxed">{analysisData.suggestions.exercise}</p>
          </div>
        </div>
      </div>

      {/* Recipe ingredients breakdown */}
      <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm">
        <h3 className="text-xs font-bold text-gray-800 mb-3.5">食材明细</h3>
        
        <div className="divide-y divide-white/20">
          {analysisData.ingredients.map((ing, idx) => (
            <div key={idx} className="flex justify-between items-center py-2 text-xs">
              <div className="flex flex-col">
                <span className="font-semibold text-gray-800">{ing.name}</span>
                <span className="text-[10px] text-gray-400">分量：{ing.portion}</span>
              </div>
              <span className="font-extrabold text-gray-800">{ing.calories} kcal</span>
            </div>
          ))}
        </div>
      </div>

      {/* Choose Meal Slot & Save */}
      <div className="bg-white/70 backdrop-blur-md rounded-[16px] p-4 border border-white/50 shadow-sm space-y-3.5">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-2">选择记录至哪个餐次：</label>
          <div className="grid grid-cols-3 gap-2">
            {(['breakfast', 'lunch', 'dinner'] as const).map((category) => (
              <button
                key={category}
                id={`ai-slot-btn-${category}`}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  selectedCategory === category
                    ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-sm'
                    : 'bg-white/50 backdrop-blur-sm text-gray-700 border-white/40 hover:bg-gray-50'
                }`}
              >
                {categoryLabels[category]}
              </button>
            ))}
          </div>
        </div>

        <button
          id="save-ai-meal-btn"
          onClick={handleSave}
          className="w-full bg-[#000000] hover:bg-gray-900 text-white font-extrabold py-3.5 rounded-xl text-sm transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-1.5"
        >
          <Save size={16} />
          保存至今日饮食日志
        </button>
      </div>

    </div>
  );
}

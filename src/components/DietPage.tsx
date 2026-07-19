import React from 'react';
import { Plus, Trash2, Scale } from 'lucide-react';
import { MealRecord, MealCategory, MealItem } from '../types';

interface DietPageProps {
  meals: MealRecord[];
  onRemoveItem: (category: MealCategory, itemId: string) => void;
  onOpenScanner: (category?: MealCategory) => void;
}

export default function DietPage({
  meals,
  onRemoveItem,
  onOpenScanner,
}: DietPageProps) {
  // Calculate today's metrics
  const totalCalories = meals.reduce((sum, meal) => {
    return sum + meal.items.reduce((mSum, item) => mSum + item.calories, 0);
  }, 0);

  const goalCalories = 2100;
  const remainingCalories = goalCalories - totalCalories;

  const totalProtein = meals.reduce((sum, meal) => {
    return sum + meal.items.reduce((mSum, item) => mSum + (item.protein || 0), 0);
  }, 0);
  const goalProtein = 120;

  const totalCarbs = meals.reduce((sum, meal) => {
    return sum + meal.items.reduce((mSum, item) => mSum + (item.carbs || 0), 0);
  }, 0);
  const goalCarbs = 250;

  const totalFat = meals.reduce((sum, meal) => {
    return sum + meal.items.reduce((mSum, item) => mSum + (item.fat || 0), 0);
  }, 0);
  const goalFat = 70;

  const calPercentage = Math.min(100, Math.round((totalCalories / goalCalories) * 100));

  return (
    <div className="space-y-4 pb-24 px-4 pt-4 relative animate-fade-in">
      
      {/* Top Calories Card */}
      <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm">
        <span className="text-[12px] font-semibold text-[#6B7280] block mb-1">今日摄入热量</span>
        <div className="flex justify-between items-baseline mb-2">
          <div className="flex items-baseline gap-1">
            <span className="text-[32px] font-black text-[#111111]">{totalCalories}</span>
            <span className="text-[14px] text-gray-400 font-semibold">/ {goalCalories} kcal</span>
          </div>
          <span className="text-[11px] font-semibold text-[#8B5CF6] flex items-center gap-1 bg-[#F3EEFF]/80 backdrop-blur-sm px-2 py-0.5 rounded-full">
            <Scale size={11} />
            剩余 {remainingCalories > 0 ? remainingCalories : 0} kcal
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-gray-200/50 rounded-full overflow-hidden mb-4">
          <div 
            className="h-full bg-[#8B5CF6] transition-all duration-500 rounded-full"
            style={{ width: `${calPercentage}%` }}
          />
        </div>

        {/* Macronutrients Stacked Row Layout */}
        <div className="space-y-2.5 bg-white/50 backdrop-blur-sm border border-white/40 rounded-xl p-3">
          {/* Protein */}
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-gray-500 font-bold w-12 flex-shrink-0 text-left">蛋白质</span>
            <div className="flex-1 h-1.5 bg-gray-200/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#8B5CF6] transition-all duration-500 rounded-full" 
                style={{ width: `${Math.min(100, (totalProtein / goalProtein) * 100)}%` }}
              />
            </div>
            <span className="font-extrabold text-gray-800 w-20 text-right">{totalProtein}g / {goalProtein}g</span>
          </div>

          {/* Carbs */}
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-gray-500 font-bold w-12 flex-shrink-0 text-left">碳水</span>
            <div className="flex-1 h-1.5 bg-gray-200/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-black transition-all duration-500 rounded-full" 
                style={{ width: `${Math.min(100, (totalCarbs / goalCarbs) * 100)}%` }}
              />
            </div>
            <span className="font-extrabold text-gray-800 w-20 text-right">{totalCarbs}g / {goalCarbs}g</span>
          </div>

          {/* Fat */}
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-gray-500 font-bold w-12 flex-shrink-0 text-left">脂肪</span>
            <div className="flex-1 h-1.5 bg-gray-200/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gray-400 transition-all duration-500 rounded-full" 
                style={{ width: `${Math.min(100, (totalFat / goalFat) * 100)}%` }}
              />
            </div>
            <span className="font-extrabold text-gray-800 w-20 text-right">{totalFat}g / {goalFat}g</span>
          </div>
        </div>
      </div>

      {/* Meals Lists */}
      <div className="space-y-4">
        {meals.map((meal) => {
          const sectionCalories = meal.items.reduce((sum, item) => sum + item.calories, 0);
          return (
            <div key={meal.category} className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">{meal.icon}</span>
                  <span className="text-[14px] font-extrabold text-gray-800">{meal.name}</span>
                </div>
                <span className="text-[12px] font-extrabold text-[#8B5CF6]">{sectionCalories} kcal</span>
              </div>

              {/* Food Items list */}
              <div className="space-y-2">
                {meal.items.map((item) => (
                  <div 
                    key={item.id} 
                    className="bg-white/60 backdrop-blur-md border border-white/40 rounded-[16px] p-3 flex items-center justify-between shadow-sm group hover:border-purple-100 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {item.image ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                          <img 
                            src={item.image} 
                            alt={item.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#F3EEFF] text-[#8B5CF6] flex items-center justify-center font-bold text-lg flex-shrink-0">
                          🥗
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-gray-800">{item.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-gray-400">{item.portion}</span>
                          {(item.protein !== undefined || item.carbs !== undefined || item.fat !== undefined) && (
                            <span className="text-[9px] text-[#8B5CF6] bg-[#8B5CF6]/5 px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap">
                              蛋 {item.protein || 0}g · 碳 {item.carbs || 0}g · 脂 {item.fat || 0}g
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-gray-800">{item.calories} kcal</span>
                      <button 
                        id={`delete-${meal.category}-${item.id}-btn`}
                        onClick={() => onRemoveItem(meal.category, item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50/50 transition-colors"
                        title="删除记录"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Meal button */}
              <button
                id={`add-food-${meal.category}-btn`}
                onClick={() => onOpenScanner(meal.category)}
                className="w-full py-2.5 rounded-xl border border-dashed border-white/60 hover:border-[#8B5CF6]/30 bg-white/40 hover:bg-[#F3EEFF]/40 text-gray-600 hover:text-[#8B5CF6] font-semibold text-xs flex items-center justify-center gap-1 transition-all"
              >
                <Plus size={14} />
                添加饮食
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}

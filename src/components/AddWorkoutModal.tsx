import React, { useState, useEffect } from 'react';
import { X, Plus, Sparkles, Timer, Flame, Loader2 } from 'lucide-react';
import { WorkoutItem } from '../types';

interface AddWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (workout: WorkoutItem) => void;
}

// Smart calorie estimation based on MET values for common workouts
function estimateWorkoutData(name: string, minutes: number) {
  const lowerName = name.toLowerCase();
  let met = 5.0; // Default MET (medium intensity)
  let category: 'aerobic' | 'resistance' = 'aerobic';
  let intensity: 'low' | 'medium' | 'high' | 'medium-high' = 'medium';

  // Keyword mapping for specific activities
  if (lowerName.includes('跑') || lowerName.includes('run')) {
    met = 8.5;
    intensity = 'medium-high';
    category = 'aerobic';
  } else if (lowerName.includes('力量') || lowerName.includes('无氧') || lowerName.includes('铁') || lowerName.includes('哑铃') || lowerName.includes('杠铃') || lowerName.includes('深蹲') || lowerName.includes('俯卧撑') || lowerName.includes('健身房')) {
    met = 5.5;
    intensity = 'medium';
    category = 'resistance';
  } else if (lowerName.includes('泳') || lowerName.includes('swim')) {
    met = 7.0;
    intensity = 'medium';
    category = 'aerobic';
  } else if (lowerName.includes('单车') || lowerName.includes('骑') || lowerName.includes('cycle') || lowerName.includes('bike')) {
    met = 6.8;
    intensity = 'medium';
    category = 'aerobic';
  } else if (lowerName.includes('瑜伽') || lowerName.includes('yoga') || lowerName.includes('拉伸') || lowerName.includes('stretch')) {
    met = 2.8;
    intensity = 'low';
    category = 'aerobic';
  } else if (lowerName.includes('球') || lowerName.includes('羽毛') || lowerName.includes('篮球') || lowerName.includes('足球') || lowerName.includes('网球')) {
    met = 6.0;
    intensity = 'medium';
    category = 'aerobic';
  } else if (lowerName.includes('绳') || lowerName.includes('jump')) {
    met = 9.0;
    intensity = 'high';
    category = 'aerobic';
  } else if (lowerName.includes('散步') || lowerName.includes('走') || lowerName.includes('walk')) {
    met = 3.5;
    intensity = 'low';
    category = 'aerobic';
  } else if (lowerName.includes('高强度') || lowerName.includes('hiit') || lowerName.includes('搏击') || lowerName.includes('波比')) {
    met = 9.5;
    intensity = 'high';
    category = 'aerobic';
  }

  // Formula: calories ≈ MET * 3.5 * weight_kg / 200 * minutes
  // Assume a default weight of 65kg
  const weight = 65;
  const cal = Math.round(met * 3.5 * weight / 200 * minutes);

  return {
    calories: Math.max(10, cal),
    category,
    intensity,
  };
}

export default function AddWorkoutModal({ isOpen, onClose, onAdd }: AddWorkoutModalProps) {
  const [customType, setCustomType] = useState('');
  const [customDuration, setCustomDuration] = useState('30');
  
  // AI Estimated states
  const [estimatedCalories, setEstimatedCalories] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);

  // Recalculate calories dynamically with elegant AI loader flicker
  useEffect(() => {
    if (!isOpen) return;
    if (!customType.trim() || !customDuration) {
      setEstimatedCalories(0);
      return;
    }

    const durationNum = parseInt(customDuration, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      setEstimatedCalories(0);
      return;
    }

    setIsCalculating(true);
    const timer = setTimeout(() => {
      const result = estimateWorkoutData(customType, durationNum);
      setEstimatedCalories(result.calories);
      setIsCalculating(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [customType, customDuration, isOpen]);

  if (!isOpen) return null;

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customType.trim() || !customDuration) return;

    const durationNum = parseInt(customDuration, 10) || 30;
    const { calories, category, intensity } = estimateWorkoutData(customType.trim(), durationNum);

    const formattedDuration = `${durationNum}'00"`;

    const newWorkout: WorkoutItem = {
      id: 'w_custom_' + Date.now(),
      type: customType.trim(),
      duration: formattedDuration,
      calories: calories,
      intensity: intensity,
      category: category,
      time: '今天 ' + new Date().toTimeString().slice(0, 5),
    };

    onAdd(newWorkout);

    // Reset inputs
    setCustomType('');
    setCustomDuration('30');
    setEstimatedCalories(0);

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      {/* Background overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="bg-white border border-gray-100 rounded-t-3xl sm:rounded-3xl w-full max-w-[420px] z-10 max-h-[90vh] overflow-y-auto pb-6 shadow-2xl relative animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4.5 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-[16px] font-bold text-gray-900">记录新运动</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">只需输入运动项目和时长，AI 将智能计算卡路里</p>
          </div>
          <button 
            id="close-workout-modal-btn" 
            onClick={onClose} 
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content & Form */}
        <div className="px-5 py-5">
          <form onSubmit={handleAddCustom} className="space-y-5">
            
            {/* Workout Type Input */}
            <div className="space-y-1.5">
              <label htmlFor="custom-workout-type" className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                运动项目名称
              </label>
              <input
                id="custom-workout-type"
                type="text"
                required
                placeholder="例如：户外慢跑、羽毛球、力量训练"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
              />
            </div>

            {/* Workout Duration Input */}
            <div className="space-y-1.5">
              <label htmlFor="custom-workout-duration" className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                运动时长 (分钟)
              </label>
              <div className="relative flex items-center">
                <input
                  id="custom-workout-duration"
                  type="number"
                  min="1"
                  max="480"
                  required
                  placeholder="30"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] pr-12 transition-all"
                />
                <span className="absolute right-4 text-xs font-bold text-gray-400">
                  分钟
                </span>
              </div>
            </div>

            {/* AI Real-time Calorie Display Panel */}
            <div className="bg-gradient-to-r from-[#FAF8FF] to-[#F3EEFF] border border-[#E8DDFF] rounded-2xl p-4 flex items-center justify-between min-h-[76px] transition-all duration-300">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white rounded-xl text-[#8B5CF6] shadow-sm">
                  {isCalculating ? (
                    <Loader2 size={18} className="animate-spin text-[#8B5CF6]" />
                  ) : (
                    <Sparkles size={18} className="text-[#8B5CF6] animate-pulse" />
                  )}
                </div>
                <div>
                  <span className="text-[11px] font-extrabold text-[#8B5CF6] tracking-wider block uppercase">
                    AI 智能热量预测
                  </span>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    根据项目和时间自动拟合
                  </p>
                </div>
              </div>

              <div className="text-right flex flex-col justify-center items-end">
                {estimatedCalories > 0 ? (
                  <div className="flex items-baseline gap-0.5 animate-fade-in">
                    <span className="text-2xl font-black text-[#8B5CF6] tracking-tight">
                      {estimatedCalories}
                    </span>
                    <span className="text-[10px] text-[#8B5CF6] font-bold">kcal</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 font-bold italic">
                    待输入数据...
                  </span>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="submit-workout-btn"
              type="submit"
              disabled={!customType.trim() || !customDuration || estimatedCalories <= 0}
              className="w-full bg-[#111827] hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl text-xs transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Plus size={15} />
              保存并记录至今日运动
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

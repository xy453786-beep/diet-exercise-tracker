import React, { useState } from 'react';
import { Sparkles, Droplet, Flame, ArrowRight, X, Plus, Utensils, Dumbbell } from 'lucide-react';
import { WeightEntry, MealRecord, WorkoutItem, MealCategory } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { calculateBMR, calculateTDEE } from '../utils/metabolism';
import { useAuth } from '../context/AuthContext';

interface HomePageProps {
  weights: WeightEntry[];
  meals: MealRecord[];
  workouts: WorkoutItem[];
  waterIntake: number;
  onAddWater: (cupSize: number) => void;
  onSubtractWater: (cupSize: number) => void;
  onNavigateToAI: () => void;
  onOpenFoodScanner?: (category?: MealCategory) => void;
  onOpenAddWorkout?: () => void;
  height: number;
  onUpdateLatestWeight: (w: number) => void;
  selectedDay: string;
}

export default function HomePage({
  weights,
  meals,
  workouts,
  waterIntake,
  onAddWater,
  onSubtractWater,
  onNavigateToAI,
  onOpenFoodScanner,
  onOpenAddWorkout,
  height,
  onUpdateLatestWeight,
  selectedDay,
}: HomePageProps) {
  // Local edit state for inline modification
  const [editingField, setEditingField] = useState<'weight' | null>(null);
  const [inputValue, setInputValue] = useState<string>('');

  // Water customization state
  const [cupSize, setCupSize] = useState(250);
  const [editingCupSize, setEditingCupSize] = useState(false);
  const [waterInputValue, setWaterInputValue] = useState('');
  const [waterTarget, setWaterTarget] = useState(2000);
  const [editingWaterTarget, setEditingWaterTarget] = useState(false);
  const [waterTargetInput, setWaterTargetInput] = useState('');

  // User profile for personalized metabolism calculation
  const { appUser, userMetrics, weightPredictions } = useAuth();
  const age = appUser?.age || 30;
  const gender = appUser?.gender || 'male';
  const activityLevel = appUser?.activityLevel || 'sedentary';

  // Find weight for the selected day
  const selectedWeightEntry = weights.find(w => w.day === selectedDay) || weights[weights.length - 1];
  const selectedWeight = selectedWeightEntry?.weight || 72.5;
  const bmi = parseFloat((selectedWeight / ((height / 100) * (height / 100))).toFixed(2));

  // Today's total intake calories
  const todayIntake = meals.reduce((sum, meal) => {
    return sum + meal.items.reduce((mSum, item) => mSum + item.calories, 0);
  }, 0);

  // BMR/TDEE：优先使用数据库触发器计算的值（含热量盈余估重），前端公式兜底
  const bmr = userMetrics?.bmr ?? calculateBMR(selectedWeight, height, age, gender);
  const tdee = userMetrics?.tdee ?? calculateTDEE(
    userMetrics?.bmr ?? calculateBMR(selectedWeight, height, age, gender),
    activityLevel
  );
  // 今日运动消耗
  const todayWorkoutBurn = workouts.reduce((sum, w) => sum + w.calories, 0);
  // 总能量消耗 = TDEE + 运动额外消耗
  const totalBurn = tdee + todayWorkoutBurn;

  // 剩余可摄入 = 总消耗(TDEE+运动) - 今日已摄入
  // 正值 = 还能吃，负值 = 吃超了
  const remainingCalories = totalBurn - todayIntake;
  const overBudget = remainingCalories < 0;
  // 预算已用百分比（用于圆环进度）
  const intakePercentage = Math.min(100, Math.round((todayIntake / totalBurn) * 100));
  // 圆环颜色：剩余 > 0 用主题紫，超预算用红色
  const gaugeColor = overBudget ? '#EF4444' : '#8B5CF6';
  const gaugeBgColor = overBudget ? '#FEE2E2' : '#F3EEFF';

  const startEditCup = () => {
    setEditingCupSize(true);
    setWaterInputValue(String(cupSize));
  };

  const confirmCupEdit = () => {
    const num = Number(waterInputValue);
    if (!isNaN(num) && num > 0 && num <= 10000) {
      setCupSize(num);
    }
    setEditingCupSize(false);
    setWaterInputValue('');
  };

  return (
    <div className="flex flex-col justify-between animate-fade-in px-4 pt-3 pb-3 h-full">

      {/* ── Section 1: 体重 + BMI 合并卡片 ── */}
      <div className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
        {editingField === 'weight' ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-400">体重</span>
            <div className="flex items-center border-b-2 border-[#8B5CF6]">
              <input
                id="input-inline-weight"
                type="text"
                autoFocus
                value={inputValue}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) setInputValue(val);
                }}
                onBlur={() => {
                  const val = parseFloat(inputValue);
                  if (val > 0) onUpdateLatestWeight(val);
                  setEditingField(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseFloat(inputValue);
                    if (val > 0) onUpdateLatestWeight(val);
                    setEditingField(null);
                  } else if (e.key === 'Escape') setEditingField(null);
                }}
                className="w-16 text-center text-[18px] font-extrabold text-gray-900 bg-transparent outline-none"
              />
            </div>
            <span className="text-[11px] text-gray-400 font-medium">kg</span>
          </div>
        ) : (
          <button
            id="weight-card-btn"
            onClick={() => {
              setEditingField('weight');
              setInputValue(selectedWeight.toString());
            }}
            className="flex items-center gap-2 active:scale-95 transition-all"
          >
            <span className="text-[11px] font-semibold text-gray-400">体重</span>
            <span className="text-[17px] font-extrabold text-gray-900">{selectedWeight.toFixed(2)}</span>
            <span className="text-[11px] text-gray-400 font-medium">kg</span>
          </button>
        )}

        <div className="w-px h-6 bg-gray-100" />

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-400">BMI</span>
          <span className="text-[17px] font-extrabold text-gray-900">{bmi.toFixed(2)}</span>
        </div>
      </div>

      {/* ── Section 2: 快捷操作（浅色样式）── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          id="home-add-food-btn"
          onClick={() => onOpenFoodScanner?.('lunch')}
          className="bg-white rounded-2xl p-2 flex flex-col items-center justify-center h-[86px] shadow-sm border border-orange-100 hover:border-orange-300 active:scale-[0.97] transition-all cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center mb-1">
            <Utensils size={15} className="text-orange-500" />
          </div>
          <span className="text-[12px] font-bold text-gray-800">添加饮食</span>
          <span className="text-[8px] text-gray-400">拍照或手动记录</span>
        </button>

        <button
          id="home-add-workout-btn"
          onClick={onOpenAddWorkout}
          className="bg-white rounded-2xl p-2 flex flex-col items-center justify-center h-[86px] shadow-sm border border-purple-100 hover:border-purple-300 active:scale-[0.97] transition-all cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-[#F3EEFF] flex items-center justify-center mb-1">
            <Dumbbell size={15} className="text-[#8B5CF6]" />
          </div>
          <span className="text-[12px] font-bold text-gray-800">记录运动</span>
          <span className="text-[8px] text-gray-400">添加今日锻炼</span>
        </button>
      </div>

      {/* ── Section 3: 热量圆环 + 摄入vs消耗 合并 ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-start gap-3">
          {/* 左侧：圆环 */}
          <div className="relative flex items-center justify-center flex-shrink-0">
            <svg className="w-[80px] h-[86px] transform -rotate-90">
              <circle cx="40" cy="40" r="33" className="stroke-gray-100" strokeWidth="6" fill="transparent" />
              <circle
                cx="40" cy="40" r="33"
                stroke={gaugeColor}
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 33}
                strokeDashoffset={2 * Math.PI * 33 * (1 - intakePercentage / 100)}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={`text-[15px] font-black leading-none ${overBudget ? 'text-red-500' : 'text-gray-900'}`}>
                {remainingCalories > 0 ? remainingCalories : 0}
              </span>
              <span className="text-[6px] font-bold text-gray-400 tracking-wider">剩余</span>
            </div>
          </div>

          {/* 右侧：摄入 vs 消耗 */}
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-semibold text-gray-400 block mb-1.5">
              {selectedDay === '今日' ? '今日' : selectedDay}热量
            </span>
            <div className="space-y-1.5">
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-gray-500 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                    摄入
                  </span>
                  <span className="font-extrabold text-gray-800">{todayIntake} kcal</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#8B5CF6] rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (todayIntake / totalBurn) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-gray-500 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-900" />
                    消耗
                  </span>
                  <span className="font-extrabold text-gray-800">{totalBurn} kcal</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-900 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (totalBurn / 2400) * 100)}%` }} />
                </div>
              </div>
            </div>
            {overBudget && (
              <span className="text-[8px] font-semibold text-red-500 mt-1 block">已超出 {Math.abs(remainingCalories)} kcal</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 4: AI 预测趋势 ── */}
      <div className="bg-gradient-to-br from-[#F9F7FF] to-[#F3EEFF] rounded-2xl p-3.5 shadow-sm">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles size={12} className="text-[#8B5CF6]" />
          <span className="text-[11px] font-bold text-gray-800">AI 预测趋势</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/80 rounded-xl p-2.5">
            <span className="text-[9px] text-gray-400 block mb-0.5">7天后</span>
            <div className="flex items-baseline gap-1">
              {weightPredictions ? (
                <span className="text-[15px] font-extrabold text-[#8B5CF6]">
                  {(weightPredictions.predicted_weight_7d_jin / 2).toFixed(2)}
                  <span className="text-[9px] text-[#8B5CF6] font-medium ml-0.5">kg</span>
                </span>
              ) : (
                <span className="text-[18px] font-extrabold text-gray-300">—</span>
              )}
            </div>
            {weightPredictions && (
              <span className="text-[8px] text-gray-400">
                {((weightPredictions.predicted_weight_7d_jin / 2) - selectedWeight) > 0 ? '▲' : '▼'}
                {Math.abs((weightPredictions.predicted_weight_7d_jin / 2) - selectedWeight).toFixed(2)}
              </span>
            )}
          </div>
          <div className="bg-white/80 rounded-xl p-2.5">
            <span className="text-[9px] text-gray-400 block mb-0.5">30天后</span>
            <div className="flex items-baseline gap-1">
              {weightPredictions ? (
                <span className="text-[15px] font-extrabold text-[#8B5CF6]">
                  {(weightPredictions.predicted_weight_30d_jin / 2).toFixed(2)}
                  <span className="text-[9px] text-[#8B5CF6] font-medium ml-0.5">kg</span>
                </span>
              ) : (
                <span className="text-[18px] font-extrabold text-gray-300">—</span>
              )}
            </div>
            {weightPredictions && (
              <span className="text-[8px] text-gray-400">
                {((weightPredictions.predicted_weight_30d_jin / 2) - selectedWeight) > 0 ? '▲' : '▼'}
                {Math.abs((weightPredictions.predicted_weight_30d_jin / 2) - selectedWeight).toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* 自适应校正系数 */}
        {weightPredictions && weightPredictions.correction_factor && (
          <div className="mt-1.5 flex items-center justify-end gap-1">
            <span className="text-[7px] text-gray-300">校正系数</span>
            <span className={`text-[8px] font-bold ${weightPredictions.correction_factor < 0.95 ? 'text-amber-400' : weightPredictions.correction_factor > 1.05 ? 'text-blue-400' : 'text-gray-300'}`}>
              {weightPredictions.correction_factor.toFixed(3)}
            </span>
          </div>
        )}
      </div>

      {/* ── Section 5: 水分摄入 ── */}
      <div className="bg-white rounded-2xl p-3.5 shadow-sm">
        {/* 顶栏：标题 + 目标 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <Droplet size={12} fill="#8B5CF6" className="text-[#8B5CF6]" />
            <span className="text-[10px] font-bold text-gray-800">水分摄入</span>
          </div>
          {editingWaterTarget ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="number"
                value={waterTargetInput}
                onChange={(e) => setWaterTargetInput(e.target.value)}
                onBlur={() => {
                  const val = Number(waterTargetInput);
                  if (val > 0 && val <= 10000) setWaterTarget(val);
                  setEditingWaterTarget(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = Number(waterTargetInput);
                    if (val > 0 && val <= 10000) setWaterTarget(val);
                    setEditingWaterTarget(false);
                  }
                  if (e.key === 'Escape') setEditingWaterTarget(false);
                }}
                className="w-16 text-center text-[13px] font-bold text-[#8B5CF6] bg-[#F3EEFF] rounded-lg py-1.5 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-gray-400 font-medium">ml</span>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingWaterTarget(true);
                setWaterTargetInput(String(waterTarget));
              }}
              className="text-[12px] text-gray-500 font-semibold bg-gray-100/80 px-4 py-1.5 rounded-full active:scale-95 transition-all"
            >
              目标 <span className="font-extrabold text-[#8B5CF6]">{waterTarget}</span> ml
            </button>
          )}
        </div>

        {/* 水量数字 */}
        <div className="flex items-end gap-1 mb-1">
          <span className="text-[18px] font-black text-[#8B5CF6] leading-none">{waterIntake}</span>
          <span className="text-[9px] text-gray-400 font-medium mb-0.5">/ {waterTarget} ml</span>
        </div>

        {/* 进度条 */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round((waterIntake / waterTarget) * 100))}%` }}
          />
        </div>

        {/* 按钮区域 */}
        <div className="flex items-center gap-2">
          <button
            id="minus-water-btn"
            onClick={() => onSubtractWater(cupSize)}
            className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold text-[11px] py-2 rounded-xl border border-gray-100 active:scale-[0.97] transition-all"
          >
            − 减一杯
          </button>

          {editingCupSize ? (
            <div className="flex items-center gap-1 bg-[#F0F9FF] rounded-xl py-2 px-2.5 border border-[#BAE6FD] justify-center">
              <input
                autoFocus
                type="number"
                value={waterInputValue}
                onChange={(e) => setWaterInputValue(e.target.value)}
                onBlur={() => confirmCupEdit()}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmCupEdit(); }}
                className="w-10 text-center text-[13px] font-extrabold text-[#0369A1] bg-transparent border-b border-[#0369A1]/30 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[9px] text-[#0369A1]/60 font-bold">ml</span>
            </div>
          ) : (
            <button
              onClick={() => startEditCup()}
              className="flex items-center gap-0.5 bg-white rounded-xl py-1.5 px-2.5 border border-[#8B5CF6]/20 justify-center active:scale-[0.97] transition-all"
            >
              <span className="text-[11px] font-extrabold text-[#8B5CF6]">{cupSize}</span>
              <span className="text-[8px] text-[#8B5CF6] font-bold">ml</span>
            </button>
          )}

          <button
            id="drink-water-btn"
            onClick={() => onAddWater(cupSize)}
            className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-[11px] py-2 rounded-xl active:scale-[0.97] transition-all shadow-sm"
          >
            + 记一杯
          </button>
        </div>
      </div>

      

    </div>
  );
}

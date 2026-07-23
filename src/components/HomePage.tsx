import React, { useState } from 'react';
import { Sparkles, Droplet, Flame, ArrowRight, TrendingDown, X } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { WeightEntry, MealRecord, WorkoutItem } from '../types';
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
  height: number;
  onUpdateHeight: (h: number) => void;
  onUpdateLatestWeight: (w: number) => void;
  selectedDay: string;
  onSelectDay: (day: string) => void;
}

export default function HomePage({
  weights,
  meals,
  workouts,
  waterIntake,
  onAddWater,
  onSubtractWater,
  onNavigateToAI,
  height,
  onUpdateHeight,
  onUpdateLatestWeight,
  selectedDay,
  onSelectDay,
}: HomePageProps) {
  // Local edit state for inline modification
  const [editingField, setEditingField] = useState<'height' | 'weight' | null>(null);
  const [inputValue, setInputValue] = useState<string>('');

  // Water customization state
  const [waterTarget, setWaterTarget] = useState(2000);
  const [cupSize, setCupSize] = useState(250);
  const [editingWaterField, setEditingWaterField] = useState<'target' | 'cup' | null>(null);
  const [waterInputValue, setWaterInputValue] = useState('');

  // User profile for personalized metabolism calculation
  const { appUser, userMetrics, weightPredictions } = useAuth();
  const age = appUser?.age || 30;
  const gender = appUser?.gender || 'male';
  const activityLevel = appUser?.activityLevel || 'sedentary';

  // Find weight for the selected day
  const selectedWeightEntry = weights.find(w => w.day === selectedDay) || weights[weights.length - 1];
  const selectedWeight = selectedWeightEntry?.weight || 72.5;
  const bmi = parseFloat((selectedWeight / ((height / 100) * (height / 100))).toFixed(1));

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

  // Water target percentage
  const waterPercentage = Math.min(100, Math.round((waterIntake / waterTarget) * 100));

  const startWaterEdit = (field: 'target' | 'cup', currentValue: number) => {
    setEditingWaterField(field);
    setWaterInputValue(String(currentValue));
  };

  const confirmWaterEdit = (field: 'target' | 'cup') => {
    const num = Number(waterInputValue);
    if (!isNaN(num) && num > 0 && num <= 10000) {
      if (field === 'target') setWaterTarget(num);
      else if (field === 'cup') setCupSize(num);
    }
    setEditingWaterField(null);
    setWaterInputValue('');
  };

  // Weight trend change calculation
  const startWeight = weights[0]?.weight || 73.5;
  const currentWeight = selectedWeight;
  const weightChange = parseFloat((currentWeight - startWeight).toFixed(2));
  const isWeightLost = weightChange <= 0;

  // Custom tooltips for recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111111] text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md">
          {payload[0].value} kg
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in px-4 pt-4">
      
      {/* Top Profile Summary row */}
      <div className="grid grid-cols-3 gap-2.5">
        {editingField === 'height' ? (
          <div className="bg-white/90 backdrop-blur-md border border-[#8B5CF6] rounded-[16px] p-2.5 flex flex-col items-center justify-center h-[60px] shadow-inner w-full">
            <span className="text-[10px] font-semibold text-[#8B5CF6] block mb-0.5">身高 (cm)</span>
            <input
              id="input-inline-height"
              type="text"
              autoFocus
              value={inputValue}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setInputValue(val);
                }
              }}
              onBlur={() => {
                const val = parseFloat(inputValue);
                if (val > 0) onUpdateHeight(val);
                setEditingField(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = parseFloat(inputValue);
                  if (val > 0) onUpdateHeight(val);
                  setEditingField(null);
                } else if (e.key === 'Escape') {
                  setEditingField(null);
                }
              }}
              className="w-full text-center text-[18px] font-extrabold text-black bg-transparent outline-none border-b border-[#8B5CF6]/30 focus:border-[#8B5CF6] py-0 px-1 leading-none"
            />
          </div>
        ) : (
          <button
            id="height-card-btn"
            onClick={() => {
              setEditingField('height');
              setInputValue(height.toString());
            }}
            className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-2.5 text-center shadow-sm hover:border-[#8B5CF6]/50 hover:bg-[#F3EEFF]/30 active:scale-95 transition-all cursor-pointer flex flex-col items-center justify-center h-[60px] relative w-full"
          >
            <span className="text-[10px] font-semibold text-[#6B7280] block mb-0.5">身高 (cm)</span>
            <span className="text-[18px] font-extrabold text-black">
              {height}
            </span>
          </button>
        )}

        {editingField === 'weight' ? (
          <div className="bg-white/90 backdrop-blur-md border border-[#8B5CF6] rounded-[16px] p-2.5 flex flex-col items-center justify-center h-[60px] shadow-inner w-full">
            <span className="text-[10px] font-semibold text-[#8B5CF6] block mb-0.5">体重 (kg)</span>
            <input
              id="input-inline-weight"
              type="text"
              autoFocus
              value={inputValue}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setInputValue(val);
                }
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
                } else if (e.key === 'Escape') {
                  setEditingField(null);
                }
              }}
              className="w-full text-center text-[18px] font-extrabold text-black bg-transparent outline-none border-b border-[#8B5CF6]/30 focus:border-[#8B5CF6] py-0 px-1 leading-none"
            />
          </div>
        ) : (
          <button
            id="weight-card-btn"
            onClick={() => {
              setEditingField('weight');
              setInputValue(selectedWeight.toString());
            }}
            className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-2.5 text-center shadow-sm hover:border-[#8B5CF6]/50 hover:bg-[#F3EEFF]/30 active:scale-95 transition-all cursor-pointer flex flex-col items-center justify-center h-[60px] relative w-full"
          >
            <span className="text-[10px] font-semibold text-[#6B7280] block mb-0.5">体重 (kg)</span>
            <span className="text-[18px] font-extrabold text-black">
              {selectedWeight}
            </span>
          </button>
        )}

        <div
          className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-2.5 text-center shadow-sm flex flex-col items-center justify-center h-[60px] relative"
        >
          <span className="text-[10px] font-semibold text-[#6B7280] block mb-0.5">BMI 指数</span>
          <span className="text-[18px] font-extrabold text-black">
            {bmi}
          </span>
        </div>
      </div>

      {/* Weight Trend Card */}
      <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h3 className="text-[14px] font-semibold text-[#111111]">
              体重趋势 {selectedDay === '今日' ? '(近7天)' : `(${selectedDay})`}
            </h3>
            <p className="text-[11px] text-[#9CA3AF]">点击下方折线点切换日期查看数据</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#E8F8F5] text-[#10B981] flex items-center gap-1">
            <TrendingDown size={12} />
            {isWeightLost ? '' : '+'}{weightChange}kg {selectedDay === '今日' ? '本周' : '至该日'}
          </span>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-36 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={weights} 
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              onClick={(state) => {
                if (state && state.activeLabel) {
                  onSelectDay(String(state.activeLabel));
                }
              }}
              style={{ cursor: 'pointer', outline: 'none' }}
              className="outline-none"
            >
              <defs>
                <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#9CA3AF', fontSize: 10 }}
              />
              <YAxis 
                domain={['dataMin - 1', 'dataMax + 1']} 
                hide={true} 
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#F3EEFF', strokeWidth: 1 }} />
              <Area 
                type="monotone" 
                dataKey="weight" 
                stroke="#8B5CF6" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#weightGrad)"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isSelected = payload.day === selectedDay;
                  return (
                    <circle
                      key={payload.day}
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 6 : 4}
                      stroke="#8B5CF6"
                      strokeWidth={isSelected ? 3 : 2}
                      fill={isSelected ? '#8B5CF6' : '#FFFFFF'}
                    />
                  );
                }}
                activeDot={{ r: 7, stroke: '#8B5CF6', strokeWidth: 2, fill: '#8B5CF6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Smart Prediction */}
      <div className="bg-gradient-to-br from-[#F3EEFF]/80 to-[#E8DCFF]/50 backdrop-blur-md border border-white/60 rounded-[16px] p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="p-1 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6]">
            <Sparkles size={16} />
          </div>
          <h4 className="text-[13px] font-bold text-gray-900">✨ AI 智能预测趋势</h4>
        </div>
        <p className="text-[11px] text-gray-500 mb-3 ml-7">准确概率会随着数据增多而提高</p>

        <div className="grid grid-cols-2 gap-3 pl-7">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-2.5 border border-white/40">
            <span className="text-[10px] text-gray-400 block mb-0.5">预计7天后</span>
            <div className="flex items-baseline gap-1">
              {weightPredictions ? (
                <>
                  <span className="text-[18px] font-extrabold text-[#8B5CF6]">
                    {(weightPredictions.predicted_weight_7d_jin / 2 - selectedWeight) <= 0 ? '' : '+'}
                    {(weightPredictions.predicted_weight_7d_jin / 2 - selectedWeight).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-[#8B5CF6] font-medium">kg</span>
                </>
              ) : (
                <span className="text-[18px] font-extrabold text-[#8B5CF6]">计算中</span>
              )}
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-2.5 border border-white/40">
            <span className="text-[10px] text-gray-400 block mb-0.5">预计30天后</span>
            <div className="flex items-baseline gap-1">
              {weightPredictions ? (
                <>
                  <span className="text-[18px] font-extrabold text-[#8B5CF6]">
                    {(weightPredictions.predicted_weight_30d_jin / 2 - selectedWeight) <= 0 ? '' : '+'}
                    {(weightPredictions.predicted_weight_30d_jin / 2 - selectedWeight).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-[#8B5CF6] font-medium">kg</span>
                </>
              ) : (
                <span className="text-[18px] font-extrabold text-[#8B5CF6]">计算中</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Grid: Energy Target & Water Tracker */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* Calorie Budget (Circular Progress) */}
        <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm flex flex-col justify-between">
          <h3 className="text-[12px] font-semibold text-[#6B7280] mb-3">
            {selectedDay === '今日' ? '今日' : selectedDay}剩余可摄入
          </h3>

          <div className="relative flex justify-center items-center py-2">
            {/* SVG Circle Gauge */}
            <svg className="w-28 h-28 transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="46"
                className="stroke-[#E5E7EB]"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="56"
                cy="56"
                r="46"
                stroke={gaugeColor}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 46}
                strokeDashoffset={2 * Math.PI * 46 * (1 - intakePercentage / 100)}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute text-center">
              <span className={`text-[20px] font-black block leading-none ${overBudget ? 'text-[#EF4444]' : 'text-gray-900'}`}>
                {remainingCalories > 0 ? remainingCalories : 0}
              </span>
              <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-wider mt-1 block">kcal 剩余</span>
            </div>
          </div>

          <div className="text-center mt-2">
            <span className="text-[11px] font-semibold text-gray-400">
              已摄入 <span className={`font-extrabold ${overBudget ? 'text-[#EF4444]' : 'text-[#8B5CF6]'}`}>{todayIntake}</span> / {totalBurn} kcal
            </span>
          </div>
        </div>

        {/* Water Intake Tracker */}
        <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-[12px] font-semibold text-[#6B7280] mb-2">
              水分摄入
            </h3>
            <div className="flex items-center gap-1.5 text-[#8B5CF6] mb-2">
              <Droplet size={18} fill="#8B5CF6" />
              <span className="text-[20px] font-black">{waterIntake}</span>
              <span className="text-[11px] text-gray-400 font-medium">ml</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-[#8B5CF6] transition-all duration-300"
                style={{ width: `${waterPercentage}%` }}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400">目标</span>
              {editingWaterField === 'target' ? (
                <input
                  autoFocus
                  type="number"
                  value={waterInputValue}
                  onChange={(e) => setWaterInputValue(e.target.value)}
                  onBlur={() => confirmWaterEdit('target')}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmWaterEdit('target'); }}
                  className="text-[10px] font-bold text-[#8B5CF6] w-14 bg-transparent border-b border-[#8B5CF6] outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              ) : (
                <span
                  className="text-[10px] font-bold text-gray-500 cursor-pointer hover:text-[#8B5CF6] transition-colors border-b border-dashed border-gray-300 hover:border-[#8B5CF6]"
                  onClick={() => startWaterEdit('target', waterTarget)}
                >
                  {waterTarget}
                </span>
              )}
              <span className="text-[10px] text-gray-400">ml</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-1.5 mt-3 w-full">
            {editingWaterField === 'cup' ? (
              <div className="w-full flex items-center justify-center gap-1 bg-[#E0F2FE] rounded-full py-2 px-3">
                <input
                  autoFocus
                  type="number"
                  value={waterInputValue}
                  onChange={(e) => setWaterInputValue(e.target.value)}
                  onBlur={() => confirmWaterEdit('cup')}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmWaterEdit('cup'); }}
                  className="text-xs font-bold text-[#0369A1] w-14 bg-transparent border-b border-[#0369A1]/40 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="250"
                />
                <span className="text-[10px] text-[#0369A1]/60 font-medium">ml/杯</span>
              </div>
            ) : (
              <button
                id="drink-water-btn"
                onClick={() => onAddWater(cupSize)}
                className="w-full bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0369A1] font-bold text-xs py-2 rounded-full flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm"
              >
                记一杯 (+{cupSize}ml)
              </button>
            )}
            <button
              id="minus-water-btn"
              onClick={() => onSubtractWater(cupSize)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 rounded-full flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm"
            >
              减一杯 (-{cupSize}ml)
            </button>
            <span
              className="text-[10px] text-gray-400 cursor-pointer hover:text-[#8B5CF6] transition-colors border-b border-dashed border-gray-300 hover:border-[#8B5CF6]"
              onClick={() => startWaterEdit('cup', cupSize)}
            >
              修改杯量
            </span>
          </div>
        </div>
      </div>

      {/* Calories Balance Bar Card */}
      <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm">
        <h3 className="text-[13px] font-semibold text-gray-800 mb-3">
          {selectedDay === '今日' ? '今日' : selectedDay}摄入 vs 消耗 (卡路里)
        </h3>
        
        <div className="space-y-3">
          {/* Intake bar */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-gray-500 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                {selectedDay === '今日' ? '今日' : selectedDay}摄入
              </span>
              <span className="font-extrabold text-gray-800">{todayIntake} kcal</span>
            </div>
            <div className="w-full h-3 bg-[#E5E7EB] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#8B5CF6] transition-all duration-500"
                style={{ width: `${Math.min(100, (todayIntake / 2100) * 100)}%` }}
              />
            </div>
          </div>

          {/* Burn bar */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-gray-500 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-black" />
                {selectedDay === '今日' ? '今日' : selectedDay}消耗
              </span>
              <span className="font-extrabold text-gray-800">{totalBurn} kcal</span>
            </div>
            <div className="w-full h-3 bg-[#E5E7EB] rounded-full overflow-hidden">
              <div 
                className="h-full bg-black transition-all duration-500"
                style={{ width: `${Math.min(100, (totalBurn / 2400) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>



    </div>
  );
}

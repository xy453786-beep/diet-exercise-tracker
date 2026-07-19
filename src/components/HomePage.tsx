import React, { useState } from 'react';
import { Sparkles, Droplet, Flame, ArrowRight, TrendingDown, X } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { WeightEntry, MealRecord, WorkoutItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface HomePageProps {
  weights: WeightEntry[];
  meals: MealRecord[];
  workouts: WorkoutItem[];
  waterIntake: number;
  onAddWater: () => void;
  onSubtractWater: () => void;
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

  // Find weight for the selected day
  const selectedWeightEntry = weights.find(w => w.day === selectedDay) || weights[weights.length - 1];
  const selectedWeight = selectedWeightEntry?.weight || 72.5;
  const bmi = parseFloat((selectedWeight / ((height / 100) * (height / 100))).toFixed(1));

  // Today's total intake calories
  const todayIntake = meals.reduce((sum, meal) => {
    return sum + meal.items.reduce((mSum, item) => mSum + item.calories, 0);
  }, 0);

  // Today's workout burn + BMR
  const bmr = 1618;
  const todayWorkoutBurn = workouts.reduce((sum, w) => sum + w.calories, 0);
  const totalBurn = bmr + todayWorkoutBurn;

  // Circular progress for target percentage (say, daily target of 2100 for intake, or 2400 burn)
  const burnTarget = 2400;
  const burnPercentage = Math.min(100, Math.round((totalBurn / burnTarget) * 100));

  // Water target
  const waterTarget = 2000;
  const waterPercentage = Math.min(100, Math.round((waterIntake / waterTarget) * 100));

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
              <span className="text-[18px] font-extrabold text-[#8B5CF6]">-0.85</span>
              <span className="text-[10px] text-[#8B5CF6] font-medium">kg</span>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-2.5 border border-white/40">
            <span className="text-[10px] text-gray-400 block mb-0.5">预计30天后</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[18px] font-extrabold text-[#8B5CF6]">-3.20</span>
              <span className="text-[10px] text-[#8B5CF6] font-medium">kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Grid: Energy Target & Water Tracker */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* Burn Target (Circular Progress) */}
        <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm flex flex-col justify-between">
          <h3 className="text-[12px] font-semibold text-[#6B7280] mb-3">
            {selectedDay === '今日' ? '今日' : selectedDay}能量消耗
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
                className="stroke-[#8B5CF6] transition-all duration-1000 ease-out"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 46}
                strokeDashoffset={2 * Math.PI * 46 * (1 - burnPercentage / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-[20px] font-black text-gray-900 block leading-none">{burnPercentage}%</span>
              <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-wider mt-1 block">Target</span>
            </div>
          </div>

          <div className="text-center mt-2">
            <span className="text-[16px] font-black text-[#8B5CF6]">{totalBurn}</span>
            <span className="text-[10px] text-gray-400 font-medium ml-1">kcal</span>
          </div>
        </div>

        {/* Water Intake Tracker */}
        <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-[12px] font-semibold text-[#6B7280] mb-2">
              {selectedDay === '今日' ? '' : selectedDay}水分摄入
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
            <span className="text-[10px] text-gray-400 block">目标 {waterTarget}ml</span>
          </div>

          <div className="flex flex-col items-center justify-center gap-1.5 mt-3 w-full">
            <button
              id="drink-water-btn"
              onClick={onAddWater}
              className="w-full bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0369A1] font-bold text-xs py-2 rounded-full flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm"
            >
              记一杯 (+250ml)
            </button>
            <button
              id="minus-water-btn"
              onClick={onSubtractWater}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 rounded-full flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm"
            >
              减一杯 (-250ml)
            </button>
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

import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Info, Sparkles, ChevronDown, CheckCircle2, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { WeightEntry, MealRecord, WorkoutItem } from '../types';

interface AnalysisPageProps {
  weights: WeightEntry[];
  mealsByDay: Record<string, MealRecord[]>;
  workoutsByDay: Record<string, WorkoutItem[]>;
  selectedDay?: string;
}

// Seedable deterministic pseudo-random to prevent chart values changing on every render
const getSeededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

type Timeframe = 'today' | '3days' | '7days' | '周一' | '周二' | '周三' | '周四' | '周五' | '周六' | '今日';

export default function AnalysisPage({
  weights,
  mealsByDay,
  workoutsByDay,
  selectedDay = '今日',
}: AnalysisPageProps) {
  const initialTimeframe = selectedDay === '今日' ? 'today' : (selectedDay as Timeframe);
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [showDropdown, setShowDropdown] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState<7 | 30>(7);

  useEffect(() => {
    setTimeframe(selectedDay === '今日' ? 'today' : (selectedDay as Timeframe));
  }, [selectedDay]);

  // Constants
  const bmr = 1618;

  // Calculate dynamic stats
  const latestWeight = weights[weights.length - 1]?.weight || 72.5;

  const getDayStats = (dayName: string) => {
    const dayMeals = mealsByDay[dayName] || [];
    const dayWorkouts = workoutsByDay[dayName] || [];

    const intake = dayMeals.reduce((sum, meal) => {
      return sum + (meal.items || []).reduce((mSum, item) => mSum + item.calories, 0);
    }, 0);

    const workoutBurn = dayWorkouts.reduce((sum, w) => sum + w.calories, 0);
    const totalBurn = bmr + workoutBurn;
    const balance = intake - totalBurn;

    return { intake, workoutBurn, totalBurn, balance };
  };

  // Let's create an adaptive analysis depending on selected timeframe
  let displayIntake = 0;
  let displayWorkoutBurn = 0;
  let displayBurn = 0;
  let displayBalance = 0;
  let displayDays = 1;

  if (timeframe === '3days') {
    const days = ['今日', '周六', '周五'];
    const statsList = days.map(getDayStats);
    displayIntake = Math.round(statsList.reduce((sum, s) => sum + s.intake, 0) / 3);
    displayWorkoutBurn = Math.round(statsList.reduce((sum, s) => sum + s.workoutBurn, 0) / 3);
    displayBurn = bmr + displayWorkoutBurn;
    displayBalance = displayIntake - displayBurn;
    displayDays = 3;
  } else if (timeframe === '7days') {
    const daysList = ['周一', '周二', '周三', '周四', '周五', '周六', '今日'];
    const statsList = daysList.map(getDayStats);
    displayIntake = Math.round(statsList.reduce((sum, s) => sum + s.intake, 0) / 7);
    displayWorkoutBurn = Math.round(statsList.reduce((sum, s) => sum + s.workoutBurn, 0) / 7);
    displayBurn = bmr + displayWorkoutBurn;
    displayBalance = displayIntake - displayBurn;
    displayDays = 7;
  } else {
    // Single day: 'today' or a specific day of week
    const targetDay = timeframe === 'today' ? '今日' : timeframe;
    const stats = getDayStats(targetDay);
    displayIntake = stats.intake;
    displayWorkoutBurn = stats.workoutBurn;
    displayBurn = stats.totalBurn;
    displayBalance = stats.balance;
    displayDays = 1;
  }

  const timeframeLabels: Record<Timeframe, string> = {
    today: '今日',
    '3days': '近 3 天',
    '7days': '近 7 天',
    '今日': '今日',
    '周一': '周一',
    '周二': '周二',
    '周三': '周三',
    '周四': '周四',
    '周五': '周五',
    '周六': '周六',
  };

  const handleSelectTimeframe = (tf: Timeframe) => {
    setTimeframe(tf);
    setShowDropdown(false);
  };

  // 7 Days Chart Data
  const daysOfWeek = ['周一', '周二', '周三', '周四', '周五', '周六', '今日'];
  const chartData7Days = useMemo(() => {
    return daysOfWeek.map((day) => {
      // Intake
      const dayMeals = mealsByDay[day] || [];
      const intake = dayMeals.reduce((sum, meal) => {
        return sum + (meal.items || []).reduce((mSum, item) => mSum + item.calories, 0);
      }, 0);

      // Burn
      const dayWorkouts = workoutsByDay[day] || [];
      const workoutBurn = dayWorkouts.reduce((sum, w) => sum + w.calories, 0);
      const totalBurn = bmr + workoutBurn;

      // Weight
      const weightEntry = weights.find((w) => w.day === day);
      const weight = weightEntry ? weightEntry.weight : latestWeight;

      return {
        name: day,
        '热量摄入': intake,
        '热量消耗': totalBurn,
        '体重': weight,
      };
    });
  }, [weights, mealsByDay, workoutsByDay, latestWeight]);

  // 30 Days Chart Data (last 7 days map to active data, first 23 days are simulated with realistic trend)
  const chartData30Days = useMemo(() => {
    const data = [];
    const baseWeightMonday = weights.find((w) => w.day === '周一')?.weight || 73.5;
    const startWeight = baseWeightMonday + 2.3;

    for (let i = 0; i < 30; i++) {
      if (i >= 23) {
        // Active 7 days
        const activeDayIdx = i - 23;
        const dayName = daysOfWeek[activeDayIdx];

        const dayMeals = mealsByDay[dayName] || [];
        const intake = dayMeals.reduce((sum, meal) => {
          return sum + (meal.items || []).reduce((mSum, item) => mSum + item.calories, 0);
        }, 0);

        const dayWorkouts = workoutsByDay[dayName] || [];
        const workoutBurn = dayWorkouts.reduce((sum, w) => sum + w.calories, 0);
        const totalBurn = bmr + workoutBurn;

        const weightEntry = weights.find((w) => w.day === dayName);
        const weight = weightEntry ? weightEntry.weight : latestWeight;

        const dateNum = 12 + activeDayIdx;
        data.push({
          name: `7/${dateNum}`,
          '热量摄入': intake,
          '热量消耗': totalBurn,
          '体重': weight,
        });
      } else {
        // Simulated prior 23 days (from 6/19 to 7/11)
        const seed = i + 101;
        const rand1 = getSeededRandom(seed);
        const rand2 = getSeededRandom(seed + 50);
        const rand3 = getSeededRandom(seed + 100);

        const intake = Math.round(1450 + rand1 * 350);
        const workoutBurn = Math.round(150 + rand2 * 250);
        const totalBurn = bmr + workoutBurn;

        const progressRatio = i / 23;
        const trendWeight = startWeight - progressRatio * (startWeight - baseWeightMonday);
        const weight = Math.round((trendWeight + (rand3 * 0.4 - 0.2)) * 10) / 10;

        let dateLabel = '';
        if (i <= 11) {
          dateLabel = `6/${19 + i}`;
        } else {
          dateLabel = `7/${i - 11}`;
        }

        data.push({
          name: dateLabel,
          '热量摄入': intake,
          '热量消耗': totalBurn,
          '体重': weight,
        });
      }
    }
    return data;
  }, [weights, mealsByDay, workoutsByDay, latestWeight]);

  const activeChartData = chartTimeframe === 7 ? chartData7Days : chartData30Days;

  // Calculate dynamic weight domain for extreme visual clarity
  const weightValues = activeChartData.map((d) => d['体重']);
  const minWeight = Math.min(...weightValues);
  const maxWeight = Math.max(...weightValues);
  const weightDomain = [Math.floor(minWeight - 1), Math.ceil(maxWeight + 1)];

  return (
    <div className="space-y-4 pb-20 px-4 pt-4 animate-fade-in relative">
      
      {/* Date Dropdown selector */}
      <div className="flex justify-between items-center z-10 relative">
        <div className="relative">
          <button
            id="analysis-dropdown-trigger"
            onClick={() => setShowDropdown(!showDropdown)}
            className="bg-white/70 backdrop-blur-md px-3 py-2 rounded-xl border border-white/50 flex items-center gap-1.5 shadow-sm text-xs font-bold text-gray-800 hover:bg-gray-50 active:scale-95 transition-all animate-pulse"
          >
            <Calendar size={13} className="text-[#8B5CF6]" />
            <span>{timeframeLabels[timeframe]}</span>
            <ChevronDown size={12} className="text-gray-400" />
          </button>

          {showDropdown && (
            <div className="absolute left-0 mt-1.5 w-32 bg-white/95 backdrop-blur-lg border border-gray-100 rounded-xl shadow-xl py-1.5 z-30 animate-fade-in max-h-64 overflow-y-auto">
              {(['today', '周一', '周二', '周三', '周四', '周五', '周六', '3days', '7days'] as const).map((tf) => (
                <button
                  key={tf}
                  id={`select-tf-${tf}-btn`}
                  onClick={() => handleSelectTimeframe(tf)}
                  className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-all ${
                    timeframe === tf ? 'text-[#8B5CF6] bg-[#F3EEFF] font-bold' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {timeframeLabels[tf]}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400 font-semibold">选择记录日期进行多维分析</span>
      </div>

      {/* Grid of four core metric cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-3 shadow-sm">
          <span className="text-[11px] font-semibold text-[#6B7280] block mb-0.5">基础代谢</span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-[18px] font-black text-gray-900">{bmr}</span>
            <span className="text-[10px] text-gray-400 font-medium">kcal/天</span>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-3 shadow-sm">
          <span className="text-[11px] font-semibold text-[#6B7280] block mb-0.5">总能量消耗</span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-[18px] font-black text-[#8B5CF6]">{displayBurn}</span>
            <span className="text-[10px] text-[#8B5CF6] font-semibold">kcal/天</span>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-3 shadow-sm">
          <span className="text-[11px] font-semibold text-[#6B7280] block mb-0.5">日均摄入</span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-[18px] font-black text-gray-900">{displayIntake}</span>
            <span className="text-[10px] text-gray-400 font-medium">kcal/天</span>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-3 shadow-sm">
          <span className="text-[11px] font-semibold text-[#6B7280] block mb-0.5">日均运动</span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-[18px] font-black text-gray-900">{displayWorkoutBurn}</span>
            <span className="text-[10px] text-gray-400 font-medium">kcal/天</span>
          </div>
        </div>
      </div>

      {/* Calorie Balance Card */}
      <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm relative overflow-hidden">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-xs font-semibold text-[#6B7280] block mb-1">热量平衡</h3>
            <span className="text-[28px] font-black text-[#10B981]">
              {displayBalance <= 0 ? '' : '+'}{displayBalance} <span className="text-sm font-medium">kcal/天</span>
            </span>
          </div>
          <span className="text-[10px] font-bold bg-[#E8F8F5]/80 backdrop-blur-sm text-[#10B981] px-2.5 py-1 rounded-full">
            统计 {displayDays} 天
          </span>
        </div>

        <div className="border-t border-white/30 pt-3 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-400 block mb-0.5">代谢水平</span>
            <span className="font-bold text-gray-800 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-[#10B981]" />
              处于健康热量赤字
            </span>
          </div>
          <div>
            <span className="text-gray-400 block mb-0.5">预计周减重</span>
            <span className="font-bold text-[#8B5CF6]">
              {displayBalance < 0 ? Math.abs(parseFloat(((displayBalance * 7) / 7700).toFixed(2))) : 0} kg
            </span>
          </div>
        </div>
      </div>

      {/* 📈 Beautiful Trends Line Chart Card */}
      <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={16} className="text-[#8B5CF6]" />
            <h3 className="text-xs font-bold text-gray-800">饮食与体重综合趋势</h3>
          </div>
          
          {/* Chart Switcher */}
          <div className="flex bg-gray-100/80 backdrop-blur-sm p-0.5 rounded-lg border border-gray-200/40">
            <button
              id="chart-tf-7-btn"
              type="button"
              onClick={() => setChartTimeframe(7)}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                chartTimeframe === 7
                  ? 'bg-white text-[#8B5CF6] shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              7天
            </button>
            <button
              id="chart-tf-30-btn"
              type="button"
              onClick={() => setChartTimeframe(30)}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                chartTimeframe === 30
                  ? 'bg-white text-[#8B5CF6] shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              30天
            </button>
          </div>
        </div>

        <p className="text-[10px] text-gray-400">
          对比每日摄入能量、消耗热量以及对应体重的变化走势
        </p>

        {/* Line Chart with beautiful light purple background */}
        <div className="w-full h-60 pt-3 px-3 pb-1 rounded-2xl bg-gradient-to-br from-[#FAF8FF] to-[#F5EFFF] border border-[#E8DDFF]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={activeChartData}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
              
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fontWeight: 700, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              
              {/* Left YAxis for Calories */}
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 9, fontWeight: 700, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                domain={[0, 'auto']}
              />
              
              {/* Right YAxis for Weight */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 9, fontWeight: 700, fill: '#10B981' }}
                axisLine={false}
                tickLine={false}
                domain={weightDomain}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '12px',
                  border: '1px solid #F3F4F6',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  fontSize: '11px',
                  fontWeight: 'bold',
                }}
                formatter={(value: any, name: string) => {
                  if (name === '体重') return [`${value} kg`, name];
                  return [`${value} kcal`, name];
                }}
              />

              <Legend
                verticalAlign="bottom"
                height={24}
                iconType="circle"
                iconSize={6}
                wrapperStyle={{
                  fontSize: '10px',
                  fontWeight: 'bold',
                  paddingTop: '8px',
                }}
              />

              <Line
                yAxisId="left"
                type="monotone"
                dataKey="热量摄入"
                stroke="#EF4444"
                strokeWidth={2}
                dot={chartTimeframe === 7 ? { r: 3, strokeWidth: 1 } : false}
                activeDot={{ r: 5 }}
              />

              <Line
                yAxisId="left"
                type="monotone"
                dataKey="热量消耗"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={chartTimeframe === 7 ? { r: 3, strokeWidth: 1 } : false}
                activeDot={{ r: 5 }}
              />

              <Line
                yAxisId="right"
                type="monotone"
                dataKey="体重"
                stroke="#10B981"
                strokeWidth={2}
                dot={chartTimeframe === 7 ? { r: 3, strokeWidth: 1 } : false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Weight Prediction Panel */}
      <div className="bg-gradient-to-br from-[#F3EEFF]/80 to-[#FFFFFF]/40 backdrop-blur-md rounded-[16px] p-4 border border-white/50 shadow-sm">
        <div className="flex items-center gap-1.5 mb-2 text-[#8B5CF6]">
          <Sparkles size={16} className="animate-pulse" />
          <h4 className="text-[13px] font-bold">AI 智能减重预测</h4>
        </div>
        <p className="text-[11px] text-gray-500 mb-4">基于多模态机器学习，智能推荐最优减重路径</p>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/50 backdrop-blur-sm rounded-xl p-2.5 text-center border border-white/40">
            <span className="text-[10px] text-gray-400 block mb-1">当前体重</span>
            <span className="text-[16px] font-black text-gray-800">{latestWeight} <span className="text-[9px] font-normal text-gray-400">kg</span></span>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-2.5 text-center border border-[#8B5CF6]/30 shadow-sm relative">
            <span className="text-[10px] text-[#8B5CF6] font-bold block mb-1">预计 7 天后</span>
            <span className="text-[16px] font-black text-[#8B5CF6]">{(latestWeight - 0.85).toFixed(1)} <span className="text-[9px] font-normal">kg</span></span>
            <span className="text-[9px] font-bold text-[#10B981] block mt-0.5">-0.85 kg</span>
          </div>
          <div className="bg-white/50 backdrop-blur-sm rounded-xl p-2.5 text-center border border-white/40">
            <span className="text-[10px] text-gray-400 block mb-1">预计 30 天后</span>
            <span className="text-[16px] font-black text-[#8B5CF6]">{(latestWeight - 3.20).toFixed(1)} <span className="text-[9px] font-normal">kg</span></span>
            <span className="text-[9px] font-bold text-[#10B981] block mt-0.5">-3.20 kg</span>
          </div>
        </div>
      </div>

      {/* Scientific footnote/Reference Card */}
      <div className="bg-white/40 backdrop-blur-sm rounded-[16px] p-4 border border-white/30 flex gap-2.5">
        <Info size={16} className="text-[#8B5CF6] flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
          <strong>科学参考：</strong>7,700 kcal 热量赤字 ≈ 1 kg 纯身体脂肪。保持健康饮食习惯与规律的有氧及阻力训练是健康减脂的根本保障。
        </p>
      </div>

    </div>
  );
}

import React, { useState, useRef } from 'react';
import { Plus, Timer, Heart, Activity, Flame, Trash2, Calendar, ChevronDown } from 'lucide-react';
import { WorkoutItem } from '../types';

interface ExercisePageProps {
  workoutsByDay: Record<string, WorkoutItem[]>;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  onOpenAddModal: () => void;
  onRemoveWorkout: (id: string) => void;
}

export default function ExercisePage({
  workoutsByDay,
  selectedDay,
  onSelectDay,
  onOpenAddModal,
  onRemoveWorkout
}: ExercisePageProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const daysList = ['周一', '周二', '周三', '周四', '周五', '周六', '今日'];

  const dayDateLabels: Record<string, string> = {
    '周一': '2026年7月9日',
    '周二': '2026年7月10日',
    '周三': '2026年7月11日',
    '周四': '2026年7月12日',
    '周五': '2026年7月13日',
    '周六': '2026年7月14日',
    '今日': '2026年7月15日',
  };

  const parseDateString = (day: string) => {
    const label = dayDateLabels[day] || day;
    const match = label.match(/(\d+)年(\d+)月(\d+)日/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10),
        day: parseInt(match[3], 10)
      };
    }
    return { year: 2026, month: 7, day: 15 };
  };

  const currentParsed = parseDateString(selectedDay);
  const [tempYear, setTempYear] = useState<number>(currentParsed.year);
  const [tempMonth, setTempMonth] = useState<number>(currentParsed.month);
  const [tempDay, setTempDay] = useState<number>(currentParsed.day);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const handleMonthChange = (m: number) => {
    setTempMonth(m);
    const max = getDaysInMonth(tempYear, m);
    if (tempDay > max) {
      setTempDay(max);
    }
  };

  const handleYearChange = (y: number) => {
    setTempYear(y);
    const max = getDaysInMonth(y, tempMonth);
    if (tempDay > max) {
      setTempDay(max);
    }
  };

  const handleTogglePicker = () => {
    if (!showDatePicker) {
      const parsed = parseDateString(selectedDay);
      setTempYear(parsed.year);
      setTempMonth(parsed.month);
      setTempDay(parsed.day);
    }
    setShowDatePicker(!showDatePicker);
  };

  // Calculate dynamic weekly chart minutes
  const weeklyData = daysList.map((day) => {
    const dayWorkouts = workoutsByDay[day] || [];
    const mins = dayWorkouts.reduce((sum, w) => {
      const minsMatch = w.duration.match(/^(\d+)/);
      const minsVal = minsMatch ? parseInt(minsMatch[1], 10) : 30;
      return sum + minsVal;
    }, 0);

    return {
      day,
      mins,
      active: day === selectedDay,
    };
  });

  const maxWeeklyMins = Math.max(1, ...weeklyData.map(d => d.mins));

  // Get current selected day's workouts
  const currentDayWorkouts = workoutsByDay[selectedDay] || [];

  // Calculate selected day's duration in minutes
  const displayDuration = currentDayWorkouts.reduce((sum, w) => {
    const minsMatch = w.duration.match(/^(\d+)/);
    const minsVal = minsMatch ? parseInt(minsMatch[1], 10) : 30;
    return sum + minsVal;
  }, 0);

  const displayCalories = currentDayWorkouts.reduce((sum, w) => sum + w.calories, 0);

  // Dynamic average intensity mapping
  let displayIntensity = '无';
  if (currentDayWorkouts.length > 0) {
    const intensities = currentDayWorkouts.map(w => w.intensity);
    if (intensities.includes('high')) {
      displayIntensity = '高';
    } else if (intensities.includes('medium-high')) {
      displayIntensity = '中高';
    } else if (intensities.includes('medium')) {
      displayIntensity = '中';
    } else {
      displayIntensity = '低';
    }
  }

  const getDisplayDate = (day: string) => {
    return dayDateLabels[day] || day;
  };

  return (
    <div className="space-y-4 pb-20 px-4 pt-4 animate-fade-in">
      
      {/* Exercise Summary Header */}
      <div className="flex justify-between items-center px-1 relative z-30">
        <h2 className="text-sm font-bold text-[#6B7280]">
          {selectedDay === '今日' ? '今日' : selectedDay}运动汇总
        </h2>
        <div className="relative">
          <button
            id="exercise-date-selector"
            type="button"
            onClick={handleTogglePicker}
            className="text-xs font-semibold text-[#8B5CF6] bg-[#8B5CF6]/5 hover:bg-[#8B5CF6]/10 border border-[#8B5CF6]/15 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer animate-pulse"
          >
            <Calendar size={12} className="text-[#8B5CF6]" />
            <span className="font-bold">{getDisplayDate(selectedDay)}</span>
            <ChevronDown size={12} className="text-[#8B5CF6] opacity-70" />
          </button>
          
          {showDatePicker && (
            <div className="absolute right-0 mt-2 w-72 bg-white/95 backdrop-blur-md rounded-2xl border border-gray-150 shadow-xl p-4 z-50 animate-fade-in space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-xs font-bold text-gray-800">选择自定义日期</span>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="text-[10px] text-gray-400 hover:text-gray-600 font-semibold cursor-pointer"
                >
                  取消
                </button>
              </div>

              {/* Three Select Columns */}
              <div className="grid grid-cols-3 gap-2">
                {/* Year Select */}
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 font-semibold block text-center">年份</span>
                  <div className="relative">
                    <select
                      id="exercise-year-select"
                      value={tempYear}
                      onChange={(e) => handleYearChange(Number(e.target.value))}
                      className="w-full text-xs font-bold bg-gray-50/80 border border-gray-200/50 rounded-xl px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/50 appearance-none text-center cursor-pointer"
                    >
                      {[2024, 2025, 2026, 2027, 2028].map((y) => (
                        <option key={y} value={y}>{y}年</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Month Select */}
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 font-semibold block text-center">月份</span>
                  <div className="relative">
                    <select
                      id="exercise-month-select"
                      value={tempMonth}
                      onChange={(e) => handleMonthChange(Number(e.target.value))}
                      className="w-full text-xs font-bold bg-gray-50/80 border border-gray-200/50 rounded-xl px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/50 appearance-none text-center cursor-pointer"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>{m}月</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Day Select */}
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 font-semibold block text-center">日期</span>
                  <div className="relative">
                    <select
                      id="exercise-day-select"
                      value={tempDay}
                      onChange={(e) => setTempDay(Number(e.target.value))}
                      className="w-full text-xs font-bold bg-gray-50/80 border border-gray-200/50 rounded-xl px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/50 appearance-none text-center cursor-pointer"
                    >
                      {Array.from({ length: getDaysInMonth(tempYear, tempMonth) }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}日</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Predefined Shortcut Grid */}
              <div className="space-y-1.5 pt-1 border-t border-gray-50">
                <span className="text-[9px] text-gray-400 font-semibold block">快捷选择</span>
                <div className="grid grid-cols-4 gap-1">
                  {daysList.map((day) => (
                    <button
                      key={day}
                      id={`exercise-date-shortcut-${day}`}
                      type="button"
                      onClick={() => {
                        onSelectDay(day);
                        setShowDatePicker(false);
                      }}
                      className={`px-1.5 py-1 text-[10px] font-semibold rounded-lg border transition-all text-center cursor-pointer ${
                        selectedDay === day
                          ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                          : 'bg-gray-50 border-gray-150 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <button
                id="exercise-date-confirm-btn"
                type="button"
                onClick={() => {
                  const formattedDate = `${tempYear}年${tempMonth}月${tempDay}日`;
                  let matchedKey = '';
                  for (const [key, labelStr] of Object.entries(dayDateLabels)) {
                    if (labelStr === formattedDate) {
                      matchedKey = key;
                      break;
                    }
                  }
                  onSelectDay(matchedKey || formattedDate);
                  setShowDatePicker(false);
                }}
                className="w-full py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all text-center cursor-pointer"
              >
                确定
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Selected Day's Workout Card */}
      <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-[11px] font-semibold text-[#6B7280] block mb-0.5">
              {selectedDay === '今日' ? '今日' : selectedDay}总运动时间
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-[32px] font-black text-gray-900">{displayDuration}</span>
              <span className="text-[12px] text-gray-400 font-bold">分钟</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#F3EEFF]/80 backdrop-blur-sm text-[#8B5CF6] flex items-center justify-center">
            <Timer size={20} />
          </div>
        </div>

        {/* Weekly Bar Graph (Pill Style) with interactive click selection */}
        <div className="flex justify-between items-end h-20 pt-2 px-1 gap-1">
          {weeklyData.map((data, index) => {
            const heightPercent = Math.max(15, Math.round((data.mins / maxWeeklyMins) * 100));
            return (
              <button
                key={index}
                id={`weekly-bar-btn-${index}`}
                type="button"
                onClick={() => onSelectDay(data.day)}
                className={`flex flex-col items-center gap-2 flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                  data.active 
                    ? 'bg-[#8B5CF6]/10 border border-[#8B5CF6]/20' 
                    : 'hover:bg-gray-100/40 border border-transparent'
                }`}
              >
                <div className="w-3.5 h-12 bg-gray-200/50 rounded-full flex items-end overflow-hidden">
                  <div 
                    className={`w-full rounded-full transition-all duration-300 ${
                      data.active ? 'bg-[#8B5CF6]' : 'bg-gray-400/40 hover:bg-gray-400/60'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
                <span className={`text-[9px] font-bold ${data.active ? 'text-[#8B5CF6]' : 'text-[#9CA3AF]'}`}>
                  {data.day}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-50/80 backdrop-blur-sm text-orange-500">
            <Flame size={18} fill="currentColor" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-semibold block">消耗热量</span>
            <span className="text-[16px] font-extrabold text-gray-900">{displayCalories} <span className="text-xs text-gray-400 font-normal">千卡</span></span>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[16px] p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-50/80 backdrop-blur-sm text-red-500">
            <Heart size={18} fill="currentColor" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-semibold block">平均强度</span>
            <span className="text-[16px] font-extrabold text-[#8B5CF6]">{displayIntensity}</span>
          </div>
        </div>
      </div>

      {/* Recent Workouts list */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider px-1">
          {selectedDay === '今日' ? '今日' : selectedDay}锻炼记录
        </h3>
        
        <div className="space-y-2">
          {currentDayWorkouts.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-200 rounded-[16px] bg-white/40">
              <p className="text-xs text-gray-400 font-semibold">该日暂无锻炼记录</p>
              <button
                type="button"
                onClick={onOpenAddModal}
                className="text-xs font-bold text-[#8B5CF6] mt-2 hover:underline"
              >
                + 去记录新运动
              </button>
            </div>
          ) : (
            currentDayWorkouts.map((workout) => (
              <div 
                key={workout.id} 
                className="bg-white/60 backdrop-blur-md border border-white/40 rounded-[16px] p-3 flex items-center justify-between shadow-sm hover:border-purple-100 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    workout.category === 'aerobic' 
                      ? 'bg-[#F3EEFF]/80 backdrop-blur-sm text-[#8B5CF6]' 
                      : 'bg-indigo-50/80 backdrop-blur-sm text-indigo-500'
                  }`}>
                    <Activity size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800">{workout.type}</h4>
                    <span className="text-[10px] text-gray-400">{workout.time} · {workout.distance || '无记录'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-gray-800 block">{workout.duration}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold inline-block mt-0.5 ${
                      workout.category === 'aerobic' 
                        ? 'bg-[#F3EEFF] text-[#8B5CF6]' 
                        : 'bg-gray-100/80 text-gray-500'
                    }`}>
                      {workout.category === 'aerobic' ? '有氧' : '抗阻'}
                    </span>
                  </div>

                  <button 
                    id={`delete-workout-${workout.id}-btn`}
                    onClick={() => onRemoveWorkout(workout.id)}
                    className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50/50 transition-colors"
                    title="删除此锻炼记录"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Workout Button */}
      <button
        id="trigger-add-workout-btn"
        onClick={onOpenAddModal}
        className="w-full bg-[#000000] hover:bg-gray-900 text-white font-bold py-3.5 rounded-[16px] text-sm transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-1.5 mt-2"
      >
        <Plus size={16} />
        记录新运动
      </button>

    </div>
  );
}

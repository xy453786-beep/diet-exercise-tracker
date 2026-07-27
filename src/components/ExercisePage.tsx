import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import { Plus, Timer, Heart, Activity, Flame, Trash2, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { WorkoutItem } from '../types';

interface ExercisePageProps {
  workoutsByDay: Record<string, WorkoutItem[]>;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  onOpenAddModal: () => void;
  onRemoveWorkout: (id: string) => void;
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;

/** Get Monday of the week containing the given date */
function getMonday(d: Date): Date {
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDateLabel(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Get the Chinese day label for a given date, or null if outside current week */
function dateToLabel(d: Date): string | null {
  const today = new Date();
  if (isSameDay(d, today)) return '今日';
  const monday = getMonday(today);
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    if (isSameDay(d, day)) return WEEKDAYS[i];
  }
  return null;
}

export default function ExercisePage({
  workoutsByDay,
  selectedDay,
  onSelectDay,
  onOpenAddModal,
  onRemoveWorkout
}: ExercisePageProps) {
  const today = useMemo(() => new Date(), []);
  const monday = useMemo(() => getMonday(today), [today]);

  // Build week: Monday → Sunday (7 days), today's entry uses "今日" label
  const weekDays = useMemo(() => {
    const days: { label: string; date: Date; dateStr: string; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isTodayDate = isSameDay(d, today);
      days.push({
        label: isTodayDate ? '今日' : WEEKDAYS[i],
        date: d,
        dateStr: formatDateLabel(d),
        isToday: isTodayDate,
      });
    }
    return days;
  }, [today, monday]);

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth() + 1);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Year-month bottom sheet picker state
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth() + 1);
  const yearListRef = useRef<HTMLDivElement>(null);
  const monthListRef = useRef<HTMLDivElement>(null);
  const YEAR_ITEMS = [2023, 2024, 2025, 2026];

  // Measured at runtime so alignment is exact regardless of actual rendered pixel sizes
  const yearLayout = useRef({ itemH: 36 });
  const monthLayout = useRef({ itemH: 36 });

  // Center the selected year/month when picker opens
  useLayoutEffect(() => {
    if (!showYearMonthPicker) return;

    // Year column: set padding dynamically so paddingTop = (containerH - itemH) / 2
    if (yearListRef.current) {
      const containerH = yearListRef.current.clientHeight;
      const firstItem = yearListRef.current.querySelector('.snap-center');
      if (firstItem) {
        const itemH = firstItem.clientHeight;
        const paddingTop = (containerH - itemH) / 2;
        yearLayout.current = { itemH };
        yearListRef.current.style.paddingTop = `${paddingTop}px`;
        yearListRef.current.style.paddingBottom = `${paddingTop}px`;

        const yearIndex = YEAR_ITEMS.indexOf(pickerYear);
        if (yearIndex >= 0) {
          // With paddingTop = (containerH - itemH)/2, offset = 0 → scrollTop = i * itemH
          yearListRef.current.scrollTop = yearIndex * itemH;
        }
      }
    }

    // Month column: same dynamic padding
    if (monthListRef.current) {
      const containerH = monthListRef.current.clientHeight;
      const firstItem = monthListRef.current.querySelector('.snap-center');
      if (firstItem) {
        const itemH = firstItem.clientHeight;
        const paddingTop = (containerH - itemH) / 2;
        monthLayout.current = { itemH };
        monthListRef.current.style.paddingTop = `${paddingTop}px`;
        monthListRef.current.style.paddingBottom = `${paddingTop}px`;

        const monthIndex = pickerMonth - 1;
        if (monthIndex >= 0) {
          monthListRef.current.scrollTop = monthIndex * itemH;
        }
      }
    }
  }, [showYearMonthPicker]);

  // Map selectedDay to a Date for comparison
  const selectedDate = useMemo(() => {
    if (selectedDay === '今日') return new Date(today);
    const idx = WEEKDAYS.indexOf(selectedDay as any);
    if (idx >= 0) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return d;
    }
    // Try parsing custom date string
    const m = selectedDay.match(/(\d+)年(\d+)月(\d+)日/);
    if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    return today;
  }, [selectedDay, today, monday]);

  // Month grid for calendar
  const monthGrid = useMemo(() => {
    const firstDay = new Date(calYear, calMonth - 1, 1);
    const lastDate = new Date(calYear, calMonth, 0).getDate();
    const startDayOfWeek = firstDay.getDay(); // 0=Sun
    const startOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Mon=0

    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= lastDate; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calYear, calMonth]);

  const handleCalendarSelect = (day: number) => {
    const picked = new Date(calYear, calMonth - 1, day);
    const label = dateToLabel(picked);
    if (label) {
      onSelectDay(label);
    } else {
      // Outside current week — use formatted date string
      onSelectDay(`${calYear}年${calMonth}月${day}日`);
    }
    setShowCalendar(false);
  };

  const toggleCalendar = () => {
    if (!showCalendar) {
      setCalYear(selectedDate.getFullYear());
      setCalMonth(selectedDate.getMonth() + 1);
    }
    setShowCalendar(prev => !prev);
  };

  // Calculate weekly chart minutes
  const daysList = weekDays.map(d => d.label);
  const weeklyData = daysList.map((day) => {
    const dayWorkouts = workoutsByDay[day] || [];
    const mins = dayWorkouts.reduce((sum, w) => {
      const minsMatch = w.duration.match(/^(\d+)/);
      return sum + (minsMatch ? parseInt(minsMatch[1], 10) : 30);
    }, 0);
    return { day, mins, active: day === selectedDay };
  });

  const maxWeeklyMins = Math.max(1, ...weeklyData.map(d => d.mins));
  const currentDayWorkouts = workoutsByDay[selectedDay] || [];

  const displayDuration = currentDayWorkouts.reduce((sum, w) => {
    const minsMatch = w.duration.match(/^(\d+)/);
    return sum + (minsMatch ? parseInt(minsMatch[1], 10) : 30);
  }, 0);

  const displayCalories = currentDayWorkouts.reduce((sum, w) => sum + w.calories, 0);

  let displayIntensity = '无';
  if (currentDayWorkouts.length > 0) {
    const intensities = currentDayWorkouts.map(w => w.intensity);
    if (intensities.includes('high')) displayIntensity = '高';
    else if (intensities.includes('medium-high')) displayIntensity = '中高';
    else if (intensities.includes('medium')) displayIntensity = '中';
    else displayIntensity = '低';
  }

  return (
    <div className="space-y-4 pb-20 px-4 pt-4 animate-fade-in">

      {/* ── Date Header Area (purple-tinted background) ── */}
      <div className="bg-gradient-to-b from-[#F9F7FF] to-[#F3EEFF] rounded-2xl p-4 relative">

        {/* Top row: left date + right label */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              setPickerYear(selectedDate.getFullYear());
              setPickerMonth(selectedDate.getMonth() + 1);
              setShowYearMonthPicker(true);
            }}
            className="flex items-center gap-1 text-[15px] font-bold text-gray-900 active:scale-95 transition-all"
          >
            {formatDateLabel(selectedDate)}
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          <span className="text-[10px] text-gray-400 font-medium bg-white/60 px-2.5 py-0.5 rounded-full">
            近7天
          </span>
        </div>

        {/* Weekday names row */}
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          {['一', '二', '三', '四', '五', '六', '日'].map((wd) => (
            <div key={wd} className="w-9 text-center text-[10px] font-semibold text-gray-400">
              {wd}
            </div>
          ))}
        </div>

        {/* Date numbers row */}
        <div className="flex items-center justify-between mb-2">
          {weekDays.map(({ label, date, isToday }) => {
            const isSelected = selectedDay === label;
            return (
              <button
                key={label}
                onClick={() => onSelectDay(label)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-extrabold transition-all active:scale-90 ${
                  isSelected
                    ? 'bg-[#8B5CF6] text-white shadow-sm shadow-[#8B5CF6]/30'
                    : isToday
                      ? 'text-[#8B5CF6]'
                      : 'text-gray-700 hover:bg-gray-200/50'
                }`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        {/* ▼ Dropdown handle (iOS-style drag indicator) */}
        <div className="flex justify-center">
          <button
            onClick={toggleCalendar}
            className="flex items-center justify-center transition-all active:scale-90 py-1"
          >
            <svg
              width="44" height="18" viewBox="0 0 44 18" fill="none"
              className={`text-gray-300 transition-transform duration-200 ${showCalendar ? 'rotate-180' : ''}`}
            >
              <path
                d="M6 6L22 16L38 6"
                stroke="currentColor"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* 📅 Calendar Popover */}
        {showCalendar && (
          <div
            ref={calendarRef}
            className="absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-lg rounded-2xl border border-gray-100 shadow-xl p-4 z-50 animate-fade-in"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-800">{calYear}年 {calMonth}月</span>
              <div className="flex items-center gap-1">
                <button onClick={() => { if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); } else setCalMonth(m => m - 1); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => { if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); } else setCalMonth(m => m + 1); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {['一', '二', '三', '四', '五', '六', '日'].map(wd => (
                <div key={wd} className="text-center text-[10px] font-bold text-gray-400 py-1">{wd}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthGrid.map((day, idx) => {
                if (day === null) return <div key={idx} />;
                const dateObj = new Date(calYear, calMonth - 1, day);
                const isTodayDate = isSameDay(dateObj, today);
                const isSelectedDate = isSameDay(dateObj, selectedDate);
                return (
                  <button key={idx} onClick={() => handleCalendarSelect(day)}
                    className={`w-full aspect-square flex items-center justify-center text-xs font-bold rounded-full transition-all active:scale-90 ${
                      isSelectedDate ? 'bg-[#8B5CF6] text-white shadow-sm'
                        : isTodayDate ? 'bg-[#F3EEFF] text-[#8B5CF6] border border-[#8B5CF6]/20'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}>
                    {day}
                  </button>
                );
              })}
            </div>
            <button onClick={() => { const lbl = dateToLabel(today); onSelectDay(lbl || '今日'); setShowCalendar(false); }}
              className="w-full mt-3 py-2 bg-[#F3EEFF] hover:bg-[#E8DCFF] text-[#8B5CF6] text-xs font-bold rounded-xl transition-all active:scale-[0.98]">
              回到今天
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom Sheet: Year-Month Picker ── */}
      {showYearMonthPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col justify-end" onClick={() => setShowYearMonthPicker(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-[390px] mx-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-400">选择年月</span>
              <button onClick={() => setShowYearMonthPicker(false)} className="text-xs text-gray-400 font-medium">取消</button>
            </div>

            {/* Scrollable columns */}
            <div className="flex gap-4 px-6 py-4 h-52">
              {/* Year column */}
              <div className="flex-1 relative">
                {/* Center indicator line */}
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-9 bg-[#8B5CF6]/10 rounded-lg pointer-events-none" />
                <div ref={yearListRef} className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-none"
                  onScroll={() => {
                    if (!yearListRef.current) return;
                    const { itemH } = yearLayout.current;
                    const index = Math.round(yearListRef.current.scrollTop / itemH);
                    if (index >= 0 && index < YEAR_ITEMS.length) setPickerYear(YEAR_ITEMS[index]);
                  }}
                >
                  {YEAR_ITEMS.map(y => (
                    <div key={y} className="h-9 snap-center flex items-center justify-center">
                      <span className={`text-sm ${y === pickerYear ? 'font-extrabold text-[#4C1D95]' : 'font-medium text-gray-400'}`}>
                        {y}年
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Month column */}
              <div className="flex-1 relative">
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-9 bg-[#8B5CF6]/10 rounded-lg pointer-events-none" />
                <div ref={monthListRef} className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-none"
                  onScroll={() => {
                    if (!monthListRef.current) return;
                    const { itemH } = monthLayout.current;
                    const index = Math.round(monthListRef.current.scrollTop / itemH);
                    if (index >= 0 && index <= 11) setPickerMonth(index + 1);
                  }}
                >
                  {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                    <div key={m} className="h-9 snap-center flex items-center justify-center">
                      <span className={`text-sm ${m === pickerMonth ? 'font-extrabold text-[#4C1D95]' : 'font-medium text-gray-400'}`}>
                        {m}月
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Confirm button */}
            <div className="px-6 pb-6 pt-2">
              <button
                onClick={() => {
                  // Update calYear/calMonth so the month grid and date display update
                  setCalYear(pickerYear);
                  setCalMonth(pickerMonth);
                  setShowYearMonthPicker(false);
                }}
                className="w-full py-3 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-sm rounded-xl active:scale-[0.98] transition-all shadow-md"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

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

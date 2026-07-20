import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PageType, MealRecord, WorkoutItem, WeightEntry, MealCategory, AIDietAnalysis } from './types';
import { INITIAL_WEIGHTS, INITIAL_MEALS_BY_DAY, INITIAL_WORKOUTS_BY_DAY, MOCK_AI_DIET_ANALYSIS } from './data';
import { useAuth } from './context/AuthContext';
import { dayLabelToDate, dateToDayLabel, getCurrentWeekRange } from './utils/dates';
import * as endpoints from './api/endpoints';
import LoginPage from './components/LoginPage';
import { Camera } from 'lucide-react';
import { analyzeFoodImage, getZhipuApiKey, type ZhipuFoodAnalysis } from './api/zhipu';

import Header from './components/Header';
import TabBar from './components/TabBar';
import ScannerModal from './components/ScannerModal';
import AddWorkoutModal from './components/AddWorkoutModal';
import AddFoodModal from './components/AddFoodModal';
import FoodMethodSelectorModal from './components/FoodMethodSelectorModal';
import AIScanEditModal from './components/AIScanEditModal';

import HomePage from './components/HomePage';
import DietPage from './components/DietPage';
import ExercisePage from './components/ExercisePage';
import AnalysisPage from './components/AnalysisPage';
import AIResultPage from './components/AIResultPage';

/**
 * Convert API responses (keyed by ISO date) to frontend format (keyed by day label).
 */
function mapDateKeysToLabels<T>(dataByDate: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [dateStr, value] of Object.entries(dataByDate)) {
    const label = dateToDayLabel(dateStr);
    result[label] = value;
  }
  return result;
}

export default function App() {
  // ---- Auth ----
  const { appUser: user, loading: authLoading, signOut, updateAppUser } = useAuth();

  // ---- Page Routing ----
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [selectedDay, setSelectedDay] = useState<string>('今日');

  // ---- Data State (starts with hardcoded data, replaced by API on load) ----
  const [mealsByDay, setMealsByDay] = useState<Record<string, MealRecord[]>>({});
  const [workoutsByDay, setWorkoutsByDay] = useState<Record<string, WorkoutItem[]>>({});
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [waterIntakes, setWaterIntakes] = useState<Record<string, number>>({});
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // ---- Derived user values ----
  const height = user?.height || 178;

  // ---- Modal States ----
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeAddFoodCategory, setActiveAddFoodCategory] = useState<MealCategory | null>(null);
  const [foodChoiceCategory, setFoodChoiceCategory] = useState<MealCategory | null>(null);
  const [isAddWorkoutOpen, setIsAddWorkoutOpen] = useState(false);

  // ---- AI States ----
  const [activeScanPresetIndex, setActiveScanPresetIndex] = useState<number | null>(null);
  const [capturedFoodImage, setCapturedFoodImage] = useState<string | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiAnalysis, setGeminiAnalysis] = useState<ZhipuFoodAnalysis | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [editingScanResult, setEditingScanResult] = useState<boolean>(false);
  const [currentAIAnalysisData, setCurrentAIAnalysisData] = useState<AIDietAnalysis>(MOCK_AI_DIET_ANALYSIS);

  // ---- Date Range ----
  const dateRange = useMemo(() => getCurrentWeekRange(), []);

  // ---- Load Data from API when user logs in ----
  const loadAllData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setDataError(null);
    try {
      const { from, to } = dateRange;

      const [mealsData, wourkoutsData, weightsData, waterData] = await Promise.all([
        endpoints.getMeals(from, to),
        endpoints.getWorkouts(from, to),
        endpoints.getWeights(from, to),
        endpoints.getWater(from, to),
      ]);

      // Convert ISO date keys to day labels
      const mealsWithLabels = mapDateKeysToLabels(mealsData);
      const workoutsWithLabels = mapDateKeysToLabels(wourkoutsData);

      // Merge with defaults: ensure every day has breakfast/lunch/dinner
      const mergedMeals: Record<string, MealRecord[]> = { ...INITIAL_MEALS_BY_DAY };
      for (const [label, records] of Object.entries(mealsWithLabels)) {
        if (records && records.length > 0) {
          const categories = new Set(records.map(r => r.category));
          const existing = mergedMeals[label] || [];
          // Keep API records, fill missing categories from defaults
          const defaults = INITIAL_MEALS_BY_DAY[label] || [];
          const merged: MealRecord[] = [...records];
          for (const d of defaults) {
            if (!categories.has(d.category)) {
              merged.push(d);
            }
          }
          mergedMeals[label] = merged;
        }
      }

      const mergedWorkouts: Record<string, WorkoutItem[]> = { ...INITIAL_WORKOUTS_BY_DAY };
      for (const [label, items] of Object.entries(workoutsWithLabels)) {
        if (items && items.length > 0) {
          mergedWorkouts[label] = items;
        }
      }

      // Convert weights to WeightEntry format
      const weightLabels = weightsData.map((w) => ({
        day: dateToDayLabel(w.day),
        weight: w.weight,
      }));

      // Merge with default weekly weights
      const mergedWeights = INITIAL_WEIGHTS.map((iw) => {
        const fromApi = weightLabels.find((aw) => aw.day === iw.day);
        return fromApi ? { ...iw, weight: fromApi.weight } : iw;
      });

      // If user has a weight, update the last entry
      if (user.weight) {
        const last = mergedWeights[mergedWeights.length - 1];
        if (last) mergedWeights[mergedWeights.length - 1] = { ...last, weight: user.weight };
      }

      // Convert water data keys
      const waterWithLabels: Record<string, number> = {};
      for (const [dateStr, ml] of Object.entries(waterData)) {
        waterWithLabels[dateToDayLabel(dateStr)] = ml;
      }

      setMealsByDay(mergedMeals);
      setWorkoutsByDay(mergedWorkouts);
      setWeights(mergedWeights);
      setWaterIntakes((prev) => ({ ...prev, ...waterWithLabels }));
    } catch (err) {
      console.error('Failed to load data:', err);
      setDataError('数据加载失败，使用本地缓存数据');
      // Fall back to hardcoded data
      setMealsByDay(INITIAL_MEALS_BY_DAY);
      setWorkoutsByDay(INITIAL_WORKOUTS_BY_DAY);
      setWeights(INITIAL_WEIGHTS);
    } finally {
      setDataLoading(false);
    }
  }, [user, dateRange]);

  useEffect(() => {
    if (user) {
      loadAllData();
      // Reset to home page after login (handleLogout sets it to 'login')
      if (currentPage === 'login') {
        setCurrentPage('home');
      }
    }
  }, [user, loadAllData]);

  // ---- Handlers (API-backed) ----

  const handleLogout = async () => {
    await signOut();
    setCurrentPage('login');
  };

  const handleUpdateHeight = async (newHeight: number) => {
    await updateAppUser({ height: newHeight });
  };

  const handleUpdateLatestWeight = async (newWeight: number) => {
    const date = dayLabelToDate(selectedDay);
    try {
      await endpoints.upsertWeight(date, newWeight);
      setWeights((prev) =>
        prev.map((w) =>
          w.day === selectedDay ? { ...w, weight: newWeight } : w
        )
      );
    } catch (err) {
      // Optimistic update even on failure
      setWeights((prev) =>
        prev.map((w) =>
          w.day === selectedDay ? { ...w, weight: newWeight } : w
        )
      );
    }
  };

  const handleAddWater = async () => {
    const date = dayLabelToDate(selectedDay);
    try {
      await endpoints.setWater(date, 250, 'add');
    } catch { /* continue */ }
    setWaterIntakes((prev) => ({
      ...prev,
      [selectedDay]: Math.min(4000, (prev[selectedDay] ?? 0) + 250),
    }));
  };

  const handleSubtractWater = async () => {
    const date = dayLabelToDate(selectedDay);
    const newAmount = Math.max(0, (waterIntakes[selectedDay] ?? 0) - 250);
    try {
      await endpoints.setWater(date, newAmount, 'set');
    } catch { /* continue */ }
    setWaterIntakes((prev) => ({
      ...prev,
      [selectedDay]: newAmount,
    }));
  };

  const handleAddFoodItem = async (category: MealCategory, item: any) => {
    const date = dayLabelToDate(selectedDay);
    try {
      const created = await endpoints.addMealItem(date, category, item);
      // Use the server-returned item
      const finalItem = { ...item, id: created.id || item.id };
      setMealsByDay((prev) => {
        const dayMeals = prev[selectedDay] || [
          { category: 'breakfast', name: '早餐', icon: '🌅', items: [] },
          { category: 'lunch', name: '午餐', icon: '☀️', items: [] },
          { category: 'dinner', name: '晚餐', icon: '🌙', items: [] },
        ];
        return {
          ...prev,
          [selectedDay]: dayMeals.map((meal) =>
            meal.category === category
              ? { ...meal, items: [...meal.items, finalItem] }
              : meal
          ),
        };
      });
    } catch (err) {
      console.error('Failed to add food item:', err);
      // Fallback: add locally anyway
      setMealsByDay((prev) => {
        const dayMeals = prev[selectedDay] || [
          { category: 'breakfast', name: '早餐', icon: '🌅', items: [] },
          { category: 'lunch', name: '午餐', icon: '☀️', items: [] },
          { category: 'dinner', name: '晚餐', icon: '🌙', items: [] },
        ];
        return {
          ...prev,
          [selectedDay]: dayMeals.map((meal) =>
            meal.category === category
              ? { ...meal, items: [...meal.items, item] }
              : meal
          ),
        };
      });
    }
  };

  const handleRemoveFoodItem = (category: MealCategory, itemId: string) => {
    // Optimistic: remove from UI immediately, delete in background
    setMealsByDay((prev) => {
      const dayMeals = prev[selectedDay] || [];
      return {
        ...prev,
        [selectedDay]: dayMeals.map((meal) =>
          meal.category === category
            ? { ...meal, items: meal.items.filter((item) => item.id !== itemId) }
            : meal
        ),
      };
    });
    // Fire-and-forget: API runs in background
    endpoints.deleteMealItem(itemId).catch((err) => {
      console.error('Failed to delete food item:', err);
    });
  };

  const handleAddWorkout = async (workout: WorkoutItem) => {
    const date = dayLabelToDate(selectedDay);
    try {
      await endpoints.addWorkout(date, workout);
    } catch (err) {
      console.error('Failed to add workout:', err);
    }
    setWorkoutsByDay((prev) => {
      const dayWorkouts = prev[selectedDay] || [];
      return {
        ...prev,
        [selectedDay]: [workout, ...dayWorkouts],
      };
    });

    if (workout.calories > 250) {
      setWeights((prev) =>
        prev.map((w) =>
          w.day === selectedDay
            ? { ...w, weight: parseFloat((w.weight - 0.1).toFixed(1)) }
            : w
        )
      );
    }
  };

  const handleRemoveWorkout = async (id: string) => {
    try {
      await endpoints.deleteWorkout(id);
    } catch (err) {
      console.error('Failed to delete workout:', err);
    }
    setWorkoutsByDay((prev) => {
      const dayWorkouts = prev[selectedDay] || [];
      return {
        ...prev,
        [selectedDay]: dayWorkouts.filter((w) => w.id !== id),
      };
    });
  };

  // ---- AI Handlers ----
  const handleScanComplete = async (imageDataUrl: string) => {
    setIsScannerOpen(false);
    setCapturedFoodImage(imageDataUrl);
    setGeminiError(null);

    const apiKey = getZhipuApiKey();
    if (!apiKey) {
      // No API key configured, fall back to preset data
      console.warn('VITE_ZHIPU_API_KEY 未配置，使用默认数据');
      setGeminiError('未配置智谱 API Key（缺少 VITE_ZHIPU_API_KEY 环境变量）');
      setActiveScanPresetIndex(0);
      setEditingScanResult(true);
      return;
    }

    // Call 智谱 GLM-4V
    setGeminiLoading(true);
    try {
      const analysis = await analyzeFoodImage(imageDataUrl, apiKey);
      setGeminiAnalysis(analysis);
      setActiveScanPresetIndex(-1); // Signal: use AI data
      setEditingScanResult(true);
    } catch (err: any) {
      console.error('智谱 AI 分析失败:', err);
      setGeminiError(err.message || 'AI 分析失败');
      setActiveScanPresetIndex(0);
      setEditingScanResult(true);
    } finally {
      setGeminiLoading(false);
    }
  };

  const handleConfirmScanEdit = (finalAnalysis: AIDietAnalysis) => {
    setCurrentAIAnalysisData(finalAnalysis);
    setEditingScanResult(false);
    setActiveScanPresetIndex(null);
    setCurrentPage('ai-result');
  };

  const handleSaveAIMeal = async (category: MealCategory, item: any) => {
    // Navigate immediately so user sees diet page right away
    setActiveAddFoodCategory(null);
    setCurrentPage('diet');
    // Save in background
    await handleAddFoodItem(category, item);
  };

  // ---- Header Title ----
  const getHeaderTitle = (page: PageType) => {
    switch (page) {
      case 'home': return '首页';
      case 'diet': return '饮食记录';
      case 'exercise': return '运动记录';
      case 'analysis': return '数据分析';
      case 'ai-result': return 'AI 饮食分析报告';
      default: return '健康追踪';
    }
  };

  // ---- Show login page if not authenticated (auth still loading) ----
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF5FF]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-[#8B5CF6]">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-0 sm:p-4 font-sans select-none antialiased overflow-hidden">
      {/* Background Ambient Glowing Orbs */}
      <div className="ambient-orb w-[350px] h-[350px] bg-purple-300/60 top-1/4 left-10 md:left-[20%] animate-pulse-slow" />
      <div className="ambient-orb w-[300px] h-[300px] bg-pink-200/50 bottom-1/4 right-10 md:right-[20%]" style={{ animationDelay: '1.5s' }} />
      <div className="ambient-orb w-[200px] h-[200px] bg-blue-200/40 top-10 right-1/3" style={{ animationDelay: '3s' }} />

      {/* Centered Mobile Viewport */}
      <div
        id="mobile-viewport"
        className="w-full sm:w-[360px] md:w-[375px] max-w-[390px] sm:h-[740px] md:h-[760px] max-h-full h-screen glass-panel sm:rounded-[40px] sm:shadow-[0_32px_64px_rgba(139,92,246,0.18)] border-0 sm:border-4 sm:border-white/50 flex flex-col relative overflow-hidden transition-all duration-300"
      >
        {user ? (
          <>
            {/* Persistent Header */}
            <Header
              title={getHeaderTitle(currentPage)}
              avatarUrl={user.avatarUrl}
              username={user.username}
              onLogout={handleLogout}
            />

            {/* Data loading indicator */}
            {dataLoading && (
              <div className="absolute top-14 left-0 right-0 z-30 flex justify-center">
                <div className="bg-[#8B5CF6]/90 text-white text-[10px] font-bold px-3 py-1 rounded-b-xl shadow-md animate-pulse">
                  同步数据中...
                </div>
              </div>
            )}

            {/* Data error banner */}
            {dataError && (
              <div className="absolute top-14 left-0 right-0 z-30 flex justify-center">
                <div className="bg-amber-500/90 text-white text-[10px] font-bold px-3 py-1 rounded-b-xl shadow-md">
                  {dataError}
                </div>
              </div>
            )}

            {/* Scrollable Screen Body */}
            <main className="flex-1 overflow-y-auto pb-20 relative scrollbar-none text-left">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPage}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="h-full"
                >
                  {currentPage === 'home' && (
                    <HomePage
                      weights={weights}
                      meals={mealsByDay[selectedDay] || []}
                      workouts={workoutsByDay[selectedDay] || []}
                      waterIntake={waterIntakes[selectedDay] ?? 0}
                      onAddWater={handleAddWater}
                      onSubtractWater={handleSubtractWater}
                      onNavigateToAI={() => setCurrentPage('ai-result')}
                      height={height}
                      onUpdateHeight={handleUpdateHeight}
                      onUpdateLatestWeight={handleUpdateLatestWeight}
                      selectedDay={selectedDay}
                      onSelectDay={setSelectedDay}
                    />
                  )}

                  {currentPage === 'diet' && (
                    <DietPage
                      meals={mealsByDay[selectedDay] || []}
                      onRemoveItem={handleRemoveFoodItem}
                      onOpenScanner={(category) => {
                        setFoodChoiceCategory(category || 'lunch');
                      }}
                    />
                  )}

                  {currentPage === 'exercise' && (
                    <ExercisePage
                      workoutsByDay={workoutsByDay}
                      selectedDay={selectedDay}
                      onSelectDay={setSelectedDay}
                      onOpenAddModal={() => setIsAddWorkoutOpen(true)}
                      onRemoveWorkout={handleRemoveWorkout}
                    />
                  )}

                  {currentPage === 'analysis' && (
                    <AnalysisPage
                      weights={weights}
                      mealsByDay={mealsByDay}
                      workoutsByDay={workoutsByDay}
                      selectedDay={selectedDay}
                    />
                  )}

                  {currentPage === 'ai-result' && (
                    <AIResultPage
                      analysisData={currentAIAnalysisData}
                      defaultCategory={activeAddFoodCategory || 'lunch'}
                      onSaveToLog={handleSaveAIMeal}
                      onBack={() => {
                        setActiveAddFoodCategory(null);
                        setCurrentPage('diet');
                      }}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Floating Camera FAB */}
            {currentPage === 'diet' && (
              <button
                id="camera-scanner-fab"
                onClick={() => setFoodChoiceCategory('lunch')}
                className="absolute bottom-20 right-5 w-14 h-14 rounded-full bg-black text-white hover:bg-gray-900 flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 z-30 border border-white/10"
                title="AI 拍照扫描食物"
              >
                <Camera size={24} />
              </button>
            )}

            {/* Tab Bar */}
            <TabBar currentPage={currentPage} onPageChange={(page) => setCurrentPage(page)} />
          </>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-none">
            <LoginPage />
          </div>
        )}

        {/* Overlay Modals */}
        {user && (
          <>
            <FoodMethodSelectorModal
              isOpen={foodChoiceCategory !== null}
              category={foodChoiceCategory}
              onClose={() => setFoodChoiceCategory(null)}
              onSelectAI={() => {
                const cat = foodChoiceCategory;
                setFoodChoiceCategory(null);
                setActiveAddFoodCategory(cat);
                setIsScannerOpen(true);
              }}
              onSelectManual={() => {
                const cat = foodChoiceCategory;
                setFoodChoiceCategory(null);
                setActiveAddFoodCategory(cat);
              }}
            />

            <AddFoodModal
              isOpen={activeAddFoodCategory !== null && !isScannerOpen && !geminiLoading && !editingScanResult && currentPage === 'diet'}
              category={activeAddFoodCategory}
              onClose={() => setActiveAddFoodCategory(null)}
              onAdd={handleAddFoodItem}
            />

            <ScannerModal
              isOpen={isScannerOpen}
              onClose={() => {
                setIsScannerOpen(false);
                setActiveAddFoodCategory(null);
              }}
              onCapture={handleScanComplete}
            />

            <AIScanEditModal
              isOpen={geminiLoading || (editingScanResult && activeScanPresetIndex !== null)}
              presetIndex={activeScanPresetIndex ?? 0}
              category={activeAddFoodCategory || 'lunch'}
              capturedImage={capturedFoodImage}
              geminiAnalysis={geminiAnalysis}
              geminiLoading={geminiLoading}
              geminiError={geminiError}
              onClose={() => {
                setEditingScanResult(false);
                setActiveScanPresetIndex(null);
                setCapturedFoodImage(null);
                setGeminiAnalysis(null);
                setGeminiError(null);
                setActiveAddFoodCategory(null);
              }}
              onConfirm={handleConfirmScanEdit}
            />

            <AddWorkoutModal
              isOpen={isAddWorkoutOpen}
              onClose={() => setIsAddWorkoutOpen(false)}
              onAdd={handleAddWorkout}
            />
          </>
        )}
      </div>
    </div>
  );
}

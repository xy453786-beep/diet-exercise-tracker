import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronRight, Check, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ActivityLevel } from '../utils/metabolism';

const TOTAL_STEPS = 5;

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: '久坐', desc: '几乎不运动，办公室工作' },
  { value: 'light', label: '轻度活动', desc: '每周 1-2 次运动' },
  { value: 'moderate', label: '中度活动', desc: '每周 3-5 次运动' },
  { value: 'active', label: '高度活跃', desc: '每周 6-7 次运动' },
  { value: 'very_active', label: '高强度', desc: '高强度体力工作或每日训练' },
];

export default function OnboardingPage() {
  const { updateAppUser } = useAuth();

  const [step, setStep] = useState(1);
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [age, setAge] = useState(30);
  const [height, setHeight] = useState(175);
  const [weight, setWeight] = useState(70);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('sedentary');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [editingField, setEditingField] = useState<'age' | 'height' | 'weight' | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await updateAppUser({
        gender,
        age,
        height,
        weight,
        activityLevel,
        hasCompletedSurvey: true,
      } as any);
      setDone(true);
    } catch (err) {
      console.error('Failed to save survey:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-full bg-gradient-to-b from-[#FAF5FF] via-slate-50 to-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 rounded-full bg-[#8B5CF6] flex items-center justify-center mb-6">
          <Check size={40} className="text-white" />
        </motion.div>
        <h3 className="text-xl font-black text-gray-900 mb-2">设置完成！</h3>
        <p className="text-sm text-gray-500">我们将根据你的信息定制个性化方案</p>
      </div>
    );
  }

  const canNext = () => {
    switch (step) {
      case 1: return gender !== null;
      case 2: return age >= 10 && age <= 100;
      case 3: return height >= 100 && height <= 250;
      case 4: return weight >= 30 && weight <= 200;
      case 5: return true;
      default: return false;
    }
  };

  const startEditing = (field: 'age' | 'height' | 'weight', currentValue: number) => {
    setEditingField(field);
    setEditValue(String(currentValue));
  };

  const confirmEdit = (field: 'age' | 'height' | 'weight', min: number, max: number) => {
    const num = Number(editValue);
    if (!isNaN(num) && num >= min && num <= max) {
      if (field === 'age') setAge(num);
      else if (field === 'height') setHeight(num);
      else if (field === 'weight') setWeight(num);
    }
    setEditingField(null);
    setEditValue('');
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-[#FAF5FF] via-slate-50 to-white text-gray-800 flex flex-col p-6 relative overflow-hidden font-sans select-none text-left">
      {/* Ambient highlights */}
      <div className="absolute top-[-80px] left-[-80px] w-[260px] h-[260px] rounded-full bg-[#8B5CF6]/8 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-[260px] h-[260px] rounded-full bg-[#8B5CF6]/4 blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col max-w-[320px] mx-auto w-full pt-8">

        {/* Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] px-3 py-1 rounded-full text-[10px] font-black tracking-wider">
            <Sparkles size={12} className="animate-pulse" />
            {step === 1 ? '欢迎加入' : `第 ${step} / ${TOTAL_STEPS} 步`}
          </div>
          <h2 className="text-[20px] font-black text-gray-900 tracking-tight">
            {step === 1 && '你的性别是？'}
            {step === 2 && '你的年龄？'}
            {step === 3 && '你的身高？'}
            {step === 4 && '你的体重？'}
            {step === 5 && '日常活动水平？'}
          </h2>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i + 1 === step ? 'bg-[#8B5CF6] w-6' : i + 1 < step ? 'bg-[#8B5CF6]/40' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence>
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="bg-white rounded-[24px] p-6 border border-purple-100/40 shadow-xl">
                <div className="grid grid-cols-2 gap-4">
                  {(['male', 'female'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`py-5 rounded-2xl border-2 font-extrabold text-[15px] transition-all active:scale-95 ${
                        gender === g
                          ? 'border-[#8B5CF6] bg-[#F3EEFF] text-[#8B5CF6] shadow-lg'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {g === 'male' ? '🙋 男' : '🙋‍♀️ 女'}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="bg-white rounded-[24px] p-6 border border-purple-100/40 shadow-xl">
                <div className="text-center">
                  {editingField === 'age' ? (
                    <input
                      autoFocus
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => confirmEdit('age', 10, 100)}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit('age', 10, 100); }}
                      className="text-[56px] font-black text-[#8B5CF6] tracking-tight w-40 text-center bg-transparent border-b-2 border-[#8B5CF6] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min={10}
                      max={100}
                    />
                  ) : (
                    <div
                      className="text-[56px] font-black text-[#8B5CF6] tracking-tight cursor-pointer hover:opacity-70 transition-opacity select-none"
                      onClick={() => startEditing('age', age)}
                    >
                      {age}
                    </div>
                  )}
                  <div className="text-sm text-gray-500 mb-4">岁</div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full h-2 accent-[#8B5CF6]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>10</span><span>55</span><span>100</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="bg-white rounded-[24px] p-6 border border-purple-100/40 shadow-xl">
                <div className="text-center">
                  {editingField === 'height' ? (
                    <input
                      autoFocus
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => confirmEdit('height', 100, 250)}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit('height', 100, 250); }}
                      className="text-[56px] font-black text-[#8B5CF6] tracking-tight w-40 text-center bg-transparent border-b-2 border-[#8B5CF6] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min={100}
                      max={250}
                    />
                  ) : (
                    <div
                      className="text-[56px] font-black text-[#8B5CF6] tracking-tight cursor-pointer hover:opacity-70 transition-opacity select-none"
                      onClick={() => startEditing('height', height)}
                    >
                      {height}
                    </div>
                  )}
                  <div className="text-sm text-gray-500 mb-4">cm</div>
                  <input
                    type="range"
                    min={100}
                    max={250}
                    step={1}
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="w-full h-2 accent-[#8B5CF6]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>100</span><span>175</span><span>250</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="bg-white rounded-[24px] p-6 border border-purple-100/40 shadow-xl">
                <div className="text-center">
                  {editingField === 'weight' ? (
                    <input
                      autoFocus
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => confirmEdit('weight', 30, 200)}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit('weight', 30, 200); }}
                      className="text-[56px] font-black text-[#8B5CF6] tracking-tight w-40 text-center bg-transparent border-b-2 border-[#8B5CF6] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min={30}
                      max={200}
                    />
                  ) : (
                    <div
                      className="text-[56px] font-black text-[#8B5CF6] tracking-tight cursor-pointer hover:opacity-70 transition-opacity select-none"
                      onClick={() => startEditing('weight', weight)}
                    >
                      {weight}
                    </div>
                  )}
                  <div className="text-sm text-gray-500 mb-4">kg</div>
                  <input
                    type="range"
                    min={30}
                    max={200}
                    step={0.5}
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full h-2 accent-[#8B5CF6]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>30</span><span>115</span><span>200</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="step5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="bg-white rounded-[24px] p-6 border border-purple-100/40 shadow-xl">
                <div className="space-y-3">
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setActivityLevel(opt.value)}
                      className={`w-full text-left py-4 px-4 rounded-xl border-2 transition-all active:scale-95 ${
                        activityLevel === opt.value
                          ? 'border-[#8B5CF6] bg-[#F3EEFF] shadow-lg'
                          : 'border-gray-100 bg-white hover:border-gray-200'
                      }`}
                    >
                      <div className={`font-extrabold text-sm flex items-center gap-2 ${
                        activityLevel === opt.value ? 'text-[#8B5CF6]' : 'text-gray-800'
                      }`}>
                        <Activity size={14} />
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5 ml-6">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom buttons */}
        <div className="space-y-3 mt-4">
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
              disabled={!canNext()}
              className="w-full bg-[#111111] hover:bg-black text-white font-extrabold text-[14px] py-3.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-black/15 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              下一步
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={submitting}
              className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-extrabold text-[14px] py-3.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-[#8B5CF6]/25 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  完成设置
                </>
              )}
            </button>
          )}

          {/* Back button */}
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="w-full text-center text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors py-1"
            >
              返回上一步
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

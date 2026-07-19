import React from 'react';
import { X, Sparkles, ClipboardPen } from 'lucide-react';
import { MealCategory } from '../types';

interface FoodMethodSelectorModalProps {
  isOpen: boolean;
  category: MealCategory | null;
  onClose: () => void;
  onSelectAI: () => void;
  onSelectManual: () => void;
}

export default function FoodMethodSelectorModal({
  isOpen,
  category,
  onClose,
  onSelectAI,
  onSelectManual,
}: FoodMethodSelectorModalProps) {
  if (!isOpen || !category) return null;

  const categoryNames = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="bg-white/90 backdrop-blur-lg border border-white/50 rounded-2xl w-full max-w-[380px] z-10 overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-[16px] font-bold text-gray-900">选择记录方式</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">记录到今天的 &quot;{categoryNames[category]}&quot;</p>
          </div>
          <button 
            id="close-selector-btn" 
            onClick={onClose} 
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Choices */}
        <div className="p-5 space-y-4">
          {/* AI Scanner Option */}
          <button
            id="select-ai-scanner-btn"
            onClick={onSelectAI}
            className="w-full text-left p-4 rounded-xl border border-[#DCD0FF] bg-gradient-to-br from-[#FAF8FF] to-[#F1EAFF] hover:from-[#FAF8FF] hover:to-[#E8DDFF] hover:border-[#8B5CF6]/50 shadow-sm transition-all active:scale-[0.98] group flex gap-3.5 items-start"
          >
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] text-white shadow-md shadow-purple-200 group-hover:scale-110 transition-transform">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold text-[#4B1BB3]">AI 拍照识图</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-[#8B5CF6] text-white tracking-wide scale-90 origin-left">推荐</span>
              </div>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                拍照或上传照片，由 AI 自动估算分量、热量与微量营养素
              </p>
            </div>
          </button>

          {/* Manual Entry Option */}
          <button
            id="select-manual-entry-btn"
            onClick={onSelectManual}
            className="w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all active:scale-[0.98] group flex gap-3.5 items-start"
          >
            <div className="p-2.5 rounded-xl bg-gray-100 text-gray-700 group-hover:bg-[#F3EEFF] group-hover:text-[#8B5CF6] transition-all">
              <ClipboardPen size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[14px] font-bold text-gray-800 group-hover:text-[#8B5CF6] transition-colors">手动记录 / 预设</span>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                直接输入名称和热量，或从常见食材库中快速挑选
              </p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

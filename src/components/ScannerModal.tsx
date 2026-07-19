import React, { useState, useEffect } from 'react';
import { Camera, X, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (presetIndex: number) => void;
}

export default function ScannerModal({ isOpen, onClose, onScanComplete }: ScannerModalProps) {
  const [scanState, setScanState] = useState<'viewfinder' | 'scanning' | 'success'>('viewfinder');
  const [selectedPreset, setSelectedPreset] = useState<number>(0);

  const presets = [
    {
      name: "香煎三文鱼藜麦碗 (推荐)",
      desc: "配新鲜牛油果、蔬菜、柠檬汁",
      image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=300&auto=format&fit=crop&q=80"
    },
    {
      name: "水煮鸡胸肉沙拉",
      desc: "配圣女果、西蓝花、低卡醋汁",
      image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80"
    }
  ];

  useEffect(() => {
    if (!isOpen) {
      setScanState('viewfinder');
    }
  }, [isOpen]);

  const handleCapture = () => {
    setScanState('scanning');
    setTimeout(() => {
      setScanState('success');
      setTimeout(() => {
        onScanComplete(selectedPreset);
      }, 1500);
    }, 2500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/95 z-50 flex flex-col justify-between max-w-[430px] mx-auto overflow-hidden shadow-2xl">
        {/* Top Control Bar */}
        <div className="flex justify-between items-center px-4 pt-6 pb-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-1.5 text-white/90">
            <Sparkles size={16} className="text-[#8B5CF6] animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider">AI 智能识别镜头</span>
          </div>
          <button 
            id="close-scanner-btn"
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewfinder/Scanning Area */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-6">
          <div className="relative w-full aspect-square max-w-[320px] rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl bg-gray-950">
            
            {/* Real or Mock Image representation */}
            <img 
              src={presets[selectedPreset].image} 
              alt="Scan target" 
              className={`w-full h-full object-cover transition-all duration-700 ${
                scanState === 'scanning' ? 'brightness-50 blur-[2px] scale-105' : 'brightness-90'
              }`}
              referrerPolicy="no-referrer"
            />

            {/* Scanning Laser Line */}
            {scanState === 'scanning' && (
              <motion.div 
                initial={{ top: '0%' }}
                animate={{ top: '100%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8B5CF6] to-transparent shadow-[0_0_12px_#8B5CF6]"
              />
            )}

            {/* Glowing Scan Overlay */}
            {scanState === 'scanning' && (
              <div className="absolute inset-0 bg-purple-500/10 animate-pulse pointer-events-none" />
            )}

            {/* HUD Bracket Overlays */}
            <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
            <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
            <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
            <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />

            {/* Scan Overlay text */}
            <div className="absolute bottom-4 inset-x-0 text-center">
              <span className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-medium text-white/90 inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                对准盘中食物，点击拍照
              </span>
            </div>
          </div>

          {/* Preset Selector */}
          {scanState === 'viewfinder' && (
            <div className="mt-6 w-full max-w-[320px]">
              <div className="text-[11px] text-gray-400 mb-2 uppercase tracking-wide text-center">选择你要拍摄的菜品</div>
              <div className="flex gap-2">
                {presets.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPreset(idx)}
                    className={`flex-1 p-2 rounded-xl border text-left transition-all ${
                      selectedPreset === idx 
                        ? 'border-[#8B5CF6] bg-purple-950/40 text-white' 
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{preset.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scan Messages */}
          <div className="h-16 flex items-center justify-center mt-4">
            {scanState === 'scanning' && (
              <div className="flex flex-col items-center gap-1">
                <div className="text-[#8B5CF6] text-sm font-semibold flex items-center gap-1.5">
                  <RefreshCw size={14} className="animate-spin" />
                  AI 正在深度分析食材构成...
                </div>
                <div className="text-[11px] text-gray-400">正在估算卡路里及三大营养素比例</div>
              </div>
            )}
            {scanState === 'success' && (
              <div className="flex flex-col items-center gap-1">
                <div className="text-[#10B981] text-sm font-bold flex items-center gap-1">
                  ✨ 扫描成功！
                </div>
                <div className="text-[11px] text-white">正在为您跳转至 AI 营养分析报告...</div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Shutter Button Bar */}
        <div className="px-6 pb-8 pt-4 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center gap-4">
          {scanState === 'viewfinder' ? (
            <div className="flex items-center justify-center w-full">
              <button 
                id="shutter-btn"
                onClick={handleCapture}
                className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-transparent transition-all active:scale-90"
              >
                <div className="w-12 h-12 rounded-full bg-white hover:bg-gray-100 transition-colors" />
              </button>
            </div>
          ) : (
            <div className="w-16 h-16 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            </div>
          )}
          <span className="text-[11px] text-gray-500 font-medium">
            AI 算法支持：Gemini 2.5 Flash 多模态视觉模型
          </span>
        </div>
      </div>
    </AnimatePresence>
  );
}

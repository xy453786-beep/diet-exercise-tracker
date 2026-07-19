import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, Sparkles, RefreshCw, Image, FlipHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string, presetIndex?: number) => void;
}

type ScanMode = 'camera' | 'preset' | 'scanning' | 'success';

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

export default function ScannerModal({ isOpen, onClose, onCapture }: ScannerModalProps) {
  const [scanMode, setScanMode] = useState<ScanMode>('camera');
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start / stop camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setCameraError('摄像头权限被拒绝，请使用预设模式');
      } else if (err.name === 'NotFoundError') {
        setCameraError('未检测到摄像头，请使用预设模式');
      } else {
        setCameraError('摄像头启动失败，请使用预设模式');
      }
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (isOpen && scanMode === 'camera') {
      startCamera();
    }
    return () => stopCamera();
  }, [isOpen, scanMode, startCamera, stopCamera]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setScanMode('camera');
      setCapturedImage(null);
      setCameraError(null);
    }
  }, [isOpen]);

  // Switch camera facing
  const switchCamera = () => {
    stopCamera();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture photo from video stream
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    stopCamera();
    setScanMode('scanning');

    // Simulate AI scanning, then proceed
    setTimeout(() => {
      setScanMode('success');
      setTimeout(() => {
        onCapture(dataUrl);
      }, 1500);
    }, 2500);
  };

  // Preset capture (existing behavior)
  const handlePresetCapture = () => {
    setScanMode('scanning');
    setTimeout(() => {
      setScanMode('success');
      setTimeout(() => {
        onCapture(presets[selectedPreset].image, selectedPreset);
      }, 1500);
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/95 z-50 flex flex-col justify-between max-w-[430px] mx-auto overflow-hidden shadow-2xl">
        {/* Top Control Bar */}
        <div className="flex justify-between items-center px-4 pt-6 pb-4 bg-gradient-to-b from-black/80 to-transparent z-10">
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

        {/* Viewfinder Area */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-6">
          <div className="relative w-full aspect-square max-w-[320px] rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl bg-gray-950">
            {/* Camera live preview */}
            {scanMode === 'camera' && (
              <>
                {cameraError ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white gap-3 p-6">
                    <Camera size={40} className="text-gray-500" />
                    <p className="text-sm text-gray-400 text-center">{cameraError}</p>
                    <button
                      onClick={() => setScanMode('preset')}
                      className="px-4 py-2 bg-[#8B5CF6] text-white text-xs font-bold rounded-xl"
                    >
                      切换到预设模式
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className={`w-full h-full object-cover transition-opacity duration-500 ${cameraReady ? 'opacity-100' : 'opacity-0'}`}
                      playsInline
                      muted
                    />
                    {!cameraReady && !cameraError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                        <RefreshCw size={32} className="text-white/60 animate-spin" />
                      </div>
                    )}
                    {/* Switch camera button */}
                    <button
                      onClick={switchCamera}
                      className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-all"
                    >
                      <FlipHorizontal size={16} />
                    </button>
                  </>
                )}
              </>
            )}

            {/* Preset image preview */}
            {(scanMode === 'preset') && (
              <img
                src={presets[selectedPreset].image}
                alt="预设食物"
                className="w-full h-full object-cover brightness-90"
                referrerPolicy="no-referrer"
              />
            )}

            {/* Captured image (shown during scanning) */}
            {(scanMode === 'scanning' || scanMode === 'success') && (
              <img
                src={capturedImage || presets[selectedPreset].image}
                alt="扫描目标"
                className={`w-full h-full object-cover transition-all duration-700 ${scanMode === 'scanning' ? 'brightness-50 blur-[2px] scale-105' : 'brightness-90'}`}
              />
            )}

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning Laser Line */}
            {scanMode === 'scanning' && (
              <motion.div
                initial={{ top: '0%' }}
                animate={{ top: '100%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8B5CF6] to-transparent shadow-[0_0_12px_#8B5CF6]"
              />
            )}

            {/* Glowing Scan Overlay */}
            {scanMode === 'scanning' && (
              <div className="absolute inset-0 bg-purple-500/10 animate-pulse pointer-events-none" />
            )}

            {/* HUD Bracket Overlays */}
            <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
            <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
            <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
            <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />

            {/* Viewfinder hint */}
            {scanMode === 'camera' && cameraReady && (
              <div className="absolute bottom-4 inset-x-0 text-center">
                <span className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-medium text-white/90 inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                  对准盘中食物，点击拍照
                </span>
              </div>
            )}
          </div>

          {/* Mode Switcher */}
          {scanMode === 'camera' || scanMode === 'preset' ? (
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { stopCamera(); setScanMode('camera'); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${scanMode === 'camera' ? 'bg-[#8B5CF6] text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
              >
                <Camera size={14} />
                拍照
              </button>
              <button
                onClick={() => { stopCamera(); setScanMode('preset'); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${scanMode === 'preset' ? 'bg-[#8B5CF6] text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
              >
                <Image size={14} />
                预设
              </button>
            </div>
          ) : null}

          {/* Preset Selector */}
          {scanMode === 'preset' && (
            <div className="mt-4 w-full max-w-[320px]">
              <div className="text-[11px] text-gray-400 mb-2 uppercase tracking-wide text-center">选择菜品</div>
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
            {scanMode === 'scanning' && (
              <div className="flex flex-col items-center gap-1">
                <div className="text-[#8B5CF6] text-sm font-semibold flex items-center gap-1.5">
                  <RefreshCw size={14} className="animate-spin" />
                  AI 正在深度分析食材构成...
                </div>
                <div className="text-[11px] text-gray-400">正在估算卡路里及三大营养素比例</div>
              </div>
            )}
            {scanMode === 'success' && (
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
        <div className="px-6 pb-8 pt-4 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center gap-4 z-10">
          {(scanMode === 'camera' && cameraReady) || scanMode === 'preset' ? (
            <div className="flex items-center justify-center w-full">
              <button
                id="shutter-btn"
                onClick={scanMode === 'camera' ? handleCapture : handlePresetCapture}
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

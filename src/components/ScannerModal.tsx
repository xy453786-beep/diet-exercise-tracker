import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, Sparkles, RefreshCw, FlipHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
}

type ScanMode = 'viewfinder' | 'scanning' | 'success';

export default function ScannerModal({ isOpen, onClose, onCapture }: ScannerModalProps) {
  const [scanMode, setScanMode] = useState<ScanMode>('viewfinder');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

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
        setCameraError('摄像头权限被拒绝，请在浏览器设置中允许摄像头访问');
      } else if (err.name === 'NotFoundError') {
        setCameraError('未检测到摄像头');
      } else {
        setCameraError('摄像头启动失败，请检查设备');
      }
    }
  }, [facingMode]);

  useEffect(() => {
    if (isOpen) {
      setScanMode('viewfinder');
      setCapturedImage(null);
      startCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  const switchCamera = () => {
    stopCamera();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

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

    setTimeout(() => {
      setScanMode('success');
      setTimeout(() => {
        onCapture(dataUrl);
      }, 1500);
    }, 2500);
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
            {scanMode === 'viewfinder' && (
              <>
                {cameraError ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white gap-3 p-6">
                    <Camera size={40} className="text-gray-500" />
                    <p className="text-sm text-gray-400 text-center">{cameraError}</p>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className={`w-full h-full object-cover transition-opacity duration-500 ${cameraReady ? 'opacity-100' : 'opacity-0'}`}
                      playsInline
                      muted
                    />
                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                        <RefreshCw size={32} className="text-white/60 animate-spin" />
                      </div>
                    )}
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

            {/* Captured image during scanning */}
            {(scanMode === 'scanning' || scanMode === 'success') && capturedImage && (
              <img
                src={capturedImage}
                alt="拍摄的食物"
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

            {scanMode === 'scanning' && (
              <div className="absolute inset-0 bg-purple-500/10 animate-pulse pointer-events-none" />
            )}

            {/* HUD Bracket Overlays */}
            <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
            <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
            <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
            <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />

            {scanMode === 'viewfinder' && cameraReady && (
              <div className="absolute bottom-4 inset-x-0 text-center">
                <span className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-medium text-white/90 inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                  对准盘中食物，点击拍照
                </span>
              </div>
            )}
          </div>

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

        {/* Bottom Shutter Button */}
        <div className="px-6 pb-8 pt-4 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center gap-4 z-10">
          {scanMode === 'viewfinder' && cameraReady ? (
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

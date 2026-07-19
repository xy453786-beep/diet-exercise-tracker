import React, { useState } from 'react';
import { LogOut, X, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  title: string;
  avatarUrl?: string;
  username?: string;
  onLogout?: () => void;
}

export default function Header({ title, avatarUrl, username, onLogout }: HeaderProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogoutClick = () => {
    setShowConfirm(true);
  };

  const confirmLogout = () => {
    setShowConfirm(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <>
      <header className="flex items-center justify-between px-4 py-4 glass-header sticky top-0 z-40 h-14">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full overflow-hidden border border-[#8B5CF6]/30 shadow-sm">
            <img
              src={avatarUrl || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80"}
              alt="User Profile"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="text-[12px] font-black text-gray-700 max-w-[60px] truncate text-left">
            {username || '访客'}
          </span>
        </div>

        <h1 className="text-[15px] font-extrabold text-[#111111] tracking-tight truncate max-w-[140px]">{title}</h1>

        {onLogout ? (
          <button 
            id="header-logout-btn"
            onClick={handleLogoutClick}
            className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 active:scale-95 flex items-center gap-0.5"
            title="退出登录"
          >
            <LogOut size={16} />
            <span className="text-[10px] font-bold hidden sm:inline">退出</span>
          </button>
        ) : (
          <div className="w-7" />
        )}
      </header>

      {/* Modern Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            {/* Backdrop click to dismiss */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0" 
              onClick={() => setShowConfirm(false)} 
            />

            {/* Dialog Content */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white/95 backdrop-blur-lg border border-white/50 rounded-2xl w-full max-w-[280px] p-5 shadow-2xl z-10 text-center relative space-y-4"
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#7C3AED]/10 flex items-center justify-center text-[#7C3AED]">
                  <HelpCircle size={22} />
                </div>
                <h3 className="text-sm font-bold text-gray-900">退出登录</h3>
                <p className="text-xs text-gray-500 font-medium">确定要退出当前账号吗？</p>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  id="logout-cancel-btn"
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  取消
                </button>
                <button
                  id="logout-confirm-btn"
                  onClick={confirmLogout}
                  className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
                >
                  确定退出
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

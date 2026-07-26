import React from 'react';

interface HeaderProps {
  title: string;
  avatarUrl?: string;
  username?: string;
}

export default function Header({ title, avatarUrl, username }: HeaderProps) {
  return (
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

      <div className="w-7" />
    </header>
  );
}

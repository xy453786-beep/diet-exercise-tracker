import React from 'react';
import { Home, Utensils, Dumbbell, BarChart3 } from 'lucide-react';
import { PageType } from '../types';

interface TabBarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
}

export default function TabBar({ currentPage, onPageChange }: TabBarProps) {
  // Map internal subpages like 'ai-result' to the 'diet' tab in terms of visual active state
  const getActiveTab = (page: PageType): string => {
    if (page === 'ai-result') return 'diet';
    return page;
  };

  const activeTab = getActiveTab(currentPage);

  const tabs = [
    { id: 'home' as const, label: '首页', icon: Home },
    { id: 'diet' as const, label: '饮食', icon: Utensils },
    { id: 'exercise' as const, label: '运动', icon: Dumbbell },
    { id: 'analysis' as const, label: '分析', icon: BarChart3 },
  ];

  return (
    <nav className="absolute bottom-0 left-0 w-full bg-white border-t border-gray-100 py-2 px-6 flex justify-between items-center z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] h-16 rounded-t-2xl">
      {tabs.map((tab) => {
        const IconComponent = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`tab-btn-${tab.id}`}
            onClick={() => onPageChange(tab.id)}
            className="flex flex-col items-center justify-center flex-1 py-1 group transition-all"
          >
            <div className={`p-1 rounded-lg transition-transform duration-200 group-active:scale-95 ${isActive ? 'text-[#8B5CF6]' : 'text-gray-400 group-hover:text-gray-600'}`}>
              <IconComponent size={20} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span
              className={`text-[11px] font-medium transition-colors ${
                isActive ? 'text-[#8B5CF6] font-semibold' : 'text-gray-400 group-hover:text-gray-600'
              }`}
            >
              {tab.label}
            </span>
            {isActive && (
              <div className="w-4 h-[3px] bg-[#8B5CF6] rounded-full mt-[2px]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

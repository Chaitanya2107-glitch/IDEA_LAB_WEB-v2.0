import React, { useState, useRef, useEffect } from 'react';
import { Home, ClipboardList, Settings, User, LucideIcon, MoreHorizontal, ChevronUp, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  id: string;
}

interface BottomNavProps {
  items?: NavItem[];
  activeId?: string;
  onTabChange?: (id: string) => void;
  isStaff?: boolean;
}

const BottomNav: React.FC<BottomNavProps> = ({ items, activeId, onTabChange, isStaff }) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const defaultItems: NavItem[] = [
    { name: 'Home', path: isStaff ? '/staff-dashboard' : '/dashboard', icon: Home, id: 'overview' },
    { name: isStaff ? 'Activity' : 'Orders', path: '#activity', icon: ClipboardList, id: 'activity' },
    { name: 'Settings', path: '#settings', icon: Settings, id: 'settings' },
    { name: 'Profile', path: '#profile', icon: User, id: 'profile' },
  ];

  const allItems = items || defaultItems;
  const maxTabs = 5;
  const showMore = allItems.length > maxTabs;

  const displayItems = showMore ? allItems.slice(0, 4) : allItems;
  const moreItems = showMore ? allItems.slice(4) : [];

  // Close "More" menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    if (isMoreOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoreOpen]);

  // Check if any "More" item is currently active
  const isMoreActive = moreItems.some(item => item.id === activeId);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden">
      <div className="relative mx-auto max-w-md" ref={moreRef}>
        {/* --- Sub-menu for "More" --- */}
        <AnimatePresence>
          {isMoreOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute bottom-full right-2 z-50 mb-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            >
              <p className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Management Lab</p>

              {moreItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange?.(item.id);
                    setIsMoreOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
                    activeId === item.id
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon className={`h-4 w-4 ${activeId === item.id ? "text-brand-600" : "text-slate-400"}`} aria-hidden="true" />
                  {item.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- Main Navigation Bar --- */}
        <div className="flex items-stretch justify-around px-2">
          {displayItems.map((item) => {
            const isActive = activeId === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange?.(item.id);
                  setIsMoreOpen(false);
                }}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                  isActive ? "text-brand-600" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-brand-600" : "text-slate-400"}`} aria-hidden="true" />
                <span>{item.name}</span>
              </button>
            );
          })}

          {showMore ? (
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              aria-expanded={isMoreOpen}
              className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                isMoreActive || isMoreOpen ? "text-brand-600" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <span className="relative">
                {isMoreOpen ? <ChevronUp className="h-5 w-5" aria-hidden="true" /> : <MoreHorizontal className={`h-5 w-5 ${isMoreActive ? "text-brand-600" : "text-slate-400"}`} aria-hidden="true" />}
                {!isMoreOpen && isMoreActive && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-white" />
                )}
              </span>
              <span>More</span>
            </button>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('toggleSideDrawer'))}
              className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              <Menu className="h-5 w-5 text-slate-400" aria-hidden="true" />
              <span>Menu</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BottomNav;

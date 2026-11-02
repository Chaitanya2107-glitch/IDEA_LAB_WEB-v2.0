// src/components/DashboardNavbar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Settings, LogOut, ChevronDown,
  Home, Box, Shield, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, StaffUser } from '../../types';
import SideDrawer from './SideDrawer';
import { avatarUrl } from "../utils/avatar";

interface DashboardNavbarProps {
  user: User | null;
  staffUser?: StaffUser | null;
  onLogout: () => void;
  onUpdateUser: (data: any) => Promise<void>;
}

const DashboardNavbar: React.FC<DashboardNavbarProps> = ({ user, staffUser, onLogout }) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleToggle = () => setMoreOpen(prev => !prev);
    window.addEventListener('toggleSideDrawer', handleToggle);
    return () => window.removeEventListener('toggleSideDrawer', handleToggle);
  }, []);

  const activeUser = user
    ? {
        id: user.id,
        name: user.name,
        avatar: user.avatar || avatarUrl(user.name),
        email: user.email,
        type: user.type ?? "student",
      }
    : staffUser
    ? {
        id: staffUser.employeeId,
        name: staffUser.name,
        avatar:
          staffUser.avatar ||
          avatarUrl(staffUser.name),
        email: staffUser.email || (staffUser.employeeId + "@reva.edu.in"),
        type: "staff",
      }
    : null;

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const logoutHandler = () => {
    setProfileOpen(false);
    onLogout();
    navigate("/");
  };

  const goToSettings = () => {
    setProfileOpen(false);
    if (staffUser) navigate("/staff-dashboard?tab=settings");
    else if (user) navigate("/dashboard?tab=settings");
  };

  return (
    <>
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex flex-shrink-0 items-center">
          <img src="/img/logo_orange_new.png" alt="REVA University" className="h-9 w-auto" />
        </Link>

        {/* Profile Section */}
        <div className="flex items-center">
          {activeUser ? (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <img
                  src={activeUser.avatar}
                  alt={activeUser.name}
                  className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
                />
                <span className="hidden max-w-[100px] truncate sm:block">
                  {activeUser.name.split(" ")[0]}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                  >
                    <div className="border-b border-slate-200 px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {(user?.email?.toLowerCase().endsWith("@reva.edu.in") && user?.type === "university") || staffUser ? <Shield className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" /> : <Globe className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />}
                        <p className="text-xs font-medium text-slate-500">
                          {staffUser ? "Staff Access" : (user?.email?.toLowerCase().endsWith("@reva.edu.in") && user?.type === "university") ? "University Access" : "General Access"}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                        {activeUser.name}
                      </p>
                      <p className="truncate text-sm text-slate-500">
                        {activeUser.email}
                      </p>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => navigate("/")}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      >
                        <Home className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        Go to Homepage
                      </button>

                      {((user?.email?.toLowerCase().endsWith("@reva.edu.in") && user?.type === "university") || staffUser) && (
                        <button
                          onClick={() => navigate("/components")}
                          className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Box className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          Catalog
                        </button>
                      )}

                      <button
                        onClick={goToSettings}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      >
                        <Settings className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        Settings
                      </button>
                    </div>

                    <div className="border-t border-slate-200 pt-1">
                      <button
                        onClick={logoutHandler}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" /> Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
    <SideDrawer 
      isOpen={moreOpen} 
      onClose={() => setMoreOpen(false)} 
      user={user} 
      staffUser={staffUser} 
    />
    </>
  );
};

export default DashboardNavbar;

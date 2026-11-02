// src/components/Navbar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, X, Box, User as UserIcon, Settings, LogOut, ChevronDown, Printer,
  Shield, LayoutDashboard, Users, Zap, Info, MessageSquare,
  Globe, Home, Calendar, LayoutTemplate, Package, CircuitBoard, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { User, StaffUser } from '../../types';
import SideDrawer from './SideDrawer';
import { avatarUrl } from "../utils/avatar";

interface NavbarProps {
  user: User | null;
  staffUser?: StaffUser | null;
  onLogout: () => void;
  onUpdateUser: (data: any) => Promise<void>;
}

const Navbar: React.FC<NavbarProps> = ({ user, staffUser, onLogout, onUpdateUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const profileRef = useRef<HTMLDivElement>(null);
  
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const mainLinks = [
    { name: "Home", path: "/" },
    { name: "Events", path: "/events" },
    { name: "Gallery", path: "/gallery" },
  ];

  const secondaryLinks = [
    { name: "About Us", path: "/about", icon: Info },
    { name: "Projects", path: "/projects", icon: Zap },
    { name: "Infrastructure", path: "/infrastructure", icon: Layers },
    { name: "Team", path: "/team", icon: Users },
    { name: "Testimonials", path: "/testimonials", icon: MessageSquare },
  ];

  const is2XL = windowWidth >= 1536;
  const isXL = windowWidth >= 1280;
  const isLG = windowWidth >= 1024;

  const visibleSecondary = secondaryLinks.filter(l => {
    if (l.name === "About Us") return isLG;
    if (l.name === "Projects") return isXL;
    return false;
  });

  const hiddenSecondary = secondaryLinks.filter(l => !visibleSecondary.includes(l));

  /* ---------------------------------------------
     LOGIC UPDATE: Avatar + Name Logic Fixed
     --------------------------------------------- */
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

  /* --------------------------------------------- */

  const mobileLinks = [
    ...(activeUser
      ? [
          {
            name: staffUser ? "Staff Dashboard" : "My Dashboard",
            path: staffUser ? "/staff-dashboard" : "/dashboard",
            icon: LayoutDashboard,
          },
        ]
      : []),
    { name: "Home", path: "/", icon: Home },

    ...(activeUser
      ? [
          ...(user?.type !== "non-university" && !staffUser
            ? [{ name: "Component Catalog", path: "/components", icon: Package }]
            : []),
        ]
      : []),

    { name: "Events", path: "/events", icon: Calendar },
    { name: "Gallery", path: "/gallery", icon: LayoutTemplate },
    { name: "About Us", path: "/about", icon: Info },
    { name: "Infrastructure", path: "/infrastructure", icon: Layers },
    { name: "Our Team", path: "/team", icon: Users },
    { name: "Projects", path: "/projects", icon: Zap },
    { name: "Testimonials", path: "/testimonials", icon: MessageSquare },
  ];

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const LOGO_LIGHT_BG = "/img/logo_orange_new.png";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);


  useEffect(() => {
    setIsOpen(false);
    setProfileOpen(false);
    setMoreOpen(false);
  }, [location]);

  useEffect(() => {
    document.body.style.overflow = (isOpen || moreOpen) ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, moreOpen]);

  useEffect(() => {
    const handleToggle = () => setMoreOpen(prev => !prev);
    window.addEventListener('toggleSideDrawer', handleToggle);
    return () => window.removeEventListener('toggleSideDrawer', handleToggle);
  }, []);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const logoutHandler = () => {
    setIsOpen(false);
    onLogout();
    navigate("/");
  };

  const goToSettings = () => {
    setProfileOpen(false);
    setIsOpen(false);
    if (staffUser) navigate("/staff-dashboard");
    else if (user) navigate("/dashboard");
  };

  const getBadge = () => {
    if (staffUser) return "Staff Access";
    const isUnivEmail = user?.email?.toLowerCase().endsWith("@reva.edu.in");
    if (user?.type === "university" && isUnivEmail) return "University Access";
    return "General Access";
  };

  const getBadgeIcon = () => {
    if (staffUser) return <Shield className="w-3 h-3 text-brand-600" />;
    if (user?.type === "non-university")
      return <Globe className="w-3 h-3 text-blue-600" />;
    return <UserIcon className="w-3 h-3 text-brand-600" />;
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-brand-50 text-brand-600"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;

  const drawerLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
      isActive
        ? "bg-brand-50 text-brand-700"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;

  return (
    <>
      <nav
        className={`fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white ${
          scrolled ? "shadow-sm" : ""
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <NavLink to="/" className="flex flex-shrink-0 items-center">
            <img src={LOGO_LIGHT_BG} alt="REVA University" className="h-9 w-auto" />
          </NavLink>

          {/* Desktop Links */}
          <div className="mx-4 hidden items-center gap-1 md:flex">
            {mainLinks.map((link) => (
              <NavLink key={link.path} to={link.path} end={link.path === "/"} className={linkClass}>
                {link.name}
              </NavLink>
            ))}

            {/* Progressive Secondary Links */}
            {visibleSecondary.map((link) => (
              <NavLink key={link.path} to={link.path} className={linkClass}>
                {link.name === "PCB Fabrication" ? "PCB" : link.name === "3D Printing" ? "3D Print" : link.name}
              </NavLink>
            ))}

            {/* More pages drawer toggle */}
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              aria-label={moreOpen ? "Close more pages" : "More pages"}
              aria-expanded={moreOpen}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                moreOpen
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {moreOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>

          {/* RIGHT SIDE USER */}
          <div className="hidden flex-shrink-0 items-center gap-3 md:flex">
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
                  <span className="max-w-[100px] truncate">
                    {activeUser.name.split(" ")[0]}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {getBadgeIcon()}
                        <p className="text-xs font-medium text-slate-500">{getBadge()}</p>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                        {activeUser.name}
                      </p>
                      <p className="truncate text-sm text-slate-500">{activeUser.email}</p>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() =>
                          navigate(staffUser ? "/staff-dashboard" : "/dashboard")
                        }
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      >
                        <LayoutDashboard className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        {staffUser ? "Staff Dashboard" : "My Dashboard"}
                      </button>

                      {!staffUser && user?.type !== "non-university" && (
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
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
              >
                <UserIcon className="h-4 w-4" aria-hidden="true" /> Sign In
              </button>
            )}
          </div>

          {/* MOBILE MENU BUTTON */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {isOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Side Drawer Component */}
        <SideDrawer
          isOpen={moreOpen}
          onClose={() => setMoreOpen(false)}
          user={user}
          staffUser={staffUser}
        />

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
            />
          )}
          {isOpen && (
            <motion.div
              key="mobile-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-xl md:hidden"
            >
              {/* Close Button */}
              <div className="flex h-16 flex-shrink-0 items-center justify-end border-b border-slate-200 px-4">
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Profile Section */}
              <div className="border-b border-slate-200 px-4 py-6">
                {activeUser ? (
                  <div className="flex items-center gap-4">
                    <img
                      src={activeUser.avatar}
                      className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200"
                      alt="Profile"
                    />
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          !staffUser && user?.type === "non-university"
                            ? "bg-blue-50 text-blue-700 ring-blue-600/20"
                            : "bg-brand-50 text-brand-700 ring-brand-600/20"
                        }`}
                      >
                        {getBadgeIcon()}
                        {getBadge()}
                      </span>
                      <h3 className="mt-2 truncate font-display text-lg font-semibold text-slate-900">{activeUser.name}</h3>
                      <p className="truncate text-sm text-slate-500">{activeUser.email}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setIsOpen(false); navigate("/login"); }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
                  >
                    <UserIcon className="h-4 w-4" aria-hidden="true" /> Sign In
                  </button>
                )}
              </div>

              {/* Navigation Section */}
              <div className="flex-1 space-y-6 px-4 py-6">
                <div>
                  <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Navigation</p>
                  <div className="mt-2 space-y-1">
                    {[
                      { name: "Home", path: "/", icon: Home },
                      ...(activeUser ? [{ name: staffUser ? "Staff Dashboard" : "My Dashboard", path: staffUser ? "/staff-dashboard" : "/dashboard", icon: LayoutDashboard }] : []),
                      { name: "Events", path: "/events", icon: Calendar },
                      { name: "Gallery", path: "/gallery", icon: LayoutTemplate },
                      { name: "Project", path: "/projects", icon: Zap },
                    ].map((link) => (
                      <NavLink
                        key={link.path}
                        to={link.path}
                        end={link.path === "/"}
                        onClick={() => setIsOpen(false)}
                        className={drawerLinkClass}
                      >
                        {link.icon && <link.icon className={`h-5 w-5 ${location.pathname === link.path ? "text-brand-600" : "text-slate-400"}`} aria-hidden="true" />}
                        <span>{link.name}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>

                {/* Discover More Section */}
                <div>
                  <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Discover More</p>
                  <div className="mt-2 space-y-1">
                    {[
                      ...(activeUser && user?.type !== "non-university" && !staffUser
                        ? [{ name: "Component Catalog", path: "/components", icon: Package }]
                        : []),
                      { name: "3D Printing", path: "/3d-print", icon: Printer },
                      { name: "PCB Fabrication", path: "/pcb-order", icon: CircuitBoard },
                      { name: "About Us", path: "/about", icon: Info },
                      { name: "Infrastructure", path: "/infrastructure", icon: Layers },
                      { name: "Our Team", path: "/team", icon: Users },
                      { name: "Testimonials", path: "/testimonials", icon: MessageSquare },
                    ].map((link) => (
                      <NavLink
                        key={link.path}
                        to={link.path}
                        onClick={() => setIsOpen(false)}
                        className={drawerLinkClass}
                      >
                        <link.icon className={`h-5 w-5 ${location.pathname === link.path ? "text-brand-600" : "text-slate-400"}`} aria-hidden="true" />
                        <span>{link.name}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>

                {/* Sign Out */}
                {activeUser && (
                  <button
                    onClick={logoutHandler}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <LogOut className="h-5 w-5" aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 px-4 py-4">
                <p className="text-xs text-slate-500">© 2026 REVA IDEA Lab</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
};

export default Navbar;

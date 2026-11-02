import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Layers, Package, Calendar, LayoutTemplate, Info, Users, Zap, MessageSquare, Printer, CircuitBoard, LayoutDashboard, Shield } from 'lucide-react';
import { avatarUrl } from "../utils/avatar";

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
  staffUser?: any;
}

const SideDrawer: React.FC<SideDrawerProps> = ({ isOpen, onClose, user, staffUser }) => {
  const location = useLocation();

  const mainLinks = [
    { name: "Home", path: "/" },
    { name: "My Dashboard", path: staffUser ? "/staff-dashboard" : "/dashboard", icon: LayoutDashboard },
    { name: "Events", path: "/events" },
    { name: "Gallery", path: "/gallery" },
    { name: "Project", path: "/projects" },
  ];

  const secondaryLinks = [
    ...(user
      ? [
          ...(user?.type !== "non-university" && !staffUser
            ? [{ name: "Component Catalog", path: "/components", icon: Package }]
            : []),
        ]
      : []),
    { name: "3D Printing", path: "/3d-print", icon: Printer },
    { name: "PCB Fabrication", path: "/pcb-order", icon: CircuitBoard },
    { name: "Events", path: "/events", icon: Calendar },
    { name: "Gallery", path: "/gallery", icon: LayoutTemplate },
    { name: "About Us", path: "/about", icon: Info },
    { name: "Infrastructure", path: "/infrastructure", icon: Layers },
    { name: "Our Team", path: "/team", icon: Users },
    { name: "Projects", path: "/projects", icon: Zap },
    { name: "Testimonials", path: "/testimonials", icon: MessageSquare },
  ];

  // We show a subset in "Quick Navigation" and the rest in "Discover More"
  const visiblePaths = ["/", "/events", "/gallery", "/projects"];


  const isUniversity = user?.email?.toLowerCase().endsWith("@reva.edu.in") && user?.type === "university";

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
      isActive
        ? "bg-brand-50 text-brand-700"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 z-[100] bg-slate-900/50"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 z-[101] flex w-full max-w-sm flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-xl"
          >
            <div className="flex h-16 flex-shrink-0 items-center justify-end border-b border-slate-200 px-4">
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Header / Profile Section */}
            <div className="border-b border-slate-200 px-4 py-6">
              {(user || staffUser) ? (
                <div className="flex items-center gap-4">
                  <img
                    src={user?.avatar || staffUser?.avatar || avatarUrl(user?.name || staffUser?.name)}
                    className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200"
                    alt="Profile"
                  />
                  <div className="min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        staffUser || isUniversity
                          ? "bg-brand-50 text-brand-700 ring-brand-600/20"
                          : "bg-blue-50 text-blue-700 ring-blue-600/20"
                      }`}
                    >
                      {staffUser || isUniversity ? <Shield className="h-3 w-3" aria-hidden="true" /> : <Globe className="h-3 w-3" aria-hidden="true" />}
                      {staffUser ? "Staff Access" : isUniversity ? "University Access" : "General Access"}
                    </span>
                    <h3 className="mt-2 truncate font-display text-lg font-semibold text-slate-900">{user?.name || staffUser?.name}</h3>
                    <p className="truncate text-sm text-slate-500">{user?.email || staffUser?.email}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="font-display text-lg font-semibold text-slate-900">Welcome</h3>
                  <p className="mt-1 text-sm text-slate-500">Explore our engineering excellence</p>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-6 px-4 py-6">
              <div>
                <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Navigation</p>
                <div className="mt-2 space-y-1">
                  {mainLinks.map((link) => (
                    <NavLink
                      key={link.path}
                      to={link.path}
                      onClick={onClose}
                      className={itemClass}
                    >
                      {link.icon && <link.icon className={`h-5 w-5 ${location.pathname === link.path ? "text-brand-600" : "text-slate-400"}`} aria-hidden="true" />}
                      <span>{link.name}</span>
                    </NavLink>
                  ))}
                </div>
              </div>

              <div>
                <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Discover More</p>
                <div className="mt-2 space-y-1">
                  {secondaryLinks.filter(l => !visiblePaths.includes(l.path)).map((link) => (
                    <NavLink
                      key={link.path}
                      to={link.path}
                      onClick={onClose}
                      className={itemClass}
                    >
                      <link.icon className={`h-5 w-5 ${location.pathname === link.path ? "text-brand-600" : "text-slate-400"}`} aria-hidden="true" />
                      <span>{link.name}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 px-4 py-4">
              <p className="text-xs text-slate-500">© 2026 REVA IDEA Lab</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SideDrawer;

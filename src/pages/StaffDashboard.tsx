// src/pages/StaffDashboard.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  Inbox, Package, Users, Calendar, History as HistoryIcon, Settings, Shield,
  LogOut, Printer, Download, CheckCircle, XCircle, Clock,
  Loader2, Eye, Layers, Palette, Weight, DollarSign, User as UserIcon,
  CircuitBoard, LayoutDashboard, ChevronRight, Bell,
  PlayCircle, AlertCircle, ArrowRight, Zap, GraduationCap, Cpu, Box, ClipboardList, UserCircle, Home,
  Plus, Activity, FileText, Image as ImageIcon, Save, Link as LinkIcon, ExternalLink, Video, MoreVertical, X,
  ChevronLeft, MapPin
} from "lucide-react";
import { StaffUser, SlotBooking, HistoryLog, Role, Notification } from "../../types";
import { authService } from "../services/api";
import { fetchOrderApprover } from "../utils/orderUtils";
import { generateReceipt } from "../utils/pdfGenerator";
import { useLocation, useNavigate, Link } from "react-router-dom";
import SettingsPanel from "../components/SettingsPanel";
import AmbassadorCMS from "../components/cms/AmbassadorCMS";
import EventManagerPanel from "../components/cms/EventManagerPanel";
import InventoryPanel from "../components/cms/InventoryPanel";
import UserManagementPanel from "../components/cms/UserManagementPanel";
import RequestPanel from "../components/cms/RequestPanel";
import SignInLogPanel from "../components/cms/SignInLogPanel";
import PcbOrdersPanel from "../components/cms/PcbOrdersPanel";
import { motion, AnimatePresence } from "framer-motion";
import BottomNav from "../components/BottomNav";

type Tab = "overview" | "print_orders" | "requests" | "inventory" | "users" | "events" | "history" | "sign_ins" | "pcb_orders" | "settings" | "add_staff" | "cms";

interface NavItem {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  roles: Role[];
}

const TAB_ICONS: Record<string, React.ReactNode> = {
  overview: <LayoutDashboard className="w-5 h-5" />,
  print_orders: <Printer className="w-5 h-5" />,
  pcb_orders: <CircuitBoard className="w-5 h-5" />,
  requests: <Inbox className="w-5 h-5" />,
  inventory: <Box className="w-5 h-5" />,
  events: <Calendar className="w-5 h-5" />,
  cms: <FileText className="w-5 h-5" />,
  users: <Users className="w-5 h-5" />,
  history: <HistoryIcon className="w-5 h-5" />,
  sign_ins: <ClipboardList className="w-5 h-5" />,
  materials: <Layers className="w-5 h-5" />,
  settings: <Settings className="w-5 h-5" />,
};

const TAB_LABELS: Record<string, string> = {
  overview: "Overview",
  print_orders: "3D Print Orders",
  pcb_orders: "PCB Orders",
  requests: "Requests",
  inventory: "Inventory",
  events: "Events",
  cms: "Ambassador CMS",
  users: "User Management",
  history: "Activity History",
  sign_ins: "Sign-in Log",
  settings: "Settings",
};

const TAB_ICON_COMPONENTS: Record<string, any> = {
  overview: LayoutDashboard,
  print_orders: Printer,
  pcb_orders: CircuitBoard,
  requests: Inbox,
  inventory: Box,
  events: Calendar,
  cms: FileText,
  users: Users,
  history: HistoryIcon,
  sign_ins: ClipboardList,
  settings: Settings,
  add_staff: Users,
};

const NAV_ITEMS: NavItem[] = [
  { id: "overview",    label: "Overview",         icon: TAB_ICONS.overview,  roles: ["ADMIN", "LAB", "AMBASSADOR", "EVENT_MANAGER", "TECH_SUPPORT"] },
  { id: "print_orders",label: TAB_LABELS.print_orders, icon: TAB_ICONS.print_orders,    roles: ["ADMIN", "LAB"] },
  { id: "pcb_orders",  label: TAB_LABELS.pcb_orders,   icon: TAB_ICONS.pcb_orders,      roles: ["ADMIN", "LAB"] },
  { id: "requests",    label: "Requests",         icon: TAB_ICONS.requests,      roles: ["ADMIN", "AMBASSADOR", "TECH_SUPPORT"] },
  { id: "inventory",   label: "Inventory",        icon: TAB_ICONS.inventory,        roles: ["ADMIN", "LAB"] },
  { id: "events",    label: "Events",           icon: TAB_ICONS.events,   roles: ["ADMIN", "LAB", "EVENT_MANAGER"] },
  { id: "cms",       label: "Ambassador CMS",   icon: TAB_ICONS.cms,   roles: ["ADMIN", "AMBASSADOR"] },
  { id: "users",     label: "User Management",  icon: TAB_ICONS.users,      roles: ["ADMIN", "TECH_SUPPORT"] },
  { id: "history",   label: "Activity History",  icon: TAB_ICONS.history,    roles: ["ADMIN", "TECH_SUPPORT", "LAB"] },
  { id: "sign_ins",  label: "Sign-in Log",       icon: TAB_ICONS.sign_ins,   roles: ["ADMIN", "TECH_SUPPORT"] },
  { id: "settings",  label: "Settings",         icon: TAB_ICONS.settings,   roles: ["USER", "ADMIN", "LAB", "AMBASSADOR", "EVENT_MANAGER", "TECH_SUPPORT"] },
];

/* ── Status badge ── */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, any> = {
    pending:   "bg-amber-50 text-amber-700 border-amber-100",
    pending_payment: "bg-orange-50 text-orange-700 border-orange-100",
    printing:  { cls: "bg-blue-50 text-blue-700 border-blue-100", icon: Loader2 },
    completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    Paid:      "bg-emerald-50 text-emerald-700 border-emerald-100",
    rejected:  "bg-red-50 text-red-700 border-red-100",
    queued:    "bg-slate-50 text-slate-600 border-slate-100",
    cancelled: "bg-slate-50 text-slate-500 border-slate-200",
  };
  const icons: Record<string, any> = {
    pending:   Clock,
    pending_payment: Clock,
    printing:  Loader2,
    completed: CheckCircle,
    Paid:      CheckCircle,
    rejected:  XCircle,
    queued:    AlertCircle,
    cancelled: XCircle,
  };
  const labelMap: Record<string, string> = {
    pending_payment: "Waiting",
    Paid: "Paid"
  };
  const Icon = icons[status] || icons.pending;
  const config = styles[status];
  const cls = (typeof config === 'string' ? config : config?.cls) || "bg-gray-50 text-gray-500 border-gray-100";
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${cls}`}>
      <Icon className={`w-3 h-3 ${status === 'printing' ? 'animate-spin' : ''}`} /> {labelMap[status] || status}
    </span>
  );
};

/* ── Single Print Order Card ── */
const PrintOrderCard: React.FC<{
  order: any;
  canDownload: boolean;
  canUpdateStatus: boolean;
  onStatusChange: (id: string, status: string) => Promise<void>;
}> = ({ order, canDownload, canUpdateStatus, onStatusChange }) => {
  const [downloading, setDownloading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const downloadStl = async () => {
    if (!order.storage_path) return;
    setDownloading(true);
    try {
      const url = await authService.downloadPrintOrderStl(order.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = order.file_name || "model.stl";
      a.click();
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  const updateStatus = async (s: string) => {
    setUpdating(true);
    await onStatusChange(order.id, s);
    setUpdating(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/60 backdrop-blur-md border border-slate-100 rounded-[2.5rem] p-6 hover:shadow-2xl hover:shadow-slate-200/50 transition-all hover:-translate-y-1 group relative overflow-hidden"
    >
      {/* Decorative Gradient Accent */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-brand-50/20 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 border border-slate-100 group-hover:bg-brand-50 group-hover:text-brand-400 transition-colors">
             <Printer className="w-8 h-8" />
           </div>
           <div className="min-w-0">
             <div className="flex items-center gap-3 mb-1">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest font-mono">#{order.id?.slice(0, 8).toUpperCase()}</span>
               <StatusBadge status={order.status || "pending"} />
             </div>
             <h3 className="text-xl font-bold text-slate-900 truncate tracking-tight">{order.file_name || "model.stl"}</h3>
             <p className="text-xs text-slate-400 font-bold flex items-center gap-1.5 mt-1">
               <UserIcon className="w-3.5 h-3.5" /> {order.user_name || "Unknown"}
               {order.user_email && <span className="opacity-60 truncate">({order.user_email})</span>}
             </p>
           </div>
        </div>

        <div className="flex items-center gap-3">
          {canDownload && order.storage_path && (
            <button
              onClick={downloadStl}
              disabled={downloading}
              className="px-6 py-3 bg-white text-brand-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-brand-100 hover:bg-brand-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {downloading ? "Preparing..." : "Download STL"}
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className={`p-3 rounded-2xl transition-all ${expanded ? 'bg-slate-900 text-white shadow-xl' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
          >
            {expanded ? <XCircle className="w-5 h-5" /> : <MoreVertical className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 relative z-10">
        {[
          { label: "Material", val: `${order.material} (${order.color})`, icon: Layers },
          { label: "Quality", val: order.quality, icon: CircuitBoard },
          { label: "Cost", val: `₹${order.cost}`, icon: DollarSign },
          { label: "Submitted", val: new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), icon: Calendar },
        ].map(i => (
          <div key={i.label} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/30">
            <div className="flex items-center gap-2 mb-1.5">
              <i.icon className="w-3 h-3 text-slate-300" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{i.label}</p>
            </div>
            <p className="text-sm font-bold text-slate-700 truncate">{i.val || "-"}</p>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {expanded && canUpdateStatus && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-6 pt-6 border-t border-slate-100"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Queue", val: "queued", cls: "bg-slate-50 text-slate-600 hover:bg-slate-100" },
                { 
                  label: order.status === 'printing' ? "In Progress" : "Start Print", 
                  val: order.status === 'printing' ? "completed" : "printing", 
                  labelAlt: order.status === 'printing' ? "Mark Finished" : "Start Print",
                  cls: order.status === 'printing' ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "bg-blue-50 text-blue-600 hover:bg-blue-100" 
                },
                { label: "Completed", val: "completed", cls: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" },
                { label: "Reject", val: "rejected", cls: "bg-red-50 text-red-600 hover:bg-red-100" },
              ].map(b => (
                 <button
                   key={b.val}
                   disabled={updating || order.status === b.val || (b.val === 'completed' && order.status === 'completed')}
                   onClick={() => updateStatus(b.val)}
                   className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${b.cls} disabled:opacity-30 flex items-center justify-center gap-2`}
                 >
                   {updating && order.status !== b.val ? <Loader2 className="w-3 h-3 animate-spin"/> : null}
                   {b.labelAlt || b.label}
                 </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ── Material Management Panel (Lab/Admin) ── */
const MaterialManagementPanel: React.FC = () => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any | null>(null);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      setMaterials(await authService.getPrintMaterialsConfig());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMaterials(); }, []);

  const handleUpdate = async (mat: any) => {
    setSaving(true);
    try {
      await authService.updatePrintMaterialConfig(mat.id, {
        price_per_gram: Number(mat.price_per_gram),
        density: Number(mat.density),
        colors: mat.colors
      });
      setEditingMaterial(null);
      fetchMaterials();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Material Configuration</h1>
          <p className="text-sm font-bold text-slate-400 mt-1">Manage physical properties and billing rates for 3D prints.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {materials.map(mat => (
          <div key={mat.id} className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform">
                <Layers className="w-7 h-7" />
              </div>
              <button 
                onClick={() => setEditingMaterial(mat)}
                className="p-3 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-2xl transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
            
            <h3 className="text-2xl font-black text-slate-900 mb-6">{mat.name}</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Rate</span>
                <span className="font-mono font-bold text-brand-600 text-lg">₹{mat.price_per_gram} <span className="text-[10px] text-slate-400">/g</span></span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Density</span>
                <span className="font-mono font-bold text-slate-900 text-lg">{mat.density} <span className="text-[10px] text-slate-400">g/cm³</span></span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Colors</span>
                <div className="flex gap-1.5">
                  {mat.colors?.slice(0, 4).map((c: any) => (
                    <div key={c.name} className="w-4 h-4 rounded-full border border-slate-200 shadow-sm" style={{ background: c.hex }} title={c.name} />
                  ))}
                  {(mat.colors?.length || 0) > 4 && <span className="text-[10px] text-slate-400 font-bold ml-1">+{mat.colors.length - 4}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editingMaterial && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              
              <h2 className="text-3xl font-black text-slate-900 mb-2 relative z-10">Refine {editingMaterial.name}</h2>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8 relative z-10">Adjust Parameters</p>
              
              <div className="space-y-6 mb-10 relative z-10">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Price per Gram (₹)</label>
                  <input 
                    type="number" 
                    value={editingMaterial.price_per_gram} 
                    onChange={e => setEditingMaterial({...editingMaterial, price_per_gram: parseFloat(e.target.value)})}
                    className="w-full px-5 py-4 border border-slate-200 rounded-2xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand-400 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Density (g/cm³)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editingMaterial.density} 
                    onChange={e => setEditingMaterial({...editingMaterial, density: parseFloat(e.target.value)})}
                    className="w-full px-5 py-4 border border-slate-200 rounded-2xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand-400 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Colors (JSON)</label>
                  <textarea 
                    value={JSON.stringify(editingMaterial.colors)} 
                    onChange={e => {
                      try {
                        const colors = JSON.parse(e.target.value);
                        setEditingMaterial({...editingMaterial, colors});
                      } catch (err) {}
                    }}
                    rows={3}
                    className="w-full px-5 py-4 border border-slate-200 rounded-2xl text-[10px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-400 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="flex gap-4 relative z-10">
                <button 
                  onClick={() => setEditingMaterial(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition active:scale-95"
                >
                  Discard
                </button>
                <button 
                  onClick={() => handleUpdate(editingMaterial)}
                  disabled={saving}
                  className="flex-2 py-4 bg-brand-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-700 transition flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-95"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Add Staff Panel (Admin only) ── */
const AddStaffPanel: React.FC = () => {
  const ROLES: Role[] = ["LAB", "AMBASSADOR", "EVENT_MANAGER", "TECH_SUPPORT"];
  const [form, setForm] = useState({ name: "", email: "", role: "LAB" as Role });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError]   = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSuccess(""); setError("");
    try {
      const res = await fetch("/api/auth/create-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess(`Added ${form.email}. They can now sign in on the staff page with their Microsoft account.`);
      setForm({ name: "", email: "", role: "LAB" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Add Staff Member</h1>
      <p className="text-slate-500 text-sm mb-8">Add a staff member by their @reva.edu.in email and assign a portal role. They sign in with their REVA Microsoft account.</p>

      <form onSubmit={handleCreate} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-5">
        {success && <div className="bg-green-50 text-green-700 text-sm font-semibold p-3 rounded-xl flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}
        {error   && <div className="bg-red-50 text-red-600 text-sm font-semibold p-3 rounded-xl flex items-center gap-2"><XCircle className="w-4 h-4" />{error}</div>}

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
          <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="e.g. Priya Sharma" />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
          <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="staff@reva.edu.in" />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Role</label>
          <select value={form.role} onChange={e => setForm({...form, role: e.target.value as Role})}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
            {ROLES.map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
          </select>
        </div>

        <button type="submit" disabled={saving}
          className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserIcon className="w-4 h-4" />}
          {saving ? "Creating…" : "Create Staff Account"}
        </button>
      </form>
    </div>
  );
};

/* ── Staff Overview (Redesigned) ── */const UpcomingEventsCarousel: React.FC<{ events: any[] }> = ({ events }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  if (events.length === 0) return (
    <div className="bg-white rounded-[3rem] border border-slate-100 p-12 text-center text-slate-400 font-bold italic h-[340px] flex items-center justify-center">
      <div>
        <Calendar className="w-12 h-12 text-slate-100 mx-auto mb-4" />
        <p>No upcoming events</p>
      </div>
    </div>
  );

  const next = () => setCurrentIndex((currentIndex + 1) % events.length);
  const prev = () => setCurrentIndex((currentIndex - 1 + events.length) % events.length);

  const ev = events[currentIndex];

  return (
    <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden relative group h-[340px] flex flex-col md:flex-row">
       <div className="w-full md:w-1/2 relative h-48 md:h-full shrink-0 overflow-hidden bg-slate-50">
          {(ev.banner_url || ev.banner_image) ? (
            <img src={ev.banner_url || ev.banner_image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="banner" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-200 bg-brand-50">
              <ImageIcon className="w-12 h-12" />
            </div>
          )}
          <div className="absolute top-6 left-6">
            <span className="inline-block text-[10px] font-black uppercase px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md text-brand-600 border border-brand-100 shadow-sm">
              {ev.type || 'EVENT'}
            </span>
          </div>
       </div>

       <div className="p-8 flex flex-col flex-1">
          <div className="mb-4">
             <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black text-brand-500 uppercase tracking-[0.3em]">Featured Event</span>
                <span className={`w-2 h-2 rounded-full ${ev.status === 'upcoming' ? 'bg-emerald-500' : 'bg-brand-500'} animate-pulse`} />
             </div>
             <h3 className="text-2xl font-black text-slate-900 leading-tight tracking-tight uppercase line-clamp-2 mb-3">{ev.title}</h3>
             <div className="flex flex-wrap gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-brand-500" /> {ev.location || 'IDEA Lab'}</p>
                <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-brand-500" /> {ev.start_time || ev.time || '09:00 AM'}</p>
             </div>
          </div>
          
          <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Date</span>
                <span className="text-base font-black text-slate-900 uppercase tracking-tighter">
                   {new Date(ev.start_date || ev.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
             </div>
             <div className="flex gap-2">
                <button onClick={prev} className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all border border-transparent hover:border-brand-100 shadow-sm active:scale-95"><ChevronLeft className="w-5 h-5" /></button>
                <button onClick={next} className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all border border-transparent hover:border-brand-100 shadow-sm active:scale-95"><ChevronRight className="w-5 h-5" /></button>
             </div>
          </div>
       </div>
    </div>
  );
};

const StaffOverview: React.FC<{ 
  staff: StaffUser; 
  orders: any[]; 
  slots: any[]; 
  inventory: any[]; 
  events: any[]; 
  setActiveTab: (t: Tab) => void 
}> = ({ staff, orders, slots, inventory, events, setActiveTab }) => {
  const firstName = staff.name.split(" ")[0];
  const pendingOrders = orders.filter(o => o.status === "pending").length;
  const recentOrders = orders.slice(0, 5);
  const upcomingSlots = slots.slice(0, 5);
  const lowStock = inventory.filter(i => i.available_quantity < 5).slice(0, 5);
  const upcomingEvents = events.slice(0, 5);

  const stats = [
    { label: "Active Orders", value: orders.filter(o => o.status !== 'completed').length, icon: <Printer />, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pending Slots", value: slots.filter(s => s.status === 'pending').length, icon: <Clock />, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Total Assets", value: inventory.length, icon: <Package />, color: "text-brand-600", bg: "bg-brand-50" },
    { label: "Live Events", value: events.length, icon: <Calendar />, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* ── Welcome Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">System Panorama</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Welcome back, {firstName} • {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => window.location.reload()} className="p-3 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition shadow-sm group">
             <Activity className="w-5 h-5 text-slate-400 group-hover:text-brand-600" />
           </button>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
            <div className={`w-12 h-12 rounded-2xl ${s.bg} ${s.color} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
              {React.cloneElement(s.icon as any, { className: "w-6 h-6" })}
            </div>
            <p className="text-3xl font-black text-slate-900">{s.value}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ── RECENT ORDERS ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <HistoryIcon className="w-4 h-4 text-brand-600" /> Recent Activity
            </h3>
            <button onClick={() => setActiveTab('print_orders')} className="text-[10px] font-black text-brand-600 uppercase tracking-widest hover:underline">View All</button>
          </div>
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden min-h-[340px]">
            <div className="divide-y divide-slate-50">
              {recentOrders.length === 0 ? (
                <div className="p-24 text-center text-slate-400 font-bold italic">No recent activity detected.</div>
              ) : recentOrders.map((o, idx) => (
                <div key={o.id} className="p-5 flex items-center gap-4 hover:bg-slate-50/50 transition relative group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    o.status === 'completed' ? 'bg-green-50 text-green-600' : 
                    o.status === 'printing' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    <Printer className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate leading-none mb-1">{o.file_name || "Unknown Model"}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{o.user_name} • {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── UPCOMING EVENTS CAROUSEL ── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-600" /> Unified Event Horizon
            </h3>
            <button onClick={() => setActiveTab('events')} className="text-[10px] font-black text-brand-600 uppercase tracking-widest hover:underline">Full Schedule</button>
          </div>
          <UpcomingEventsCarousel events={events} />
        </div>

        {/* ── INVENTORY HEALTH ── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-500" /> Resource Matrix
            </h3>
          </div>
          <div className="bg-slate-900 rounded-[3rem] p-8 md:p-12 text-white shadow-2xl shadow-slate-900/20 flex flex-col md:flex-row items-center justify-between gap-8 min-h-[300px] overflow-hidden relative">
            <div className="relative z-10 flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Stock Health Index</p>
              <div className="flex items-baseline gap-2 mb-6">
                <h4 className="text-7xl font-black tracking-tighter">{Math.round((inventory.filter(i => i.available_quantity > 0).length / (inventory.length || 1)) * 100)}%</h4>
                <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 border border-green-500/20">
                  <Activity className="w-3 h-3" /> STABLE
                </div>
              </div>
              <p className="text-sm font-medium text-slate-400 leading-relaxed max-w-sm">
                Synchronizing {inventory.length} assets. 
                {lowStock.length > 0 ? ` WARNING: ${lowStock.length} items have breached safety thresholds.` : " All inventory levels are currently within optimal operational parameters."}
              </p>
            </div>
            
            <div className="relative z-10 w-full md:w-80 space-y-3">
              {lowStock.length === 0 ? (
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] text-center">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-300">All Systems Nominal</p>
                </div>
              ) : lowStock.map(item => (
                <div key={item.id} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{item.name}</p>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">{item.category}</p>
                  </div>
                  <span className="text-[10px] font-black text-red-400 bg-red-400/10 px-3 py-1 rounded-full border border-red-400/20">{item.available_quantity} UNITS</span>
                </div>
              ))}
            </div>

            {/* Decoration */}
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand-500/10 rounded-full blur-[100px]" />
          </div>
        </div>

      </div>

      {/* ── Quick Portal Actions ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
           { label: "Add Asset", icon: <Plus className="w-5 h-5" />, id: "inventory" },
           { label: "Post Event", icon: <Calendar className="w-5 h-5" />, id: "events" },
           { label: "Audit Logs", icon: <Shield className="w-5 h-5" />, id: "history" },
           { label: "New Project", icon: <Box className="w-5 h-5" />, id: "cms" },
        ].filter(a => NAV_ITEMS.find(item => item.id === a.id)?.roles.includes(staff.role?.toUpperCase() as Role)).map(act => (
          <button key={act.label} onClick={() => setActiveTab(act.id as Tab)}
            className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 hover:border-brand-500 hover:shadow-xl hover:shadow-brand-500/5 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center transition-transform group-hover:scale-110">
              {act.icon}
            </div>
            <span className="text-xs font-black text-slate-800 uppercase tracking-widest">{act.label}</span>
          </button>
        ))}
      </div>

    </div>
  );
};

/* ═══════════════════════════════════════ MAIN DASHBOARD ═══════════════════════════════════════ */
interface StaffDashboardProps {
  staff?: StaffUser | null;
}

const StaffDashboard: React.FC<StaffDashboardProps> = ({ staff: initialStaff }) => {
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffUser | null>(initialStaff ?? null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showMaterialsInPrints, setShowMaterialsInPrints] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [printOrders, setPrintOrders] = useState<any[]>([]);
  const [slots, setSlots] = useState<SlotBooking[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(!initialStaff);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>({});
  const [downloadingStlId, setDownloadingStlId] = useState<string | null>(null);
  const [approverName, setApproverName] = useState<string | null>(null);

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab") as Tab;
    if (tab && NAV_ITEMS.find(i => i.id === tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  const downloadStl = async (path: string, name: string, id: string) => {
    if (!path) return;
    setDownloadingStlId(id);
    try {
      const url = await authService.downloadPrintOrderStl(id);
      const a = document.createElement("a");
      a.href = url;
      a.download = name || "model.stl";
      a.click();
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloadingStlId(null);
    }
  };

  const fetchDashboardData = useCallback(async () => {
    setRefreshing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [orders, slotList, eventList, inventoryList] = await Promise.all([
        authService.getPrintOrders().catch(() => []),
        authService.getSlotRequests().catch(() => []),
        authService.getEvents().catch(() => []),
        authService.getInventory().catch(() => []),
      ]);

      // 1. Print orders (joined with file + requester by the API; stale ones cancelled there)
      setPrintOrders(orders);

      // 2. Upcoming slot bookings
      setSlots(
        (slotList as any[])
          .filter(s => (s.date ?? "") >= today)
          .sort((a, b) => String(a.date).localeCompare(String(b.date))) as any
      );

      // 3. Upcoming events
      setEvents(
        (eventList as any[])
          .filter(e => (e.start_date ?? "") >= today)
          .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
      );

      // 4. Inventory, lowest stock first
      setInventory(
        [...(inventoryList as any[])]
          .sort((a, b) => (a.available_quantity ?? 0) - (b.available_quantity ?? 0))
          .slice(0, 20)
      );

      // 5. Fetch History
      const hist = await authService.getHistory().catch(() => []);
      setHistory(hist);

    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  /* ── PRINT STATES ── */
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<any | null>(null);
  const [showPrintDetail, setShowPrintDetail] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let resolved: StaffUser | null = staff;

        if (!resolved) {
          // No prop — fall back to session fetch
          const session = await authService.getCurrentSession();
          if (!session.staff) { navigate("/staff-login"); return; }
          resolved = session.staff;
          setStaff(resolved);
        }

        const rawRole = resolved?.role || "";
        const role = rawRole.toUpperCase() as Role;
        const currentAllowed = NAV_ITEMS.filter(item => item.roles.includes(role)).map(item => item.id);
        await fetchDashboardData();
        if (!currentAllowed.includes(activeTab) && currentAllowed.length > 0) setActiveTab(currentAllowed[0]);
      } catch {
        navigate("/staff-login");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleStatusChange = async (id: string, status: string, fileName?: string) => {
    try {
      // The API records the activity log entry with the signed-in staff member.
      await authService.updatePrintOrderStatus(id, status);
      await fetchDashboardData();
      
      // Notify user (mock notification)
      console.log(`Notification sent to student: Your order "${fileName}" is now ${status}`);
      
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const logout = () => { authService.logout(); navigate("/"); };

  if (loading || !staff) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
      </div>
    );
  }

  const role = staff.role?.toUpperCase() as Role;
  const allowedTabItems = NAV_ITEMS.filter(item => item.roles.includes(role));
  const allowedTabs = allowedTabItems.map(item => item.id);
  const isLab   = staff?.role === "LAB" || staff?.role === "ADMIN";
  const isTech  = staff?.role === "TECH_SUPPORT" || staff?.role === "ADMIN";
  const isEvent = staff?.role === "EVENT_MANAGER" || staff?.role === "ADMIN";
  const isAdmin = staff?.role === "ADMIN";
  const filteredOrders = statusFilter === "all"
    ? printOrders
    : printOrders.filter(o => o.status === statusFilter);

  return (
    <div className="min-h-screen bg-slate-50 pt-16 flex flex-col md:flex-row">
      {/* ══ SIDEBAR ══ */}
      <aside className="hidden md:flex w-64 shrink-0">
        <div className="sticky top-16 h-[calc(100vh-4rem)] bg-white border-r border-slate-100 flex flex-col px-4 pt-6 pb-6 shadow-[10px_0_30px_rgba(0,0,0,0.02)]">

          {/* Logo */}
          <div className="px-2 mb-6">
            <Link to="/">
              <img src="/img/logo_orange_new.png" alt="REVA IDEA Lab" className="h-9 w-auto object-contain hover:opacity-80 transition-opacity" />
            </Link>
          </div>

          <div className="px-2 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 mb-1">
                  <UserIcon className="w-2.5 h-2.5 text-brand-500" />
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">{staff.role} ACCESS</p>
                </div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-tight truncate leading-none mb-1">{staff.name}</p>
                <p className="text-[10px] font-bold text-brand-600 uppercase tracking-tighter truncate leading-none">{staff.role}</p>
              </div>
            </div>
          </div>

          <nav className="space-y-0.5 flex-1">
            {NAV_ITEMS.filter(item => item.roles.includes(role)).map(tabItem => (
              <button
                key={tabItem.id}
                onClick={() => setActiveTab(tabItem.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tabItem.id
                    ? "bg-brand-50 text-brand-700 font-bold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span className={activeTab === tabItem.id ? "text-brand-600" : "text-slate-400"}>{tabItem.icon}</span>
                <span>{tabItem.label}</span>
                {tabItem.id === "print_orders" && printOrders.filter(o => o.status === "pending").length > 0 && (
                  <span className="ml-auto bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full px-2 py-0.5 min-w-5 text-center">
                    {printOrders.filter(o => o.status === "pending").length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div className="pt-6 border-t border-slate-100/50 mt-auto">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <main className="flex-1 min-w-0 pt-6 pb-24 md:pb-12 overflow-x-hidden">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10">

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && staff && (
            <StaffOverview 
              staff={staff} 
              orders={printOrders} 
              slots={slots} 
              inventory={inventory}
              events={events}
              setActiveTab={setActiveTab} 
            />
          )}

          {/* ── PRINT ORDERS ── */}
          {activeTab === "print_orders" && (
            <div className="space-y-12 pb-20">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-slate-100 pb-10">
                <div>
                  <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.3em] mb-2">Manufacturing Queue</p>
                  <h1 className="text-5xl font-light text-slate-900 tracking-tighter">3D Print Orders</h1>
                </div>
                <div className="flex items-center gap-3">
                  {["all", "pending", "printing", "completed"].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        statusFilter === s ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  <div className="w-px h-8 bg-slate-200 mx-2" />
                  <button 
                    onClick={() => setShowMaterialsInPrints(!showMaterialsInPrints)}
                    className={`p-3 rounded-xl transition-all ${showMaterialsInPrints ? 'bg-brand-600 text-white' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
                    title="Material Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {showMaterialsInPrints ? (
                <MaterialManagementPanel />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 {[
                   { label: "New Requests", val: printOrders.filter(o => o.status === 'pending').length, icon: Clock, color: "text-amber-500", bg: "bg-amber-50" },
                   { label: "Active Jobs", val: printOrders.filter(o => o.status === 'printing').length, icon: Loader2, color: "text-blue-500", bg: "bg-blue-50" },
                   { label: "Total Completed", val: printOrders.filter(o => o.status === 'completed').length, icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-50" },
                   { label: "Daily Throughput", val: "12", icon: Zap, color: "text-brand-600", bg: "bg-brand-50" }
                 ].map((s, i) => (
                   <div key={i} className={`p-6 rounded-[2rem] ${s.bg} border border-white/50 shadow-sm`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-2xl bg-white shadow-sm ${s.color}`}><s.icon className="w-5 h-5" /></div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
                      </div>
                      <p className="text-3xl font-light text-slate-900 tracking-tight">{s.val}</p>
                   </div>
                 ))}
              </div>

              {/* Table View */}
              <div className="bg-white rounded-[2.5rem] border border-slate-100/60 shadow-xl shadow-slate-200/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-50">
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Order Detail</th>
                        <th className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">User / Program</th>
                        <th className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Specifications</th>
                        <th className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                        <th className="pr-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredOrders.map(order => (
                        <tr 
                          key={order.id} 
                          onClick={async () => {
                            setSelectedPrintOrder(order); 
                            setShowPrintDetail(true); 
                            const name = await fetchOrderApprover(order.id);
                            setApproverName(name);
                          }}
                          className="group hover:bg-slate-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-white transition-colors">
                                <Printer className="w-6 h-6 text-slate-300 group-hover:text-brand-600" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900 tracking-tight truncate max-w-[150px]">{order.file_name || "Order"}</p>
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-0.5">{new Date(order.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                             <p className="text-sm font-medium text-slate-700">{order.user_name || "Student"}</p>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{order.user_program || "REVA University"}</p>
                          </td>
                          <td className="px-6 py-6 font-mono text-[10px] text-slate-500">
                             {order.material} · {order.infill}% · {order.color}
                          </td>
                          <td className="px-6 py-6">
                             <StatusBadge status={order.status} />
                          </td>
                          <td className="pr-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {order.storage_path && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); downloadStl(order.storage_path, order.file_name, order.id); }}
                                    disabled={downloadingStlId === order.id}
                                    className="p-2 text-slate-300 hover:text-brand-600 hover:bg-white rounded-xl transition-all shadow-sm shadow-transparent hover:shadow-slate-200"
                                    title="Download STL"
                                  >
                                    {downloadingStlId === order.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                  </button>
                                )}
                                <button className="p-2 text-slate-300 hover:text-brand-600 hover:bg-white rounded-xl transition-all shadow-sm shadow-transparent hover:shadow-slate-200">
                                  <MoreVertical className="w-5 h-5" />
                                </button>
                              </div>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredOrders.length === 0 && (
                     <div className="py-20 text-center">
                       <Printer className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                       <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No orders matching your criteria</p>
                     </div>
                  )}
                </div>
              </div>
                </>
              )}
            </div>
          )}

          {/* ── REQUESTS ── */}
          {activeTab === "requests" && (
            <RequestPanel />
          )}

          {/* ── EVENTS / EVENT MANAGEMENT ── */}
          {activeTab === "events" && (
            <div>
              {(isAdmin || staff?.role === "EVENT_MANAGER" || staff?.role === "LAB") ? (
                <EventManagerPanel
                  staffId={staff.id}
                  staffName={staff.name}
                  isAdmin={isAdmin}
                  role={staff.role}
                />
              ) : (
                <div>
                  <h1 className="text-2xl font-bold mb-6">Slot Bookings</h1>
                  {slots.length === 0 ? (
                    <EmptyState icon={<Calendar className="w-12 h-12" />} text="No slot bookings" />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {slots.map(s => (
                        <div key={s.id} className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
                          <div className="mb-6">
                            <div className="flex justify-between items-start mb-4">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.date}</span>
                              <StatusBadge status={s.status} />
                            </div>
                            <p className="font-black text-xl text-slate-900 mb-1">{s.userName}</p>
                            <p className="text-sm font-bold text-slate-500">{s.startTime} – {s.endTime}</p>
                            <div className="mt-4 p-4 bg-slate-50 rounded-2xl text-xs font-bold text-slate-600 leading-relaxed italic">
                              "{s.purpose}"
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-[10px] font-black text-slate-400">
                              <Users className="w-3 h-3" /> {s.attendees} ATTENDEES
                            </div>
                          </div>
                          
                          {s.status === 'pending' && isAdmin && (
                            <div className="flex gap-2">
                              <button 
                                onClick={async () => {
                                  await authService.updateSlotStatus(s.id, 'approved');
                                  setSlots(await authService.getSlotRequests());
                                }}
                                className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button 
                                onClick={async () => {
                                  const reason = prompt("Enter rejection reason:");
                                  if (reason) {
                                    await authService.updateSlotStatus(s.id, 'rejected', reason);
                                    setSlots(await authService.getSlotRequests());
                                  }
                                }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-2xl font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── HISTORY ── */}
          {activeTab === "history" && (
            <div>
              <h1 className="text-2xl font-bold mb-6">Activity History</h1>
              {history.length === 0 ? (
                <EmptyState icon={<HistoryIcon className="w-12 h-12" />} text="No history recorded" />
              ) : (
                <div className="space-y-3">
                  {history.map(h => (
                    <div key={h.id} className="bg-white border rounded-2xl p-4 shadow-sm">
                      <p className="font-bold text-sm">{h.action}</p>
                      <p className="text-xs text-slate-500">{h.actorName} · {h.timestamp}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PCB ORDERS (Lab + Admin) ── */}
          {activeTab === "pcb_orders" && isLab && <PcbOrdersPanel />}

          {/* ── SIGN-IN LOG (Admin + Tech) ── */}
          {activeTab === "sign_ins" && (isAdmin || role === "TECH_SUPPORT") && <SignInLogPanel />}

          {/* ── INVENTORY ── */}
          {activeTab === "inventory" && (
            <InventoryPanel />
          )}

          {/* ── USERS (Admin + Tech) ── */}
          {activeTab === "users" && (
            <UserManagementPanel 
              isAdmin={isAdmin}
              isTech={role === "TECH_SUPPORT"}
            />
          )}

          {/* ── ADD STAFF (Admin) ── */}
          {activeTab === "add_staff" && isAdmin && (
            <AddStaffPanel />
          )}

          {/* ── CMS (Ambassador + Admin) ── */}
          {activeTab === "cms" && staff && (
            <AmbassadorCMS
              staffId={staff.id}
              staffName={staff.name}
              isAdmin={isAdmin}
            />
          )}

          {/* ── SETTINGS (All roles) ── */}
          {activeTab === "settings" && staff && (
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-6">Account Settings</h1>
              <SettingsPanel
                user={staff}
                onUpdate={async data => {
                  await authService.updateStaffProfile({ ...staff, ...data });
                }}
              />
            </div>
          )}
        </div>
      </main>

      {/* ── PRINT DETAIL SIDESHEET ── */}
      <AnimatePresence>
        {showPrintDetail && selectedPrintOrder && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowPrintDetail(false); setApproverName(null); }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-[61] overflow-y-auto"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-10">
                  <div className="w-16 h-16 bg-brand-50 rounded-[2rem] flex items-center justify-center">
                    <Printer className="w-8 h-8 text-brand-600" />
                  </div>
                  <button 
                    onClick={() => { setShowPrintDetail(false); setApproverName(null); }}
                    className="p-3 hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="mb-10">
                  <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-2">Order Details</p>
                  <h2 className="text-4xl font-light text-slate-900 tracking-tighter mb-4">{selectedPrintOrder.file_name}</h2>
                  <StatusBadge status={selectedPrintOrder.status} />
                </div>

                {/* Approver & Payment Details */}
                {(approverName || (selectedPrintOrder.payment_method && selectedPrintOrder.payment_method.startsWith("Online:")) || selectedPrintOrder.cost) && (
                  <div className="p-6 bg-brand-50 rounded-[2rem] border border-brand-100 mb-8 space-y-4">
                    {approverName && (
                      <div>
                        <p className="text-[10px] font-black text-brand-600/60 uppercase tracking-widest mb-1">Confirmed By</p>
                        <p className="font-bold text-slate-800 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-brand-600" /> IDEALab Staff: {approverName}
                        </p>
                      </div>
                    )}
                    {((selectedPrintOrder.payment_method && selectedPrintOrder.payment_method.startsWith("Online:")) || selectedPrintOrder.cost) && (
                      <div className="flex gap-8">
                        {(selectedPrintOrder.payment_method && selectedPrintOrder.payment_method.startsWith("Online:")) && (
                          <div>
                            <p className="text-[10px] font-black text-brand-600/60 uppercase tracking-widest mb-1">Payment ID</p>
                            <p className="font-mono text-sm font-bold text-slate-800">{selectedPrintOrder.payment_method.replace("Online: ", "")}</p>
                          </div>
                        )}
                        {selectedPrintOrder.cost && (
                          <div>
                            <p className="text-[10px] font-black text-brand-600/60 uppercase tracking-widest mb-1">Amount Paid</p>
                            <p className="text-sm font-black text-slate-800">₹{selectedPrintOrder.cost}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-4 mb-10">
                  <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Material</p>
                    <p className="text-lg font-bold text-slate-800">{selectedPrintOrder.material}</p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Infill</p>
                    <p className="text-lg font-bold text-slate-800">{selectedPrintOrder.infill}%</p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Layer Height</p>
                    <p className="text-lg font-bold text-slate-800">{selectedPrintOrder.layer_height || "0.2"}mm</p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Support</p>
                    <p className="text-lg font-bold text-slate-800">{selectedPrintOrder.supports ? 'Required' : 'None'}</p>
                  </div>
                </div>

                {/* User Info */}
                <div className="p-6 border border-slate-100 rounded-[2.5rem] mb-10">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Requestor</p>
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400">
                        {selectedPrintOrder.user_name?.[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{selectedPrintOrder.user_name}</p>
                        <p className="text-xs text-slate-500">{selectedPrintOrder.user_program}</p>
                      </div>
                   </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4">Update Management</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { s: "queued", label: "Queue" },
                      { s: "printing", label: "Printing" },
                      { s: "completed", label: "Finished" }
                    ].map(item => (
                      <button
                        key={item.s}
                        className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          selectedPrintOrder.status === item.s 
                          ? 'bg-slate-900 text-white border-slate-900' 
                          : 'bg-white border border-slate-100 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {isLab && (
                    <div className="grid grid-cols-2 gap-3 mt-6">
                      <button 
                        onClick={() => handleStatusChange(
                          selectedPrintOrder.id, 
                          selectedPrintOrder.status === 'printing' ? 'completed' : 'printing', 
                          selectedPrintOrder.file_name
                        )}
                        className={`py-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 ${
                          selectedPrintOrder.status === 'printing' 
                          ? 'bg-amber-500 text-white hover:bg-amber-600' 
                          : selectedPrintOrder.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-600 cursor-not-allowed'
                            : 'bg-brand-600 text-white shadow-brand-500/20 hover:bg-brand-700'
                        }`}
                        disabled={selectedPrintOrder.status === 'completed'}
                      >
                        {selectedPrintOrder.status === 'printing' ? (
                          <><CheckCircle className="w-4 h-4" /> Finish</>
                        ) : selectedPrintOrder.status === 'completed' ? (
                          <><CheckCircle className="w-4 h-4" /> Done</>
                        ) : (
                          <><Printer className="w-4 h-4" /> Start</>
                        )}
                      </button>

                      {selectedPrintOrder.storage_path && (
                        <button 
                          onClick={() => downloadStl(selectedPrintOrder.storage_path, selectedPrintOrder.file_name, selectedPrintOrder.id)}
                          disabled={downloadingStlId === selectedPrintOrder.id}
                          className="py-5 rounded-3xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
                        >
                          {downloadingStlId === selectedPrintOrder.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <><Download className="w-4 h-4" /> Get STL</>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {selectedPrintOrder.status !== 'cancelled' && selectedPrintOrder.status !== 'pending_payment' && (
                    <div className="mt-4">
                      <button 
                        onClick={() => generateReceipt({ ...selectedPrintOrder, approverName }, { name: selectedPrintOrder.user_name, email: selectedPrintOrder.user_email })}
                        className="w-full py-4 rounded-3xl bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all hover:bg-slate-800"
                      >
                        <FileText className="w-4 h-4" /> Download Receipt
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Bottom Nav (Mobile Only) ── */}
      <BottomNav 
        activeId={activeTab}
        isStaff
        onTabChange={(id) => setActiveTab(id as Tab)}
        items={allowedTabItems
          .map(item => ({
            name: item.label,
            path: '#',
            icon: TAB_ICON_COMPONENTS[item.id] || Box,
            id: item.id
          }))
        }
      />
    </div>
  );
};

export default StaffDashboard;

/* ── Helpers ── */
const EmptyState: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-16 text-center">
    <div className="text-slate-200 mx-auto mb-4">{icon}</div>
    <p className="text-slate-400 font-bold">{text}</p>
  </div>
);

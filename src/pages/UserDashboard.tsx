// src/pages/UserDashboard.tsx
import React, { useEffect, useState, useRef } from "react";
import { X, LayoutDashboard, Printer, CircuitBoard, Calendar,
  Settings, LogOut, ChevronLeft, ChevronRight, Shield,
  ArrowRight, Zap, Clock, CheckCircle, XCircle,
  Loader2, GraduationCap, Cpu, Box, ClipboardList, UserCircle, Plus,
  Download
} from "lucide-react";
import { User, PrintOrder, PcbOrder, SlotBooking, Indent } from "../../types";
import { authService } from "../services/api";
import { payWithRazorpay } from "../utils/razorpay";
import { recoverPendingPayment, fetchOrderApprover } from "../utils/orderUtils";
import { generateReceipt } from "../utils/pdfGenerator";
import SettingsPanel from "../components/SettingsPanel";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import SlotBookingModal from "../components/SlotBookingModal";
import { avatarUrl } from "../utils/avatar";

interface Props { user?: User; }
type Section = "overview" | "prints" | "pcbs" | "bookings" | "indents" | "settings";

/* ── Status badge ── */
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending:   "bg-amber-50 text-amber-700 ring-amber-600/20",
    pending_payment: "bg-amber-50 text-amber-700 ring-amber-600/20",
    printing:  "bg-brand-50 text-brand-700 ring-brand-600/20",
    queued:    "bg-amber-50 text-amber-700 ring-amber-600/20",
    completed: "bg-green-50 text-green-700 ring-green-600/20",
    Paid:      "bg-blue-50 text-blue-700 ring-blue-600/20",
    rejected:  "bg-red-50 text-red-700 ring-red-600/20",
    approved:  "bg-blue-50 text-blue-700 ring-blue-600/20",
    active:    "bg-blue-50 text-blue-700 ring-blue-600/20",
    cancelled: "bg-red-50 text-red-700 ring-red-600/20",
  };
  const icon: Record<string, React.ReactNode> = {
    pending:   <Clock className="h-3 w-3" aria-hidden="true" />,
    pending_payment: <Clock className="h-3 w-3" aria-hidden="true" />,
    printing:  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />,
    completed: <CheckCircle className="h-3 w-3" aria-hidden="true" />,
    Paid:      <CheckCircle className="h-3 w-3" aria-hidden="true" />,
    rejected:  <XCircle className="h-3 w-3" aria-hidden="true" />,
    approved:  <CheckCircle className="h-3 w-3" aria-hidden="true" />,
    cancelled: <XCircle className="h-3 w-3" aria-hidden="true" />,
  };
  const labelMap: Record<string, string> = {
    pending_payment: "Waiting",
    Paid: "Paid"
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-700 ring-slate-600/10";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${cls}`}>
      {icon[status]} {labelMap[status] || status}
    </span>
  );
};

/* ── Horizontal carousel ── */
const Carousel: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode[]; onMore?: () => void }> = ({ title, icon, children, onMore }) => {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 280, behavior: "smooth" });

  if (children.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-900">{icon}{title}</h3>
        <div className="flex items-center gap-1">
          {onMore && <button onClick={onMore} className="mr-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4">View all <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>}
          <button onClick={() => scroll(-1)} aria-label="Scroll left" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
          <button onClick={() => scroll(1)} aria-label="Scroll right" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </div>
      <div ref={ref} className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x">
        {children}
      </div>
    </div>
  );
};

/* ── Order card (carousel item) ── */
const OrderCard = ({ item, type }: { item: any; type: string }) => (
  <div className="snap-start shrink-0 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
    <div className="mb-3 flex items-start justify-between">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
        type === "print" ? "bg-brand-50" : type === "pcb" ? "bg-blue-50" : "bg-slate-100"
      }`}>
        {type === "print" ? <Printer className="h-5 w-5 text-brand-600" aria-hidden="true" /> :
         type === "pcb"   ? <CircuitBoard className="h-5 w-5 text-blue-600" aria-hidden="true" /> :
                            <Calendar className="h-5 w-5 text-slate-600" aria-hidden="true" />}
      </div>
      <StatusBadge status={item.status || "pending"} />
    </div>
    <p className="mb-1 truncate text-sm font-semibold text-slate-900">
      {item.file_name || item.fileName || item.title || `#${item.id?.slice(0,6) ?? "Order"}`}
    </p>
    <p className="text-xs text-slate-500">
      {item.created_at || item.submitDate
        ? new Date(item.created_at || item.submitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        : "—"}
    </p>
    {item.cost && (
      <p className="mt-2 text-sm font-semibold text-brand-600">₹{item.cost}</p>
    )}
  </div>
);

/* ── Quick action card ── */
const QuickAction = ({ icon, label, desc, color, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-start rounded-xl border p-5 text-left shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 ${color}`}
  >
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50" aria-hidden="true">{icon}</div>
    <p className="text-sm font-semibold">{label}</p>
    <p className="mt-0.5 text-sm text-slate-500">{desc}</p>
  </button>
);

/* ═══════════════ MAIN COMPONENT ═══════════════ */
export const UserDashboard: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [active, setActive] = useState<Section>("overview");
  const [prints, setPrints] = useState<any[]>([]);
  const [pcbs, setPcbs] = useState<PcbOrder[]>([]);
  const [slots, setSlots] = useState<SlotBooking[]>([]);
  const [indents, setIndents] = useState<Indent[]>([]);
  const isGuest = user?.type === "non-university" || (user?.email && !user.email.toLowerCase().endsWith("@reva.edu.in"));
  const [counts, setCounts] = useState({ prints: 0, pcbs: 0, slots: 0, indents: 0 });
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<any | null>(null);
  const [showPrintDetail, setShowPrintDetail] = useState(false);
  const [approverName, setApproverName] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    // Finish any payment whose confirmation was interrupted before reading orders.
    await recoverPendingPayment();
    const printList = await authService.getPrintOrders().catch(() => []);
    setPrints(printList);
    const pcbList = await authService.getPcbOrders().catch(() => []);

    // /api/slots returns only this user's bookings for students.
    const slotList = await authService.getSlotRequests().catch(() => []);
    
    const indentList = !isGuest ? await authService.getIndents().catch(() => []) : [];
    
    setPcbs(pcbList);
    setSlots(slotList);
    setIndents(indentList);
    setCounts({
      prints: printList.length,
      pcbs: pcbList.length,
      slots: slotList.length,
      indents: indentList.length
    });
  };

  // Slot bookings: students cancel their own upcoming booking (frees the time slot).
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<string | null>(null);
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const cancelBooking = async (id: string) => {
    if (!confirm("Cancel this lab booking? The time slot will be freed for others.")) return;
    setRowBusy(id);
    setRowMessage(null);
    try {
      await authService.cancelSlotBooking(id);
      await loadData();
    } catch (err: any) {
      setRowMessage(err.message || "Could not cancel the booking.");
    } finally {
      setRowBusy(null);
    }
  };
  // PCB orders placed with "Pay Online" that were not paid yet (they expire after 30 minutes).
  const payPcbOrder = async (order: any) => {
    setRowBusy(order.id);
    setRowMessage(null);
    try {
      const checkout = await authService.createPcbPaymentOrder(order.id);
      const result = await payWithRazorpay(checkout, { description: `PCB fabrication: ${order.fileName}`, name: user?.name, email: user?.email });
      if (result.outcome === "failed") setRowMessage(`Payment failed: ${result.message}`);
      if (result.outcome === "unconfirmed") setRowMessage("Payment received. Confirmation is taking longer than usual.");
      await loadData();
    } catch (err: any) {
      setRowMessage(err.message || "Could not start the payment.");
    } finally {
      setRowBusy(null);
    }
  };

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab") as Section;
    if (tab && ["overview", "prints", "pcbs", "bookings", "indents", "settings"].includes(tab)) {
      setActive(tab);
    }
  }, [location.search]);

  useEffect(() => { loadData(); }, [user]);

  const nav = [
    { id: "overview",  icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard" },
    { id: "prints",    icon: <Printer className="w-4 h-4" />,         label: "3D Prints",     badge: counts.prints },
    { id: "pcbs",      icon: <CircuitBoard className="w-4 h-4" />,    label: "PCB Orders",    badge: counts.pcbs },
    // Lab slot booking is for REVA students (the server refuses general-access accounts).
    ...(!isGuest ? [{ id: "bookings", icon: <Calendar className="w-4 h-4" />, label: "Slot Bookings", badge: counts.slots }] : []),
    ...(!isGuest ? [{ id: "indents", icon: <Box className="w-4 h-4" />, label: "Inventory", badge: counts.indents }] : []),
    { id: "settings",  icon: <Settings className="w-4 h-4" />,        label: "Settings" },
  ] as const;

  const firstName = user?.name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 pt-16 md:flex-row">
      {/* ── Sidebar ── */}
      <aside className="hidden md:flex w-64 shrink-0">
        <div className="sticky top-16 flex h-[calc(100vh-4rem)] w-full flex-col border-r border-slate-200 bg-white px-4 py-6">

          <div className="px-2 mb-6">
            <div className="flex items-center gap-3">
              <img
                src={user?.avatar || avatarUrl(user?.name || "U", '#f97316')}
                alt={user?.name}
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
                <p className="truncate text-xs text-slate-500">{user?.degree || user?.email}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {nav.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setActive(item.id as Section);
                }}
                aria-current={active === item.id ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active === item.id
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className={active === item.id ? "text-brand-600" : "text-slate-400"} aria-hidden="true">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {(item as any).badge > 0 && (
                  <span className="min-w-[1.25rem] rounded-full bg-brand-100 px-1.5 py-0.5 text-center text-xs font-medium text-brand-700">
                    {(item as any).badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div className="mt-auto border-t border-slate-200 pt-4">
            <button
              onClick={() => { authService.logout(); navigate("/"); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 min-w-0 pt-8 pb-24 md:pb-12 overflow-x-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
          >
            {/* ──────── OVERVIEW ──────── */}
            {active === "overview" && (
              <div>
                {/* Hero */}
                <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <p className="text-sm font-semibold text-brand-600">{greeting} 👋</p>
                  <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{firstName}</h1>
                  {user?.program && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                      <GraduationCap className="h-4 w-4" aria-hidden="true" /> {user.degree} · {user.program}
                    </p>
                  )}
                  {/* Active Order Status Carousel */}
                  {(() => {
                    const stageConfig: Record<string, { message: string; icon: React.ReactNode; progress: number }> = {
                      pending_payment: { message: "Awaiting payment confirmation", icon: <Clock className="w-5 h-5" />, progress: 10 },
                      Paid: { message: "Payment received – queued for processing", icon: <CheckCircle className="w-5 h-5" />, progress: 25 },
                      queued: { message: "In queue – your turn is coming up", icon: <ClipboardList className="w-5 h-5" />, progress: 30 },
                      pending: { message: "Pending review by lab staff", icon: <Clock className="w-5 h-5" />, progress: 20 },
                      printing: { message: "Your model is being printed now!", icon: <Loader2 className="w-5 h-5 animate-spin" />, progress: 60 },
                      processing: { message: "Fabrication in progress", icon: <Loader2 className="w-5 h-5 animate-spin" />, progress: 60 },
                      completed: { message: "Ready! Collect from the lab. Carry your receipt.", icon: <CheckCircle className="w-5 h-5" />, progress: 100 },
                      rejected: { message: "Order was rejected. Check details.", icon: <XCircle className="w-5 h-5" />, progress: 0 },
                      cancelled: { message: "This order was cancelled.", icon: <XCircle className="w-5 h-5" />, progress: 0 },
                      approved: { message: "Approved! Processing will begin shortly.", icon: <CheckCircle className="w-5 h-5" />, progress: 40 },
                    };

                    const activeOrders = [
                      ...prints.filter(p => !['cancelled', 'rejected'].includes(p.status)).map(p => ({ ...p, _type: 'print' as const })),
                      ...pcbs.filter(p => !['cancelled', 'rejected'].includes(p.status)).map(p => ({ ...p, _type: 'pcb' as const })),
                    ].sort((a, b) => new Date(b.created_at || b.submitDate).getTime() - new Date(a.created_at || a.submitDate).getTime())
                    .slice(0, 1);

                    if (activeOrders.length === 0) return (
                      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { label: "3D Print", count: prints.length, action: () => navigate("/3d-print"), icon: <Printer className="h-5 w-5" /> },
                          { label: "PCB Order", count: pcbs.length, action: () => navigate("/pcb-order"), icon: <CircuitBoard className="h-5 w-5" /> },
                          ...(!isGuest ? [{ label: "Book Slot", count: slots.length, action: () => setIsBookingModalOpen(true), icon: <Calendar className="h-5 w-5" /> }] : []),
                        ].map(s => (
                          <button
                            key={s.label}
                            onClick={s.action}
                            className="rounded-xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                          >
                            <div className="mb-2 text-brand-500" aria-hidden="true">{s.icon}</div>
                            <p className="font-display text-2xl sm:text-3xl font-semibold text-slate-900">{s.count}</p>
                            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
                          </button>
                        ))}
                      </div>
                    );

                    return (
                      <div className="mt-6">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Active Orders</p>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
                          {activeOrders.map((order, idx) => {
                            const stage = stageConfig[order.status] || stageConfig.pending;
                            const isPrint = order._type === 'print';
                            const accentColor = isPrint ? "text-brand-600" : "text-blue-600";
                            const barColor = isPrint ? "bg-brand-500" : "bg-blue-500";
                            const dotColor = isPrint ? "bg-brand-500" : "bg-blue-500";

                            return (
                              <motion.div
                                key={order.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, ease: "easeOut", delay: Math.min(idx * 0.05, 0.3) }}
                                className="snap-start shrink-0 w-56 cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                                onClick={() => {
                                  if (isPrint) { setSelectedPrintOrder(order); setShowPrintDetail(true); }
                                  else setActive("pcbs");
                                }}
                              >
                                {/* Card Header */}
                                <div className="mb-3 flex items-center justify-between">
                                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isPrint ? 'bg-brand-50' : 'bg-blue-50'}`}>
                                    {isPrint ? <Printer className={`h-4 w-4 ${accentColor}`} aria-hidden="true" /> : <CircuitBoard className={`h-4 w-4 ${accentColor}`} aria-hidden="true" />}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
                                    <span className="text-xs font-medium capitalize text-slate-500">{order.status === 'pending_payment' ? 'Waiting' : order.status}</span>
                                  </div>
                                </div>

                                {/* File Name */}
                                <p className="mb-1 truncate text-sm font-semibold text-slate-900">{order.file_name || order.fileName || `#${order.id?.slice(0,6)}`}</p>

                                {/* Stage Message */}
                                <p className="mb-3 line-clamp-2 text-xs leading-tight text-slate-600">{stage.message}</p>

                                {/* Progress Bar */}
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stage.progress}%` }}
                                    transition={{ duration: 0.6, delay: Math.min(idx * 0.05, 0.3), ease: "easeOut" }}
                                    className={`h-full ${barColor} rounded-full`}
                                  />
                                </div>

                                {/* Cost */}
                                {order.cost && (
                                  <p className={`mt-2 text-xs font-semibold ${accentColor}`}>INR {order.cost}</p>
                                )}
                              </motion.div>
                            );
                          })}

                          {/* Add New Card */}
                          <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, delay: Math.min(activeOrders.length * 0.05, 0.3) }}
                            onClick={() => navigate("/3d-print")}
                            className="snap-start shrink-0 w-56 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-4 text-slate-500 transition-colors hover:border-brand-500 hover:bg-brand-50/50 hover:text-brand-600"
                          >
                            <Plus className="mb-2 h-6 w-6" aria-hidden="true" />
                            <span className="text-xs font-semibold uppercase tracking-wider">New Order</span>
                          </motion.button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Quick Actions */}
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Services</h2>
                <div className={`grid grid-cols-2 ${isGuest ? 'md:grid-cols-2' : 'md:grid-cols-4'} gap-4 mb-12`}>
                  <QuickAction icon={<Printer className="h-5 w-5 text-brand-600" />} label="3D Print" desc="PLA, ABS, PETG" color="border-slate-200 bg-white text-slate-900" onClick={() => navigate("/3d-print")} />
                  <QuickAction icon={<CircuitBoard className="h-5 w-5 text-brand-600" />} label="PCB Fab" desc="Rapid prototype" color="border-slate-200 bg-white text-slate-900" onClick={() => navigate("/pcb-order")} />
                  {!isGuest && <QuickAction icon={<Calendar className="h-5 w-5 text-brand-600" />} label="Slot" desc="Lab reservation" color="border-slate-200 bg-white text-slate-900" onClick={() => setIsBookingModalOpen(true)} />}
                  {!isGuest && <QuickAction icon={<Zap className="h-5 w-5 text-brand-600" />} label="Borrow" desc="Get components" color="border-slate-200 bg-white text-slate-900" onClick={() => navigate("/components")} />}
                </div>

                {/* Carousels */}
                {prints.length > 0 && (
                  <Carousel title="3D Print Orders" icon={<Printer className="h-5 w-5 text-brand-500" aria-hidden="true" />} onMore={() => setActive("prints")}>
                    {prints.slice(0, 6).map(p => <OrderCard key={p.id} item={p} type="print" />)}
                  </Carousel>
                )}
                {pcbs.length > 0 && (
                  <Carousel title="PCB Orders" icon={<CircuitBoard className="h-5 w-5 text-blue-600" aria-hidden="true" />} onMore={() => setActive("pcbs")}>
                    {pcbs.slice(0, 6).map(p => <OrderCard key={p.id} item={p} type="pcb" />)}
                  </Carousel>
                )}
                {slots.length > 0 && (
                  <Carousel title="Slot Bookings" icon={<Calendar className="h-5 w-5 text-slate-500" aria-hidden="true" />} onMore={() => setActive("bookings")}>
                    {slots.slice(0, 6).map(s => <OrderCard key={s.id} item={s} type="slot" />)}
                  </Carousel>
                )}

                {prints.length === 0 && pcbs.length === 0 && slots.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <Cpu className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <p className="text-base font-semibold text-slate-900">No activity yet</p>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">Start with a 3D print or PCB order</p>
                    <button
                      onClick={() => navigate("/3d-print")}
                      className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Start Printing →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ──────── ORDERS LIST ──────── */}
            {["prints", "pcbs", "bookings", "indents"].includes(active) && (
              <div className="pb-10">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">Activity Tracking</p>
                    <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                      {active === "prints" ? "3D Print Orders" : active === "pcbs" ? "PCB Orders" : active === "bookings" ? "Slot Bookings" : "Component Indents"}
                    </h1>
                  </div>
                  <button
                    onClick={() => {
                      if (active === "prints") navigate("/3d-print");
                      else if (active === "pcbs") navigate("/pcb-order");
                      else if (active === "bookings") setIsBookingModalOpen(true);
                      else if (active === "indents") navigate("/components");
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New {active === "prints" ? "Print" : active === "pcbs" ? "PCB Order" : active === "bookings" ? "Booking" : "Indent"}
                  </button>
                </div>

                {(() => {
                  const items = active === "prints" ? prints : active === "pcbs" ? pcbs : active === "bookings" ? slots : indents;
                  if ((items as any[]).length === 0) return (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        {active === "prints" ? <Printer className="h-6 w-6" aria-hidden="true" /> : <Box className="h-6 w-6" aria-hidden="true" />}
                      </div>
                      <p className="text-base font-semibold text-slate-900">Nothing found here yet</p>
                    </div>
                  );
                  return (
                    <div className="grid grid-cols-1 gap-3">
                      {rowMessage && (
                        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{rowMessage}</div>
                      )}
                      {(items as any[]).map(item => (
                        <div key={item.id} className="group flex flex-col items-start justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 sm:flex-row sm:items-center">
                          <div className="flex min-w-0 max-w-full items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-brand-50 group-hover:text-brand-600">
                              {active === "prints" ? <Printer className="h-5 w-5" aria-hidden="true" /> : <Box className="h-5 w-5" aria-hidden="true" />}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{active === "bookings" ? (item.purpose || "Lab booking") : (item.file_name || item.fileName || item.title || item.projectTitle || `Order #${item.id?.slice(0,6)}`)}</p>
                              {active === "bookings" && item.date && (
                                <p className="mt-0.5 text-xs font-medium text-slate-700">
                                  {new Date(item.date + "T00:00:00").toLocaleDateString("en-IN", { dateStyle: "medium" })}
                                  {item.start_time && item.end_time ? ` · ${item.start_time}–${item.end_time}` : " · Full day"}
                                </p>
                              )}
                              {active === "pcbs" && (
                                <p className={`mt-0.5 text-xs font-medium ${item.paymentStatus === "paid" ? "text-green-700" : "text-amber-700"}`}>
                                  {item.paymentStatus === "paid" ? "Paid" : item.status === "pending_payment" ? "Awaiting online payment" : item.status === "cancelled" ? "Not paid" : "To pay at the lab"}
                                </p>
                              )}
                              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                <p className="text-xs text-slate-500">
                                  {item.created_at || item.submitDate || item.requestDate
                                    ? new Date(item.created_at || item.submitDate || item.requestDate).toLocaleDateString("en-IN", { dateStyle: "medium" })
                                    : ""}
                                </p>
                                {item.cost && <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />}
                                {item.cost && <p className="text-xs font-semibold text-brand-600">₹{item.cost}</p>}
                                {item.material && <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />}
                                {item.material && <p className="text-xs text-slate-500">{item.material}</p>}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 sm:mt-0 flex items-center justify-between gap-4 w-full sm:w-auto sm:justify-end self-end sm:self-center">
                            <StatusBadge status={item.status || "pending"} />
                            {active === "bookings" && ["pending", "approved"].includes(item.status) && item.date >= todayIso && (
                              <button
                                onClick={() => cancelBooking(item.id)}
                                disabled={rowBusy === item.id}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {rowBusy === item.id ? "Cancelling…" : "Cancel"}
                              </button>
                            )}
                            {active === "pcbs" && item.status === "pending_payment" && item.paymentStatus !== "paid" && (
                              <button
                                onClick={() => payPcbOrder(item)}
                                disabled={rowBusy === item.id}
                                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                              >
                                {rowBusy === item.id ? "Opening…" : "Pay now"}
                              </button>
                            )}
                            <button 
                              onClick={async () => {
                                if (active === "prints") {
                                  setSelectedPrintOrder(item);
                                  setShowPrintDetail(true);
                                  const name = await fetchOrderApprover(item.id);
                                  setApproverName(name);
                                }
                              }}
                              className={`${active === "prints" ? "flex" : "hidden sm:flex"} items-center gap-1 py-2 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4`}
                            >
                              View <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ──────── SETTINGS ──────── */}
            {active === "settings" && user && (
              <div>
                <h1 className="mb-6 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Account Settings</h1>
                <SettingsPanel
                  user={user}
                  onUpdate={async data => { await authService.updateProfile({ ...user, ...data }); }}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── PRINT DETAIL SIDESHEET ── */}
      <AnimatePresence>
        {showPrintDetail && selectedPrintOrder && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => { setShowPrintDetail(false); setApproverName(null); }}
              className="fixed inset-0 z-[60] bg-slate-900/50"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              role="dialog"
              aria-modal="true"
              className="fixed inset-y-0 right-0 z-[110] w-full max-w-lg overflow-y-auto border-l border-slate-200 bg-white shadow-xl"
            >
              <div className="p-6 sm:p-8 pb-32 sm:pb-8">
                <div className="mb-8 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Printer className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <button
                    onClick={() => { setShowPrintDetail(false); setApproverName(null); }}
                    aria-label="Close"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="mb-8">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">Order Details</p>
                  <h2 className="mt-2 mb-4 break-words font-display text-2xl font-semibold tracking-tight text-slate-900">{selectedPrintOrder.file_name}</h2>
                  <StatusBadge status={selectedPrintOrder.status} />
                </div>

                {/* Approver & Payment Details */}
                {(approverName || selectedPrintOrder.payment_method) && (
                  <div className="mb-8 space-y-4 rounded-xl border border-brand-100 bg-brand-50 p-5">
                    {approverName && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-700">Confirmed By</p>
                        <p className="flex items-center gap-2 font-semibold text-slate-900">
                          <Shield className="h-4 w-4 text-brand-600" aria-hidden="true" /> IDEALab Staff: {approverName}
                        </p>
                      </div>
                    )}
                    {(selectedPrintOrder.payment_method && selectedPrintOrder.payment_method.startsWith("Online:")) && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-700">Payment ID</p>
                        <p className="break-all font-mono text-sm font-semibold text-slate-900">{selectedPrintOrder.payment_method.replace("Online: ", "")}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Specs Grid */}
                <div className="mb-8 grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Material</p>
                    <p className="text-base font-semibold text-slate-900">{selectedPrintOrder.material}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Infill</p>
                    <p className="text-base font-semibold text-slate-900">{selectedPrintOrder.infill}%</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Weight</p>
                    <p className="text-base font-semibold text-slate-900">{selectedPrintOrder.weight ? `${Math.round(selectedPrintOrder.weight)}g` : "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Amount Paid</p>
                    <p className="text-base font-semibold text-brand-600">{selectedPrintOrder.cost ? `₹${selectedPrintOrder.cost}` : "—"}</p>
                  </div>
                </div>

                {/* Receipt Download Action */}
                {selectedPrintOrder.status !== 'cancelled' && selectedPrintOrder.status !== 'pending_payment' && (
                  <button
                    onClick={() => generateReceipt({ ...selectedPrintOrder, approverName }, user)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-5 w-5" aria-hidden="true" /> Download Receipt
                  </button>
                )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Bottom Nav (Mobile Only) ── */}
      <BottomNav 
        activeId={active}
        onTabChange={(id) => {
          setActive(id as Section);
        }}
        items={[
          { name: 'Home', path: '#', icon: LayoutDashboard, id: 'overview' },
          { name: 'Prints', path: '#', icon: Printer, id: 'prints' },
          { name: 'PCB', path: '#', icon: CircuitBoard, id: 'pcbs' },
          { name: 'Booking', path: '#', icon: Calendar, id: 'bookings' },
          { name: 'Settings', path: '#', icon: UserCircle, id: 'settings' }
        ] as any}
      />

      <SlotBookingModal 
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        user={user}
        onSuccess={() => {
          setIsBookingModalOpen(false);
          loadData();
        }}
      />
    </div>
  );
};

export default UserDashboard;

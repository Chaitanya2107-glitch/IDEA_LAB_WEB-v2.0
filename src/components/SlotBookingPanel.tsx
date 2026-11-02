import React, { useState, useEffect, useMemo } from "react";
import { 
  Calendar, Clock, User,
  Clock3, Plus, Search, Filter, Loader2,
  CheckSquare, ListTodo
} from "lucide-react";
import { SlotBooking } from "../../types";
import { authService } from "../services/api";
import { motion, AnimatePresence } from "framer-motion";

/* ==========================================================================
   SUB-COMPONENTS
   ========================================================================== */

const QuickStats: React.FC<{ items: SlotBooking[] }> = ({ items }) => {
  const approved = items.filter(i => i.status === 'approved').length;
  const pending = items.filter(i => i.status === 'pending').length;
  const totalSlots = items.length;
  
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[
        {
          label: "Total Bookings",
          val: totalSlots,
          icon: ListTodo
        },
        {
          label: "Approved Slots",
          val: approved,
          icon: CheckSquare
        },
        {
          label: "Active Requests",
          val: pending,
          icon: Clock3
        }
      ].map((s, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: Math.min(i * 0.05, 0.3) }}
          className="rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <s.icon className="h-5 w-5" aria-hidden="true" />
          </div>

          <div>
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 font-display text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900">{s.val}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const SlotBookingPanel: React.FC<{ onBookClick: () => void, initialSearch?: string }> = ({ onBookClick, initialSearch = "" }) => {
  const [items, setItems] = useState<SlotBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await authService.getSlotRequests();
      setItems(data || []);
    } catch (err) {
      console.error("Error loading slots:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.purpose?.toLowerCase().includes(search.toLowerCase()) ||
        item.date?.includes(search);
      const matchesFilter = filter === "All" || item.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [items, search, filter]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'bg-blue-50 text-blue-700 ring-blue-600/20';
      case 'rejected': return 'bg-red-50 text-red-700 ring-red-600/20';
      default: return 'bg-amber-50 text-amber-700 ring-amber-600/20';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">Resource Scheduler</p>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Slot Registry</h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">Manage and monitor lab equipment availability and user bookings in real-time.</p>
        </div>

        <button
          onClick={onBookClick}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Initiate Booking</span>
        </button>
      </div>

      <QuickStats items={items} />

      {/* Main Registry */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Controls */}
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search registry by date or purpose..."
              aria-label="Search registry by date or purpose"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span className="text-sm font-medium text-slate-700">Filter</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {["All", "pending", "approved", "rejected"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`rounded-full border px-3 py-1 text-sm font-medium capitalize ${
                    filter === f
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table/List */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Date & Temporal Slot</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Project Purpose</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Quota</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Auth Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3" role="status">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden="true" />
                        <p className="text-sm text-slate-500">Syncing Cryptographic Registry</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Calendar className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <p className="mt-1 max-w-sm text-sm text-slate-500">No booking protocols match your current parameters. Try adjusting your filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, i) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                             <Clock className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="flex flex-col">
                            <span className="whitespace-nowrap font-medium text-slate-900">{item.date}</span>
                            <span className="whitespace-nowrap text-xs tabular-nums text-slate-500">{item.startTime} — {item.endTime}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-sm flex-col gap-1">
                          <span className="text-slate-700">{item.purpose}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                           <User className="h-4 w-4 text-slate-400" aria-hidden="true" />
                           <span className="whitespace-nowrap tabular-nums text-slate-700">{item.attendees} <span className="text-xs text-slate-500">pax</span></span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${getStatusColor(item.status || 'pending')}`}>
                          {item.status || 'pending'}
                        </span>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
            <p className="text-xs text-slate-500">System Node: REVA-IDEA-LAB-PROD</p>
          </div>
          <p className="text-xs text-slate-500">Vaulted Entries: {filteredItems.length}</p>
        </div>
      </div>
    </div>
  );
};

export default SlotBookingPanel;

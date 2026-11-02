import React, { useEffect, useState } from "react";
import { 
  Inbox, CheckCircle, XCircle, Clock, User, 
  Package, Search, Filter, Loader2, ArrowRight,
  ClipboardList, AlertCircle, FileText
} from "lucide-react";
import { authService } from "../../services/api";
import { motion, AnimatePresence } from "framer-motion";

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { cls: string, icon: any }> = {
    pending:  { cls: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
    approved: { cls: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
    rejected: { cls: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
    active:   { cls: "bg-blue-100 text-blue-700 border-blue-200", icon: ArrowRight },
    returned: { cls: "bg-slate-100 text-slate-600 border-slate-200", icon: Package },
  };
  const config = map[status] || map.pending;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${config.cls}`}>
      <Icon className="w-3 h-3" /> {status}
    </span>
  );
};

const RequestPanel: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await authService.getIndents();
      setRequests(data || []);
    } catch (err) {
      console.error("Failed to load requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    const matchesSearch = (r.item_name || "").toLowerCase().includes(search.toLowerCase()) || 
                          (r.requested_by || "").toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || r.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.4em] mb-2">Resource Acquisition</p>
          <h1 className="text-4xl font-light text-slate-900 tracking-tight flex items-center gap-3">
             Indents & Requests <ClipboardList className="w-8 h-8 text-brand-600" />
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-lg">
            Manage material and component indents from students and staff. Track approval status and utilization.
          </p>
        </div>
        
        {/* Stats Row */}
        <div className="flex gap-3">
          {[
            { label: "Pending", count: requests.filter(r => r.status === 'pending').length, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Approved", count: requests.filter(r => r.status === 'approved').length, color: "text-green-600", bg: "bg-green-50" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} px-4 py-2 rounded-2xl border border-white shadow-sm flex items-center gap-3`}>
              <span className={`text-xl font-black ${s.color}`}>{s.count}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTROLS ── */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-[2rem] p-4 flex flex-col md:flex-row gap-4 items-center shadow-lg shadow-slate-200/20">
        <div className="flex-1 relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by item or requester..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-400"
          />
        </div>
        <div className="flex bg-slate-50 p-1.5 rounded-2xl shrink-0">
          {["all", "pending", "approved", "rejected"].map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === t ? "bg-white text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── LIST ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredRequests.map((r) => (
            <motion.div
              layout
              key={r.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group bg-white/60 backdrop-blur-sm border border-slate-100/50 rounded-[2.5rem] p-6 hover:shadow-2xl hover:shadow-slate-200/50 transition-all hover:-translate-y-1 relative overflow-hidden"
            >
              {/* Accents */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50/30 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand-100/40 transition-colors" />
              
              <div className="flex flex-col h-full relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest font-mono">#{r.id?.slice(0,8).toUpperCase()}</span>
                       <StatusBadge status={r.status} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-none mb-1">{r.item_name}</h3>
                    <p className="text-sm font-bold text-brand-600">Quantity: {r.quantity} {r.unit || 'units'}</p>
                  </div>
                  <div className="p-4 bg-white/80 rounded-2xl shadow-sm border border-slate-50">
                    <Package className="w-6 h-6 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2">Purpose / Justification</p>
                    <p className="text-xs text-slate-600 leading-relaxed italic line-clamp-2">"{r.purpose || 'No purpose provided'}"</p>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-2 px-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requested By</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{r.requested_by || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                       <p className="text-xs font-bold text-slate-500">{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                    </div>
                  </div>
                </div>

                {r.status === 'pending' && (
                  <div className="mt-6 pt-6 border-t border-slate-100/50 flex gap-2">
                    <button className="flex-1 py-3 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition active:scale-95 shadow-lg shadow-brand-100/50">
                      Approve
                    </button>
                    <button className="px-6 py-3 bg-slate-50 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition">
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── EMPTY STATE ── */}
      {filteredRequests.length === 0 && (
        <div className="bg-white/40 backdrop-blur-sm border border-slate-100 rounded-[3rem] p-24 text-center">
          <div className="w-20 h-20 bg-white shadow-xl shadow-slate-200/50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-slate-100" />
          </div>
          <h3 className="text-xl font-light text-slate-900 tracking-tight">Cloud clear. No requests here.</h3>
          <p className="text-slate-400 mt-2 max-w-xs mx-auto text-sm">We couldn't find any indents matching your search or filters.</p>
        </div>
      )}
    </div>
  );
};

export default RequestPanel;

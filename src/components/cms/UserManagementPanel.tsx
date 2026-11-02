
import React, { useEffect, useState } from "react";
import { 
  Users, UserPlus, Shield, Trash2, Mail, CheckCircle, 
  XCircle, Loader2, Search, Filter, MoreVertical, 
  Crown, UserCheck, Key, AlertTriangle
} from "lucide-react";
import { User, StaffUser, Role } from "../../../types";
import { authService } from "../../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { avatarUrl } from "../../utils/avatar";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "text-red-600 bg-red-50 border-red-100",
  LAB: "text-blue-600 bg-blue-50 border-blue-100",
  AMBASSADOR: "text-brand-600 bg-brand-50 border-brand-100",
  EVENT_MANAGER: "text-purple-600 bg-purple-50 border-purple-100",
  TECH_SUPPORT: "text-amber-600 bg-amber-50 border-amber-100",
  USER: "text-slate-500 bg-slate-50 border-slate-100",
};

interface UserManagementPanelProps {
  isAdmin?: boolean;
  isTech?: boolean;
}

const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ isAdmin, isTech }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "staff" | "users">("all");
  
  // Add Staff Form State
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "LAB" as Role });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError]   = useState("");

  const ROLES: Role[] = ["LAB", "AMBASSADOR", "EVENT_MANAGER", "TECH_SUPPORT", "ADMIN"];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [u, s] = await Promise.all([
        authService.getUsers(),
        authService.getStaff()
      ]);
      setUsers(u || []);
      setStaff(s || []);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (id: string, newRole: string, isStaff: boolean) => {
    try {
      if (isStaff) {
        await authService.updateStaffRole(id, newRole);
      } else {
        await authService.updateUserRole(id, newRole);
      }
      loadData();
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  };

  const handleDelete = async (id: string, isStaff: boolean) => {
    if (!confirm(`Are you sure you want to remove this ${isStaff ? 'staff' : 'user'}?`)) return;
    try {
      if (isStaff) {
        await authService.deleteStaff(id);
      } else {
        await authService.deleteUser(id);
      }
      loadData();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
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
      setTimeout(() => { setShowAddStaff(false); loadData(); }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredData = [
    ...staff.map(s => ({ ...s, isStaff: true })),
    ...users.map(u => ({ ...u, isStaff: false }))
  ].filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
                          u.email.toLowerCase().includes(search.toLowerCase());
    if (activeTab === "staff") return matchesSearch && u.isStaff;
    if (activeTab === "users") return matchesSearch && !u.isStaff;
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Accessing Directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.4em] mb-2">System Administration</p>
          <h1 className="text-4xl font-light text-slate-900 tracking-tight flex items-center gap-3">
             Identity & Access <Shield className="w-8 h-8 text-brand-600" />
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-lg">
            Manage authenticated users and staff members. Control roles, permissions, and system access from a unified directory.
          </p>
        </div>
        {(isAdmin || isTech) && (
          <button 
            onClick={() => setShowAddStaff(true)}
            className="px-6 py-3 bg-brand-600 text-white rounded-full font-bold text-xs flex items-center gap-2 shadow-xl shadow-brand-200/50 hover:bg-brand-500 transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" /> Add Staff Member
          </button>
        )}
      </div>

      {/* ── CONTROLS ── */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-[2rem] p-4 flex flex-col md:flex-row gap-4 items-center shadow-lg shadow-slate-200/20">
        <div className="flex-1 relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name, email or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-400"
          />
        </div>
        <div className="flex bg-slate-50 p-1.5 rounded-2xl shrink-0">
          {(["all", "staff", "users"] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === t ? "bg-white text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── DIRECTORY CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredData.map((u) => (
            <motion.div
              layout
              key={u.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="group bg-white border border-slate-100 rounded-[2.5rem] p-6 hover:shadow-2xl hover:shadow-slate-200/50 transition-all hover:-translate-y-1 relative"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img 
                      src={u.avatar || avatarUrl(u.name, '#f1f5f9', '#64748b')} 
                      className="w-14 h-14 rounded-2xl object-cover bg-slate-100 border-2 border-white shadow-sm"
                      alt={u.name}
                    />
                    {u.isStaff && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-600 border-2 border-white rounded-lg flex items-center justify-center">
                        <Key className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{u.name}</h3>
                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {u.email}
                    </p>
                  </div>
                </div>
                {(isAdmin || isTech) && (
                  <button 
                    onClick={() => handleDelete(u.id, u.isStaff || false)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Access Level</span>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border ${ROLE_COLORS[u.role] || ROLE_COLORS.USER}`}>
                    {u.role.replace("_", " ")}
                  </div>
                </div>

                <div className="relative group/sel">
                   <select 
                    disabled={!isAdmin && !isTech}
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value, u.isStaff || false)}
                    className="w-full bg-slate-50 border-none rounded-2xl py-2.5 px-4 text-xs font-bold text-slate-600 appearance-none focus:ring-2 focus:ring-brand-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {ROLES.map(r => (
                       <option key={r} value={r}>{r.replace("_", " ")}</option>
                     ))}
                     {!u.isStaff && <option value="USER">STUDENT / USER</option>}
                   </select>
                    {(isAdmin || isTech) && <Shield className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />}
                </div>

                {u.isStaff && (
                  <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${(u as StaffUser).is_verified ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                         {(u as StaffUser).is_verified ? 'Verified' : 'Pending'}
                       </span>
                    </div>
                    {(isAdmin || isTech) && (
                      <button 
                        onClick={async () => {
                          const staffMember = u as StaffUser;
                          const newStatus = !staffMember.is_verified;
                          await authService.updateStaffVerification(staffMember.id, newStatus);
                          loadData();
                        }}
                        className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg border transition-all ${
                          (u as StaffUser).is_verified 
                            ? 'text-red-500 border-red-100 hover:bg-red-50' 
                            : 'text-emerald-500 border-emerald-100 hover:bg-emerald-50'
                        }`}
                      >
                        {(u as StaffUser).is_verified ? 'Revoke Access' : 'Approve Staff'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Status Footer */}
              <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">
                  {u.isStaff ? "Staff account" : "Student account"}
                </p>
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${u.isStaff ? 'bg-brand-500' : 'bg-blue-500'}`} />
                  <span className="text-[9px] font-black text-slate-400 uppercase">{u.id.split('-')[0].slice(0, 4)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── EMPTY STATE ── */}
      {filteredData.length === 0 && (
        <div className="bg-white border border-slate-100 rounded-[3rem] p-24 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-slate-200" />
          </div>
          <h3 className="text-xl font-light text-slate-900">No matching identities found.</h3>
          <p className="text-slate-400 mt-2 max-w-xs mx-auto text-sm">We couldn't find any users or staff matching your current search parameters.</p>
        </div>
      )}

      {/* ── ADD STAFF MODAL ── */}
      <AnimatePresence>
        {showAddStaff && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-white rounded-[3rem] border border-slate-100 shadow-2xl p-10 overflow-hidden relative"
            >
              <button 
                onClick={() => setShowAddStaff(false)}
                className="absolute top-8 right-8 p-3 hover:bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>

              <div className="mb-10 text-center">
                <div className="w-16 h-16 bg-brand-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <UserPlus className="w-8 h-8 text-brand-600" />
                </div>
                <h2 className="text-2xl font-light text-slate-900">Add Staff Member</h2>
                <p className="text-sm text-slate-400 mt-2">Create a secure portal account with defined permissions.</p>
              </div>

              <form onSubmit={handleCreateStaff} className="space-y-5">
                {success && <div className="bg-emerald-50 text-emerald-700 text-xs font-bold p-4 rounded-2xl flex items-center gap-2 animate-in fade-in zoom-in duration-300"><CheckCircle className="w-4 h-4" />{success}</div>}
                {error   && <div className="bg-red-50 text-red-600 text-xs font-bold p-4 rounded-2xl flex items-center gap-2 animate-in shake duration-300"><AlertTriangle className="w-4 h-4" />{error}</div>}

                <div className="space-y-4">
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 p-1.5 border border-slate-100 rounded-lg text-slate-400 group-focus-within:text-brand-600 transition-colors">
                      <UserCheck className="w-3.5 h-3.5" />
                    </div>
                    <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                      className="w-full px-14 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-brand-500/20 transition-all font-medium"
                      placeholder="Full Name (e.g. Priya Sharma)" />
                  </div>

                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 p-1.5 border border-slate-100 rounded-lg text-slate-400 group-focus-within:text-brand-600 transition-colors">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                      className="w-full px-14 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-brand-500/20 transition-all font-medium"
                      placeholder="name@reva.edu.in" />
                  </div>

                  <p className="px-1 text-xs text-slate-500">They sign in with their REVA Microsoft account (@reva.edu.in); no password is needed.</p>

                  <div className="grid grid-cols-1 gap-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Select Assignment Role</p>
                    <div className="grid grid-cols-2 gap-3">
                      {ROLES.slice(0, 4).map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setForm({...form, role: r})}
                          className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-tight border transition-all ${
                            form.role === r 
                              ? "bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-100" 
                              : "bg-white text-slate-600 border-slate-100 hover:border-brand-200"
                          }`}
                        >
                          {r.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button type="submit" disabled={saving}
                    className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-brand-100"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    {saving ? "Inscribing Account..." : "Confirm Registry Addition"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagementPanel;

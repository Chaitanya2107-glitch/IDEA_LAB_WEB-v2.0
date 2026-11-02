// src/components/cms/EventManagerPanel.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Calendar, Plus, Edit3, Trash2, Loader2, CheckCircle, XCircle,
  Clock, Users, FileText, Lock, Unlock, AlertCircle, Save, X, Settings as SettingsIcon,
  Info, MapPin, Image as ImageIcon, Calendar as CalendarIcon, Activity, Search
} from "lucide-react";
import { authService } from "../../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { processImageUpload } from "../../utils/image-utils";

type EMTab = "events" | "bookings" | "closures" | "settings";

interface EventManagerPanelProps {
  staffId: string;
  staffName: string;
  isAdmin?: boolean;
  role?: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { cls: string, icon: any }> = {
    pending:   { cls: "bg-amber-50 text-amber-700 border-amber-100", icon: Clock },
    approved:  { cls: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle },
    rejected:  { cls: "bg-red-50 text-red-700 border-red-100", icon: XCircle },
    upcoming:  { cls: "bg-blue-50 text-blue-700 border-blue-100", icon: CalendarIcon },
    active:    { cls: "bg-purple-50 text-purple-700 border-purple-100", icon: Activity },
    completed: { cls: "bg-slate-50 text-slate-600 border-slate-100", icon: CheckCircle },
  } as any;
  const config = map[status] || map.pending;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${config.cls}`}>
      <Icon className="w-3 h-3" /> {status}
    </span>
  );
};

/* ─── Inline field helper ─── */
const Field = ({ label, value, onChange, placeholder, textarea, type = "text", onFileChange, accept, select, options }: any) => (
  <div>
    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{label}</label>
    {select ? (
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
      >
        {options?.map((opt: any) => (
          <option key={opt.v} value={opt.v}>{opt.l}</option>
        ))}
      </select>
    ) : type === "file" ? (
      <input 
        type="file" 
        accept={accept}
        onChange={e => e.target.files?.[0] && onFileChange?.(e.target.files[0])}
        className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" 
      />
    ) : textarea ? (
      <textarea rows={3} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
    ) : (
      <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
    )}
  </div>
);

/* ══════════════ Lab Settings Manager ══════════════ */
const LabSettings: React.FC = () => {
  const [settings, setSettings] = useState<any>({
    openingTime: "09:00",
    closingTime: "17:00",
    slotDuration: 60,
    maxAttendeesPerSlot: 10
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.general) setSettings(data.general);
      }
    } catch (err) {
      console.error("Settings fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const token = localStorage.getItem("token");
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key: "general", value: settings }),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>;

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h3 className="font-bold text-slate-800 mb-1">Operating Hours</h3>
        <p className="text-xs text-slate-400">Set when the lab is open for bookings.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Opening Time" type="time" value={settings.openingTime} onChange={(v: string) => setSettings({...settings, openingTime: v})} />
        <Field label="Closing Time" type="time" value={settings.closingTime} onChange={(v: string) => setSettings({...settings, closingTime: v})} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Slot Duration (min)" type="number" value={String(settings.slotDuration)} onChange={(v: string) => setSettings({...settings, slotDuration: +v})} />
        <Field label="Max Attendees / Slot" type="number" value={String(settings.maxAttendeesPerSlot)} onChange={(v: string) => setSettings({...settings, maxAttendeesPerSlot: +v})} />
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 transition flex items-center justify-center gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? "Saving…" : "Save Lab Settings"}
      </button>

      {success && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 text-green-700 text-xs font-bold p-3 rounded-xl flex items-center gap-2 border border-green-100">
          <CheckCircle className="w-4 h-4" /> Lab settings updated successfully!
        </motion.div>
      )}
    </div>
  );
};

/* ══════════════ Events Manager (Premium) ══════════════ */
const EVENT_TYPE_COLOR: Record<string, string> = {
  workshop:   "bg-brand-50 text-brand-700 border-brand-200",
  masterclass:"bg-purple-50 text-purple-700 border-purple-200",
  showcase:   "bg-blue-50 text-blue-700 border-blue-200",
  hackathon:  "bg-green-50 text-green-700 border-green-200",
  seminar:    "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const EventCardPreview: React.FC<{ event: any }> = ({ event }) => {
  const colorCls = EVENT_TYPE_COLOR[event.type || 'workshop'] ?? "bg-slate-50 text-slate-700 border-slate-200";
  const dateObj = event.start_date ? new Date(event.start_date) : new Date();
  const day = dateObj.getDate();
  const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();

  return (
    <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col h-full ring-1 ring-slate-100/50 hover:shadow-2xl transition-all duration-500">
      <div className="relative h-48 overflow-hidden bg-slate-50">
        {(event.banner_image || event.banner_url) ? (
          <img src={event.banner_image || event.banner_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="banner" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-200">
            <ImageIcon className="w-12 h-12" />
          </div>
        )}
        <div className="absolute top-6 left-6">
          <span className={`inline-block text-[10px] font-black uppercase px-4 py-1.5 rounded-full border shadow-sm backdrop-blur-md ${colorCls} border-white/20`}>
            {event.type || 'workshop'}
          </span>
        </div>
      </div>
      <div className="p-8 flex-1 flex flex-col">
        <div className="flex items-start gap-4 mb-6">
          <div className="shrink-0 w-12 flex flex-col items-center bg-brand-50 rounded-2xl py-2 shadow-sm border border-brand-100/50">
            <span className="text-[9px] font-black text-brand-500 tracking-widest leading-none mb-1">{month}</span>
            <span className="text-xl font-black text-brand-700 leading-none">{day}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-lg mb-1 leading-tight tracking-tight line-clamp-2">{event.title || 'Event Title'}</h3>
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
              <span className="flex items-center gap-1.5 uppercase tracking-wider"><Clock className="w-3.5 h-3.5" /> {event.start_time || '09:00'}</span>
              <span className="flex items-center gap-1.5 uppercase tracking-wider truncate"><MapPin className="w-3.5 h-3.5" /> {event.location || 'IDEA Lab'}</span>
            </div>
          </div>
        </div>
        <p className="text-sm font-medium text-slate-400 line-clamp-2 italic mb-6 leading-relaxed">"{event.description || 'Event description goes here...'}"</p>
        <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
           <span className="text-[10px] font-black uppercase text-brand-600 tracking-widest">{event.status || 'upcoming'}</span>
           <div className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-50 rounded-full border border-slate-100">
              <Users className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-black text-slate-500 uppercase">{event.max_attendees || 50} Max</span>
           </div>
        </div>
      </div>
    </div>
  );
};

const ParticipantList: React.FC<{ event: any; onClose: () => void }> = ({ event, onClose }) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const data = await authService.getEventRegistrations(event.id);
        setParticipants(data || []);
      } catch (err) {
        console.error('Failed to load participants:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchParticipants();
  }, [event.id]);

  const exportToCSV = () => {
    if (participants.length === 0) return;
    const headers = ["Name", "Email", "Degree", "Program", "SRN", "Phone", "Registered At"];
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = participants.map(p => [
      escape(p.name),
      escape(p.email),
      escape(p.degree),
      escape(p.program),
      escape(p.srn),
      escape(p.phone_number),
      escape(new Date(p.created_at).toLocaleString())
    ]);

    const csvContent = '\uFEFF' + [headers.map(escape), ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `participants_${event.title.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Participant Roster</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{event.title}</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={exportToCSV}
              disabled={loading || participants.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-700 transition shadow-lg shadow-brand-600/20 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition text-slate-300 hover:text-slate-600 shadow-sm">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-200" /></div>
          ) : participants.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-12 h-12 text-slate-100 mx-auto mb-4" />
              <p className="text-slate-400 font-bold italic">No registrations yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Participant</th>
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">SRN / ID</th>
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Degree & Program</th>
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {participants.map((p) => (
                    <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{p.email}</div>
                      </td>
                      <td className="py-4">
                        <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-600 font-mono italic">{p.srn}</span>
                      </td>
                      <td className="py-4">
                        <div className="text-xs font-bold text-slate-700">{p.degree}</div>
                        <div className="text-[11px] text-slate-400">{p.program}</div>
                      </td>
                      <td className="py-4">
                        <div className="text-xs font-bold text-slate-700">{p.phone_number}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EventsManager: React.FC<{ staffId: string }> = ({ staffId }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewingParticipants, setViewingParticipants] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "workshop",
    status: "upcoming",
    start_date: "",
    end_date: "",
    start_time: "09:00",
    end_time: "17:00",
    location: "AICTE IDEA Lab",
    max_attendees: 50,
    banner_image: ""
  });
  const [selectedHighlights, setSelectedHighlights] = useState<File[]>([]);
  const [highlightUrls, setHighlightUrls] = useState<string[]>([]);

  const fetch = async () => {
    setLoading(true);
    try {
      const [data, counts] = await Promise.all([
        authService.getEvents(),
        authService.getEventRegistrationCounts().catch(() => ({} as Record<string, number>)),
      ]);
      setEvents((data || []).map((ev: any) => ({ ...ev, registered_count: counts[ev.id] || 0 })));
    } catch (err) {
      console.error("Fetch events error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const [selectedBanner, setSelectedBanner] = useState<File | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      let finalBanner = form.banner_image;
      if (selectedBanner) {
        const processedFile = await processImageUpload(selectedBanner);
        const { publicUrl } = await authService.uploadFile("projects", processedFile, "events");
        if (publicUrl) finalBanner = publicUrl;
      }

      // Upload highlight images
      const uploadedHighlightUrls: string[] = [...highlightUrls.filter(u => u.trim())];
      for (const file of selectedHighlights) {
        const processedFile = await processImageUpload(file);
        try {
          const { publicUrl } = await authService.uploadFile("projects", processedFile, "highlights");
          if (publicUrl) uploadedHighlightUrls.push(publicUrl);
        } catch (err) {
          console.error("Highlight upload failed:", err);
        }
      }

      const payload = { 
        ...form, 
        banner_url: finalBanner,
        highlights: uploadedHighlightUrls.slice(0, 5),
        created_by: staffId, 
        updated_at: new Date().toISOString() 
      };
      delete (payload as any).banner_image;

      if (editing) {
        await authService.updateEvent(editing.id, payload);
      } else {
        await authService.addEvent(payload);
      }
      setShowForm(false);
      setSelectedBanner(null);
      setSelectedHighlights([]);
      setHighlightUrls([]);
      fetch();
    } catch (err: any) {
      alert("Failed to save event: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Event Management</h2>
          <p className="text-sm text-slate-400 mt-0.5">Schedule workshops, seminars, and hackathons.</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ title: "", description: "", type: "workshop", status: "upcoming", start_date: "", end_date: "", start_time: "09:00", end_time: "17:00", location: "AICTE IDEA Lab", max_attendees: 50, banner_image: "" }); setSelectedHighlights([]); setHighlightUrls([]); setShowForm(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-[16px] font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition shadow-lg shadow-brand-600/20 active:scale-95">
          <Plus className="w-4 h-4" /> New Event
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row h-[90vh]">
              
              {/* Left Side: Preview (Brand colors) */}
              <div className="w-full md:w-[42%] bg-slate-50 border-r border-slate-100 p-10 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-brand-600/5 rounded-full blur-3xl -mr-40 -mt-40" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/5 rounded-full blur-3xl -ml-32 -mb-32" />
                
                <div className="relative z-10 flex flex-col h-full">
                   <div className="mb-8">
                     <span className="inline-block text-[10px] font-black uppercase text-brand-600 tracking-[0.25em] mb-4 bg-brand-50 px-3 py-1 rounded-full border border-brand-100">Live Preview</span>
                     <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Visualization</h3>
                   </div>
                   
                   <div className="flex-1 flex items-center justify-center">
                      <div className="w-full max-w-[360px] transform hover:scale-[1.02] transition-transform duration-500">
                        <EventCardPreview event={form} />
                      </div>
                   </div>
                   
                   <div className="mt-10 p-6 bg-white/70 backdrop-blur-xl rounded-[24px] border border-white shadow-xl shadow-slate-200/50 flex items-start gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-slate-50">
                         <Info className="w-6 h-6 text-brand-500" />
                      </div>
                      <p className="text-[11px] font-bold text-slate-600 leading-relaxed italic">
                        "Your event is a story. This preview shows how students will see it. Be bold, be clear, and make them want to join."
                      </p>
                   </div>
                </div>
              </div>

              {/* Right Side: Form */}
              <div className="flex-1 p-8 overflow-y-auto no-scrollbar bg-white">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editing ? "Modify Event" : "Create New Event"}</h3>
                  <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-50 rounded-full transition"><XCircle className="w-6 h-6 text-slate-300" /></button>
                </div>

                <div className="space-y-6">
                  <Field label="Event Title" value={form.title} onChange={(v: string) => setForm({...form, title: v})} placeholder="Python for Beginners" />
                  <Field label="Event Description" value={form.description} onChange={(v: string) => setForm({...form, description: v})} textarea placeholder="What will participants learn?..." />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Type" value={form.type} onChange={(v: string) => setForm({...form, type: v})} select options={[{v:'workshop',l:'Workshop'},{v:'masterclass',l:'Masterclass'},{v:'hackathon',l:'Hackathon'},{v:'seminar',l:'Seminar'},{v:'showcase',l:'Showcase'}]} />
                    <Field label="Status" value={form.status} onChange={(v: string) => setForm({...form, status: v})} select options={[{v:'upcoming',l:'Upcoming'},{v:'ongoing',l:'Ongoing'},{v:'completed',l:'Completed'},{v:'cancelled',l:'Cancelled'}]} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Start Date" type="date" value={form.start_date} onChange={(v: string) => setForm({...form, start_date: v})} />
                    <Field label="End Date" type="date" value={form.end_date} onChange={(v: string) => setForm({...form, end_date: v})} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Start Time" type="time" value={form.start_time} onChange={(v: string) => setForm({...form, start_time: v})} />
                    <Field label="End Time" type="time" value={form.end_time} onChange={(v: string) => setForm({...form, end_time: v})} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Location" value={form.location} onChange={(v: string) => setForm({...form, location: v})} placeholder="AICTE IDEA Lab, Room 101" />
                    <Field label="Max Attendees" type="number" value={String(form.max_attendees)} onChange={(v: string) => setForm({...form, max_attendees: parseInt(v)})} />
                  </div>

                  <div className="pt-4 border-t border-slate-50">
                    <Field label="Banner Image" type="file" onFileChange={setSelectedBanner} value="" onChange={() => {}} accept="image/*" />
                    <p className="text-[10px] font-black text-slate-300 mt-2 uppercase italic">Max 10MB. 5-10MB files are auto-compressed.</p>
                    <div className="mt-3">
                       <Field label="Or Paste Image URL" value={form.banner_image} onChange={(v: string) => setForm({...form, banner_image: v})} placeholder="https://..." />
                    </div>
                  </div>

                  {/* Highlights Section */}
                  <div className="pt-4 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Event Highlights (Max 5)</label>
                    <p className="text-[10px] font-black text-slate-300 mb-3 uppercase italic">Upload photos from the event. Shown on the event page after it completes.</p>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={e => {
                        const files = Array.from(e.target.files || []).slice(0, 5);
                        setSelectedHighlights(files);
                      }}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                    />
                    {selectedHighlights.length > 0 && (
                      <p className="text-[10px] font-black text-brand-600 mt-2">{selectedHighlights.length} image(s) selected</p>
                    )}
                    <div className="mt-3 space-y-2">
                      {Array.from({ length: Math.min(5 - selectedHighlights.length, 3) }).map((_, i) => (
                        <input
                          key={i}
                          type="text"
                          placeholder={`Highlight URL ${i + 1} (optional)`}
                          value={highlightUrls[i] || ''}
                          onChange={e => {
                            const next = [...highlightUrls];
                            next[i] = e.target.value;
                            setHighlightUrls(next);
                          }}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 text-slate-600"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-10 flex gap-4 sticky bottom-0 bg-white pt-4 pb-2">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-4 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition duration-300">Discard</button>
                  <button onClick={handleSave} disabled={!form.title || saving}
                    className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 relative overflow-hidden ${
                      saving 
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                        : "bg-brand-600 text-white hover:bg-brand-700 shadow-xl shadow-brand-600/25"
                    }`}>
                    {saving && <motion.div layoutId="btn-bg" className="absolute inset-0 bg-brand-800 opacity-10" initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }} />}
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? "Publishing..." : (editing ? "Update Event" : "Save Event")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {viewingParticipants && (
          <ParticipantList event={viewingParticipants} onClose={() => setViewingParticipants(null)} />
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-32"><Loader2 className="w-10 h-10 animate-spin text-brand-200" /></div>
      ) : events.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-10">No events planned yet. Start by creating a workshop or hackathon.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(ev => (
            <div key={ev.id} className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
              {(ev.banner_image || ev.banner_url) && (
                <div className="absolute inset-0 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                   <img src={ev.banner_image || ev.banner_url} className="w-full h-full object-cover scale-150 rotate-12" alt="bg" />
                </div>
              )}
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                   <div className="flex flex-col">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border mb-1 ${EVENT_TYPE_COLOR[ev.type] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                         {ev.type}
                      </span>
                      <span className="text-[9px] font-mono text-slate-300 font-bold tracking-tight">ID: {ev.id?.slice(0, 8).toUpperCase()}</span>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={() => setViewingParticipants(ev)} title="View Participants" className="p-2 hover:bg-slate-50 rounded-xl text-slate-300 hover:text-brand-600 transition"><Users className="w-4 h-4" /></button>
                      <button                   onClick={() => { 
                    setEditing(ev); 
                    setForm(ev); 
                    setHighlightUrls(ev.highlights || []);
                    setSelectedHighlights([]);
                    setShowForm(true); 
                  }} title="Edit Event" className="p-2 hover:bg-slate-50 rounded-xl text-slate-300 hover:text-brand-600 transition"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={async () => { if(confirm("Delete Event?")) { try { await authService.deleteEvent(ev.id); fetch(); } catch(err:any){alert(err.message)} } }} title="Delete Event" className="p-2 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4" /></button>
                   </div>
                </div>
                <h3 className="font-black text-slate-800 text-base uppercase tracking-tight line-clamp-1 mb-2 tracking-tighter uppercase">{ev.title}</h3>
                <div className="space-y-1.5 mb-4">
                   <p className="text-[10px] font-black text-slate-400 flex items-center gap-1.5 uppercase"><CalendarIcon className="w-3 h-3" /> {ev.start_date}</p>
                   <p className="text-[10px] font-black text-slate-400 flex items-center gap-1.5 uppercase"><MapPin className="w-3 h-3" /> {ev.location}</p>
                </div>
                <p className="text-xs font-bold text-slate-400 line-clamp-2 md:h-10 mb-4 italic leading-relaxed">"{ev.description}"</p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                   <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">{ev.status || 'upcoming'}</span>
                   <span className="text-[10px] font-black text-slate-300 uppercase">{ev.registered_count || 0} / {ev.max_attendees} registered</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ══════════════ Bookings Manager ══════════════ */
const BookingsManager: React.FC<{ staffId: string }> = ({ staffId }) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [noteModal, setNoteModal] = useState<{ ids: string[]; action: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authService.getSlotRequests();
      setBookings([...(data || [])].sort((a: any, b: any) => String(a.date).localeCompare(String(b.date))));
      setSelectedIds([]);
    } catch (err) {
      console.error('Booking load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleAction = async () => {
    if (!noteModal) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      let successCount = 0;
      
      // Process all selected IDs for the action sequentially
      for (const id of noteModal.ids) {
        const res = await fetch(`/api/slots?id=${id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ 
            status: noteModal.action,
            rejection_reason: note || null
          })
        });
        if (res.ok) successCount++;
      }
      
      if (successCount < noteModal.ids.length) {
        alert(`Warning: Only processed ${successCount} out of ${noteModal.ids.length} bookings successfully.`);
      }
    } catch (err: any) {
      console.error('Failed to update booking status:', err);
      alert('Could not update booking: ' + err.message);
    } finally {
      setSaving(false);
      setNoteModal(null);
      setNote("");
      loadBookings();
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchStatus = statusFilter === "all" || b.status === statusFilter;
      const matchSearch = search ? (
        (b.user_name || "").toLowerCase().includes(search.toLowerCase()) || 
        (b.id || "").toLowerCase().includes(search.toLowerCase()) ||
        (b.purpose || "").toLowerCase().includes(search.toLowerCase())
      ) : true;
      return matchStatus && matchSearch;
    });
  }, [bookings, statusFilter, search]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredBookings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredBookings.map(b => b.id));
    }
  };

  return (
    <div className="space-y-8 min-h-[500px]">
      {/* ── FILTERS & MASS ACTION BAR ── */}
      <div className="flex flex-col sm:flex-row items-center gap-6 pb-4 border-b border-slate-100">
        <div className="relative flex-1 group w-full max-w-sm">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-500" />
          <input 
            type="text" placeholder="SEARCH BOOKINGS..."
            className="w-full pl-8 py-3 bg-transparent border-none outline-none text-[11px] font-black uppercase tracking-widest placeholder:text-slate-300"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto overflow-x-auto no-scrollbar">
          {["all", "pending", "approved", "rejected"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:text-brand-600 ${statusFilter === s ? 'text-brand-600 border-b-2 border-brand-600 pb-1' : 'text-slate-400'}`}>
              {s}
            </button>
          ))}
          <div className="w-px h-6 bg-slate-200 mx-2 hidden sm:block"></div>
          <button onClick={loadBookings} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">↻ Refresh</button>
        </div>
      </div>

      {/* ── MASS ACTION HEADER ── */}
      {selectedIds.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} 
          className="bg-brand-50 border border-brand-200 rounded-2xl p-4 flex items-center justify-between shadow-sm shadow-brand-100">
          <p className="text-xs font-black text-brand-800 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {selectedIds.length} Selected
          </p>
          <div className="flex gap-3">
             <button onClick={() => { setNoteModal({ ids: selectedIds, action: "rejected" }); setNote(""); }} className="px-5 py-2.5 bg-white text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 border border-red-100 transition shadow-sm">Reject All</button>
             <button onClick={() => { setNoteModal({ ids: selectedIds, action: "approved" }); setNote(""); }} className="px-5 py-2.5 bg-brand-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-700 transition shadow-sm flex items-center gap-2">Approve All</button>
          </div>
        </motion.div>
      )}

      {/* ── MODAL ACTION ── */}
      <AnimatePresence>
        {noteModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
              className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md space-y-6">
              <div>
                <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.3em] mb-2">Mass Processing</p>
                <h3 className="text-2xl font-light text-slate-900 tracking-tight">{noteModal.action === "approved" ? "Approve" : "Reject"} {noteModal.ids.length} Booking{noteModal.ids.length > 1 ? 's' : ''}</h3>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Resolution Note (Optional)</label>
                <textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="Will be attached to the notification log..."
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition-all resize-none" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-50">
                <button onClick={() => setNoteModal(null)} className="flex-1 py-3 border border-slate-200 bg-white rounded-xl text-[10px] uppercase tracking-widest font-black text-slate-400 hover:text-slate-900 transition-colors">Abort</button>
                <button onClick={handleAction} disabled={saving}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg ${
                    noteModal.action === "approved" ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30" : "bg-red-500 hover:bg-red-600 shadow-red-500/30"
                  }`}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : noteModal.action === "approved" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TABULAR VIEW ── */}
      {loading ? <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div> : (
        <div className="overflow-x-auto pb-20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="py-6 w-10 pl-2">
                  <input type="checkbox" checked={filteredBookings.length > 0 && selectedIds.length === filteredBookings.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-200 text-brand-600 focus:ring-brand-500" />
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Requestor</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Time Slot</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Purpose & Attendees</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                <th className="pr-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredBookings.length === 0 ? (
                 <tr>
                   <td colSpan={6} className="py-24 text-center">
                     <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                     <p className="text-sm font-bold text-slate-400">No bookings found</p>
                   </td>
                 </tr>
              ) : filteredBookings.map(b => (
                <tr key={b.id} className={`group hover:bg-slate-50/50 transition-colors ${selectedIds.includes(b.id) ? 'bg-slate-50' : ''}`}>
                  <td className="py-6 pl-2">
                    <input type="checkbox" checked={selectedIds.includes(b.id)} onChange={() => setSelectedIds(p => p.includes(b.id) ? p.filter(x => x !== b.id) : [...p, b.id])} className="w-4 h-4 rounded border-slate-200 text-brand-600 focus:ring-brand-500" />
                  </td>
                  <td className="px-6 py-6 border-l-4 border-l-transparent group-hover:border-l-brand-600">
                    <div className="flex flex-col">
                      <p className="text-sm font-bold text-slate-800 tracking-tight">{b.user_name || "Unknown User"}</p>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1 font-mono">#{b.id?.slice(0,6)}</p>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <p className="text-[11px] font-bold text-slate-800">{new Date(b.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">
                       {(b.start_time || "").slice(0,5)} – {(b.end_time || "").slice(0,5)}
                    </p>
                  </td>
                  <td className="px-6 py-6 max-w-xs">
                     <p className="text-xs font-medium text-slate-600 truncate">{b.purpose || "No stated purpose"}</p>
                     <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-1.5 pt-1">
                        <Users className="w-3 h-3 text-brand-400" /> {b.attendees} People
                     </p>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <StatusBadge status={b.status} />
                    {b.rejection_reason && (
                      <p className="text-[9px] text-red-500 font-bold block mt-2 mx-auto max-w-[15ch] line-clamp-2" title={b.rejection_reason}>
                        Note: {b.rejection_reason}
                      </p>
                    )}
                  </td>
                  <td className="pr-6 py-6 text-right">
                    {b.status === "pending" ? (
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setNoteModal({ ids: [b.id], action: "approved" }); setNote(""); }} className="p-2 border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"><CheckCircle className="w-4 h-4" /></button>
                        <button onClick={() => { setNoteModal({ ids: [b.id], action: "rejected" }); setNote(""); }} className="p-2 border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-600 hover:bg-red-50 rounded-xl transition-all"><XCircle className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ══════════════ Lab Closure Manager ══════════════ */
const CLOSURE_TYPES = ["holiday", "maintenance", "exam_period", "national_holiday", "other"];

const ClosureManager: React.FC<{ staffId: string; staffName: string }> = ({ staffId, staffName }) => {
  const [closures, setClosures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", reason: "", closure_type: "holiday" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await authService.getLabClosures().catch(() => []);
    setClosures(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.date || !form.reason) return;
    setSaving(true);
    try {
      await authService.saveLabClosure(form);
    } catch (err: any) {
      alert("Could not save closure: " + err.message);
    }
    setSaving(false);
    setShowForm(false);
    setForm({ date: "", reason: "", closure_type: "holiday" });
    load();
  };

  const handleDelete = async (id: string) => {
    await authService.deleteLabClosure(id).catch((err: any) => alert("Could not delete closure: " + err.message));
    load();
  };

  const upcoming = closures.filter(c => c.date >= new Date().toISOString().slice(0, 10));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-slate-800">Lab Closures</h3>
          <p className="text-xs text-slate-400 mt-0.5">Custom holidays or maintenance days.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition">
          <Lock className="w-4 h-4" /> Close Lab
        </button>
      </div>

      {showForm && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-5 space-y-3">
          <h4 className="font-bold text-red-700 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Schedule Closure</h4>
          <Field label="Date" type="date" value={form.date} onChange={(v: string) => setForm({...form, date: v})} />
          <Field label="Reason" value={form.reason} onChange={(v: string) => setForm({...form, reason: v})} placeholder="e.g. Maintenance..." />
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-red-200 rounded-xl text-sm font-bold text-red-600">Cancel</button>
            <button onClick={handleAdd} disabled={!form.date || !form.reason || saving}
              className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-40 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Confirm
            </button>
          </div>
        </div>
      )}

      {loading ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div> : (
        <div className="space-y-2">
          {upcoming.map(c => (
            <div key={c.id} className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-red-800">{c.date}</p>
                <p className="text-red-500">{c.reason}</p>
              </div>
              <button onClick={() => handleDelete(c.id)} className="p-1 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ══════════════ MAIN ══════════════ */
const EventManagerPanel: React.FC<EventManagerPanelProps> = ({ staffId, staffName, isAdmin, role }) => {
  const [tab, setTab] = useState<EMTab>("events");

  const tabs = [
    { id: "events" as EMTab,   label: "Event Registry",    icon: <Calendar className="w-4 h-4" /> },
    { id: "bookings" as EMTab, label: "Slot Operations",  icon: <Clock className="w-4 h-4" /> },
    { id: "closures" as EMTab, label: "Restricted Access",   icon: <Lock className="w-4 h-4" /> },
    { id: "settings" as EMTab, label: "Lab Protocols",   icon: <SettingsIcon className="w-4 h-4" /> },
  ].filter(t => {
    if (t.id === "settings") return isAdmin;
    if (t.id === "bookings") return isAdmin || role !== "LAB";
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.4em] mb-2">Systems Logistics</p>
          <h1 className="text-4xl font-light text-slate-900 tracking-tight flex items-center gap-3">
             Events & Operations <Calendar className="w-8 h-8 text-brand-600" />
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-lg">
            Orchestrate laboratory workshops, manage public engagements, and maintain operational transparency across all scheduled sessions.
          </p>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-[2rem] p-1.5 flex bg-slate-50 w-fit shrink-0 shadow-lg shadow-slate-200/20">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              tab === t.id ? "bg-white text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div 
          key={tab} 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: -15 }} 
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="pb-12"
        >
          {tab === "events"   && <EventsManager staffId={staffId} />}
          {tab === "bookings" && <BookingsManager staffId={staffId} />}
          {tab === "closures" && <ClosureManager staffId={staffId} staffName={staffName} />}
          {tab === "settings" && <LabSettings />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default EventManagerPanel;

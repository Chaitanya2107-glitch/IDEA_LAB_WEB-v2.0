// src/components/SlotBookingModal.tsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { authService } from "../services/api";
import { User, SlotBooking } from "../../types";
import { getLabStatus } from "../utils/labClosure";

interface SlotBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User;
  initialDate?: string;
  onSuccess?: () => void;
}

export const SESSION_TYPES = [
  "Project Work",
  "Faculty Consultation",
  "Equipment Training",
  "Hackathon Practice",
  "PCB Assembly",
  "3D Printing Session",
  "Research / Documentation",
  "Team Meeting",
];

export const TIME_SLOTS = [
  { label: "Morning (09:00–12:00)", start: "09:00", end: "12:00" },
  { label: "Afternoon (13:00–16:00)", start: "13:00", end: "16:00" },
  { label: "Evening (16:00–19:00)", start: "16:00", end: "19:00" },
  { label: "Full Day (09:00–18:00)", start: "09:00", end: "18:00" },
];

const SlotBookingModal: React.FC<SlotBookingModalProps> = ({ 
  isOpen, 
  onClose, 
  user, 
  initialDate = "", 
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  
  const [formData, setFormData] = useState({
    date: initialDate,
    slotIndex: 0,
    sessionType: SESSION_TYPES[0],
    purpose: "",
    attendees: 1
  });

  useEffect(() => {
    if (initialDate) setFormData(prev => ({ ...prev, date: initialDate }));
  }, [initialDate]);

  useEffect(() => {
    (async () => {
      try {
        const dates = await authService.getBlockedDates();
        setBlockedDates(dates);
      } catch (err) {
        console.error("Failed to load blocked dates", err);
      }
    })();
  }, []);

  const labStatus = getLabStatus(formData.date, blockedDates);

  // Times already held by other bookings (pending or approved). The server enforces this
  // too; greying them out here just saves a failed attempt.
  const [calendar, setCalendar] = useState<{ date: string; start_time: string | null; end_time: string | null }[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    authService.getSlotCalendar().then(setCalendar).catch(() => setCalendar([]));
  }, [isOpen, success]);
  const toMinutes = (t: string | null, fallback: number) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : fallback);
  const isTaken = (slot: { start: string; end: string }) =>
    calendar.some(
      (b) =>
        b.date === formData.date &&
        toMinutes(b.start_time, 0) < toMinutes(slot.end, 24 * 60) &&
        toMinutes(slot.start, 0) < toMinutes(b.end_time, 24 * 60),
    );
  const selectedTaken = Boolean(formData.date) && isTaken(TIME_SLOTS[formData.slotIndex]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (labStatus.isClosed || selectedTaken) return;
    
    setLoading(true);
    setError(null);

    const slot = TIME_SLOTS[formData.slotIndex];

    try {
      await authService.createSlotRequest({
        bookingDate: formData.date,
        startTime: slot.start,
        endTime: slot.end,
        sessionType: formData.sessionType,
        purpose: formData.purpose,
        attendees: formData.attendees,
        tenant_id: user.tenant_id,
        user_id: user.id,
        user_name: user.name,
        status: "pending"
      });
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to book slot. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center p-4 sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !loading && onClose()}
            className="absolute inset-0 bg-slate-900/50"
          />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="slot-booking-modal-title"
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Calendar className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="slot-booking-modal-title" className="font-display text-xl font-semibold text-slate-900">Reserve Slot</h2>
                  <p className="text-xs text-slate-500">Idea Lab Protocol v3.0</p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={loading}
                aria-label="Close"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="px-6 py-5">
              <AnimatePresence mode="wait">
                {success ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="py-8 text-center"
                    role="status"
                  >
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600">
                      <CheckCircle className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h2 className="font-display text-xl font-semibold text-slate-900">Request Submitted!</h2>
                    <p className="mt-1 text-sm text-slate-500">Your slot request is being processed...</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                      <div role="alert" className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {error}
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Date Selection */}
                      <div>
                        <label htmlFor="slot-date" className="mb-1.5 block text-sm font-medium text-slate-700">Preferred Date</label>
                        <div className="relative">
                          <input
                            id="slot-date"
                            required
                            type="date"
                            min={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}
                            max={new Date(Date.now() + 60 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}
                            aria-invalid={labStatus.isClosed}
                            className={`block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
                              labStatus.isClosed
                                ? "border-red-500 pr-10 focus:border-red-500 focus:ring-red-500/20"
                                : "border-slate-300 focus:border-brand-500 focus:ring-brand-500/20"
                            }`}
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          />
                          {labStatus.isClosed && (
                            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-red-600">
                              <AlertCircle className="h-4 w-4" aria-hidden="true" />
                            </div>
                          )}
                        </div>
                        {labStatus.isClosed && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="mt-1.5 text-sm text-red-600"
                          >
                            {labStatus.reason}
                          </motion.p>
                        )}
                      </div>

                      {/* Session Type */}
                      <div>
                        <label htmlFor="slot-session-type" className="mb-1.5 block text-sm font-medium text-slate-700">Session Type</label>
                        <select
                          id="slot-session-type"
                          className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                          value={formData.sessionType}
                          onChange={(e) => setFormData({ ...formData, sessionType: e.target.value })}
                        >
                          {SESSION_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      {/* Time Slots */}
                      <div>
                        <p className="mb-1.5 block text-sm font-medium text-slate-700">Time Slot</p>
                        <div className="grid grid-cols-2 gap-3">
                          {TIME_SLOTS.map((slot, i) => {
                            const taken = Boolean(formData.date) && isTaken(slot);
                            return (
                            <button
                              key={i}
                              type="button"
                              disabled={taken}
                              aria-pressed={formData.slotIndex === i}
                              onClick={() => setFormData({ ...formData, slotIndex: i })}
                              className={`relative rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                                taken
                                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through"
                                  : formData.slotIndex === i
                                  ? "border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              <div className="flex flex-col pr-5">
                                <span className="font-medium">
                                  {slot.label.split('(')[0]}
                                </span>
                                <span className={`mt-0.5 text-xs tabular-nums ${formData.slotIndex === i ? "text-brand-700" : "text-slate-500"}`}>
                                  {slot.start} — {slot.end}{taken ? " · Booked" : ""}
                                </span>
                              </div>
                              {formData.slotIndex === i && !taken && (
                                <motion.div layoutId="slot-check" className="absolute top-3 right-3">
                                  <CheckCircle className="h-4 w-4 text-brand-600" aria-hidden="true" />
                                </motion.div>
                              )}
                            </button>
                            );
                          })}
                        </div>
                        {selectedTaken && (
                          <p className="mt-1.5 text-sm text-red-600">This time is already booked. Pick a free slot or another date.</p>
                        )}
                      </div>

                      {/* Attendees & Purpose */}
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="md:col-span-1">
                          <label htmlFor="slot-attendees" className="mb-1.5 block text-sm font-medium text-slate-700">Pax</label>
                          <input
                            id="slot-attendees"
                            type="number" min={1} max={50}
                            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                            value={formData.attendees}
                            onChange={(e) => setFormData({ ...formData, attendees: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label htmlFor="slot-purpose" className="mb-1.5 block text-sm font-medium text-slate-700">Purpose / Notes</label>
                          <input
                            id="slot-purpose"
                            required
                            placeholder="Briefly describe your activity..."
                            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                            value={formData.purpose}
                            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || labStatus.isClosed || selectedTaken}
                      aria-busy={loading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5" aria-hidden="true" />
                          <span>Submit Request</span>
                        </div>
                      )}
                    </button>
                  </form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SlotBookingModal;

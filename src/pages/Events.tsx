// src/pages/Events.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar as CalendarIcon, List, ChevronLeft, ChevronRight,
  CheckCircle, Lock, Clock, MapPin,
  X, Loader2, AlertCircle, ArrowRight, Image as ImageIcon
} from "lucide-react";
import { User } from "../../types";
import { authService } from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { getLabStatus, INDIAN_HOLIDAYS_2026, LabStatus } from "../utils/labClosure";
import SlotBookingModal, { SESSION_TYPES, TIME_SLOTS } from "../components/SlotBookingModal";
import { getComputedEventStatus, STATUS_STYLES } from "../utils/eventStatus";

interface EventsProps { user?: User; }

/* ─── Indian national holidays (centralized in utils/labClosure.ts) ─── */
const FIXED_SUNDAYS_CLOSED = true;

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/* ══════════════ EventCard component ══════════════ */
const EventCard: React.FC<{ event: any; onRegister?: (e: any) => void }> = ({ event, onRegister }) => {
  const navigate = useNavigate();
  const d = new Date(event.start_date);
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()].slice(0, 3).toUpperCase();
  const eventType = event.type || event.event_type || 'workshop';
  const spotsLeft = event.max_attendees - (event.registered_count ?? 0);
  const bannerUrl = event.banner_image || event.banner_url;
  const computedStatus = getComputedEventStatus(event);
  const statusStyle = STATUS_STYLES[computedStatus];
  const isCompleted = computedStatus === 'completed';
  const highlightCount = (event.highlights || []).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onClick={() => navigate(`/events/${event.id}`)}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md hover:border-slate-300"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        {bannerUrl ? (
          <img src={bannerUrl} alt={event.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <CalendarIcon className="h-10 w-10" aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700 shadow-sm">
            {eventType}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset shadow-sm ${statusStyle.cls}`}>
            {computedStatus === 'ongoing' && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />}
            {statusStyle.label}
          </span>
        </div>
        {isCompleted && highlightCount > 0 && (
          <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700 shadow-sm">
            <ImageIcon className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" /> {highlightCount} highlights
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-start gap-4">
          <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-brand-50 py-2">
            <span className="text-xs font-semibold text-brand-700">{month}</span>
            <span className="font-display text-xl font-bold leading-none text-brand-700">{day}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-semibold leading-snug text-slate-900 transition-colors group-hover:text-brand-600">{event.title}</h3>
            <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
              <span className="flex shrink-0 items-center gap-1"><Clock className="h-4 w-4 text-slate-400" aria-hidden="true" /> {event.start_time?.slice(0,5)}</span>
              <span className="flex min-w-0 items-center gap-1"><MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /><span className="truncate">{event.location}</span></span>
            </div>
          </div>
        </div>

        <p className="mb-5 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-600">
          "{event.description}"
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500"><Lock className="h-4 w-4" aria-hidden="true" /> Registration Closed</span>
          ) : (
            <div className="flex flex-col">
              <span className="text-xs text-slate-500">Availability</span>
              <span className={`text-sm font-semibold ${spotsLeft <= 5 ? "text-red-600" : "text-brand-600"}`}>
                {spotsLeft > 0 ? `${spotsLeft} spots left` : "SOLD OUT"}
              </span>
            </div>
          )}

          {isCompleted ? (
            <button onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.id}`); }}
              className="group/btn inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900">
              View Recap <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden="true" />
            </button>
          ) : spotsLeft > 0 ? (
            <button onClick={(e) => { e.stopPropagation(); onRegister?.(event); }}
              className="group/btn inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700">
              Register Now <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
};

/* ══════════════ MAIN ══════════════ */
const Events: React.FC<EventsProps> = ({ user }) => {
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "calendar" | "mybookings">("list");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [blockedDateObjs, setBlockedDateObjs] = useState<Date[]>([]);
  const [closures, setClosures] = useState<Map<string, string>>(new Map());
  const [bookings, setBookings] = useState<Map<string, any[]>>(new Map()); // date → bookings
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");

  // Date click modal state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateInfo, setSelectedDateInfo] = useState<any | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loadingMyBookings, setLoadingMyBookings] = useState(false);

  const loadMyBookings = useCallback(async () => {
    if (!user) return;
    setLoadingMyBookings(true);
    try {
      // /api/slots returns only the signed-in student's bookings.
      const data = await authService.getSlotRequests();
      setMyBookings(data || []);
    } catch (err) {
      console.error('Failed to load my bookings:', err);
    } finally {
      setLoadingMyBookings(false);
    }
  }, [user]);

  /* Load events + closures */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [evData, closureList, calendar, blDatesRes] = await Promise.all([
        authService.getEvents(),
        authService.getLabClosures().catch(() => []),
        authService.getSlotCalendar().catch(() => []),
        authService.getBlockedDates()
      ]);

      setEvents(evData ?? []);
      setBlockedDateObjs(blDatesRes ?? []);

      const closureMap = new Map<string, string>();
      (closureList ?? []).forEach((c: any) => closureMap.set(c.date, c.reason));
      setClosures(closureMap);

      const bookMap = new Map<string, any[]>();
      (calendar ?? []).forEach((b: any) => {
        const arr = bookMap.get(b.date) ?? [];
        arr.push(b);
        bookMap.set(b.date, arr);
      });
      setBookings(bookMap);
    } catch (err) {
      console.error("Load events error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (view === 'mybookings') loadMyBookings(); }, [view, loadMyBookings]);

  /* ─── Calendar helpers ─── */
  const eventsOnDate = (dateStr: string) => events.filter(e => e.start_date === dateStr);
  const bookingsOnDate = (dateStr: string) => bookings.get(dateStr) ?? [];

  const dayStatus = (dateStr: string): "closed" | "busy" | "available" | "past" => {
    const status = getLabStatus(dateStr, blockedDateObjs);
    if (status.isClosed) {
      if (status.type === 'past') return "past";
      return "closed";
    }
    const bks = bookingsOnDate(dateStr);
    if (bks.length >= 3) return "busy";
    return "available";
  };

  const formatDate = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const handleDayClick = (dateStr: string) => {
    const s = dayStatus(dateStr);
    if (s === "past") return; // Block past date modals

    // Get closure reason from centralized logic for consistency
    const status = getLabStatus(dateStr, blockedDateObjs);

    setSelectedDate(dateStr);
    setSelectedDateInfo({
      status: s,
      closureReason: status.reason,
      events: eventsOnDate(dateStr),
      bookings: bookingsOnDate(dateStr),
    });
  };

  /* ─── Day cell colors ─── */
  const cellCls = (dateStr: string, isToday: boolean) => {
    const s = dayStatus(dateStr);
    if (s === "past") return "pointer-events-none bg-slate-50 text-slate-400";
    if (s === "closed") return "bg-red-50 text-red-700 cursor-default";
    if (s === "busy")   return "bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer";
    if (isToday) return "bg-brand-600 text-white hover:bg-brand-700 cursor-pointer";
    return "bg-white text-slate-700 hover:bg-brand-50 cursor-pointer hover:text-brand-700";
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const filteredEvents = typeFilter === "all" ? events : events.filter(e => (e.type || e.event_type) === typeFilter);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <section className="border-b border-slate-200 bg-white pt-24 pb-10 md:pt-28 md:pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">Events & Lab Booking</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">Events Happening RIGHT NOW!</h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">Book lab slots, register for workshops, and see what's happening at  IDEA Lab.</p>
        </div>
      </section>

      <section className="bg-slate-50 py-10 md:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Toggle ── */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-1">
            {(["list", "calendar"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                {v === "list" ? <><List className="h-4 w-4" aria-hidden="true" />Events</> : <><CalendarIcon className="h-4 w-4" aria-hidden="true" />Calendar</>}
              </button>
            ))}
            {user && (
              <button onClick={() => setView('mybookings')} aria-pressed={view === 'mybookings'}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === 'mybookings' ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                My Bookings
              </button>
            )}
          </div>

          {view === "list" && (
            <div className="flex flex-wrap gap-2">
              {["all", "workshop", "masterclass", "showcase", "hackathon", "seminar"].map(t => (
                <button key={t} onClick={() => setTypeFilter(t)} aria-pressed={typeFilter === t}
                  className={`rounded-full border px-3 py-1 text-sm font-medium capitalize transition-colors ${
                    typeFilter === t ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}>{t === "all" ? "All Events" : t}</button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center" role="status">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden="true" /><span className="sr-only">Loading</span>
          </div>
        ) : view === "list" ? (
          /* ── EVENT LIST ── */
          <div>
            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <CalendarIcon className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="text-base font-semibold text-slate-900">No upcoming events</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredEvents.map(ev => (
                    <EventCard key={ev.id} event={ev} onRegister={(e) => navigate(`/events/${e.id}`)} />
                  ))}
              </div>
            )}
          </div>
        ) : view === "mybookings" ? (
          /* ── MY BOOKINGS ── */
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <h2 className="font-display text-xl font-semibold text-slate-900">My Slot Bookings</h2>
              <button onClick={() => { loadMyBookings(); setIsBookingModalOpen(true); }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
                <CalendarIcon className="h-4 w-4" aria-hidden="true" /> New Booking
              </button>
            </div>
            {loadingMyBookings ? (
              <div className="flex min-h-[40vh] items-center justify-center" role="status">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden="true" /><span className="sr-only">Loading</span>
              </div>
            ) : myBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <CalendarIcon className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="text-base font-semibold text-slate-900">No slot bookings yet</p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">Book a lab slot from the Calendar view</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myBookings.map(b => {
                  const statusCls: Record<string,string> = {
                    pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
                    approved: 'bg-blue-50 text-blue-700 ring-blue-600/20',
                    rejected: 'bg-red-50 text-red-700 ring-red-600/20'
                  };
                  return (
                    <div key={b.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <CalendarIcon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${statusCls[b.status] || statusCls.pending}`}>
                            {b.status}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(b.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="font-medium text-slate-900">{(b.start_time||'').slice(0,5)} – {(b.end_time||'').slice(0,5)}</p>
                        <p className="mt-0.5 truncate text-sm text-slate-500">{b.purpose || 'No purpose stated'}</p>
                        {b.rejection_reason && (
                          <p className="mt-1 text-sm text-red-600">Reason: {b.rejection_reason}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ── CALENDAR ── */
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Month Nav */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
              <h2 className="font-display text-xl font-semibold text-slate-900">
                {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h2>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentMonth(new Date())}
                  className="mr-1 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900">Today</button>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  aria-label="Previous month"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  aria-label="Next month"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"><ChevronRight className="h-5 w-5" /></button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600 sm:px-6">
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-brand-600" />Today</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-amber-100" />Busy</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-red-100" />Closed / Holiday</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded border border-slate-300 bg-white" />Available</span>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {DAY_NAMES.map(d => (
                <div key={d} className={`py-2 text-center text-xs font-semibold uppercase tracking-wider ${d === "Sun" ? "text-red-600" : "text-slate-500"}`}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`pad-${i}`} className="min-h-[88px] border-b border-r border-slate-100" />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = formatDate(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const evs = eventsOnDate(dateStr);
                const bks = bookingsOnDate(dateStr);
                const isToday = dateStr === todayStr;
                const cls = cellCls(dateStr, isToday);
                const status = dayStatus(dateStr);

                return (
                  <div key={day} onClick={() => handleDayClick(dateStr)}
                    className={`relative min-h-[88px] min-w-0 border-b border-r border-slate-100 p-1.5 transition-colors sm:p-2 ${cls}`}>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isToday ? "bg-white text-brand-700" : ""}`}>{day}</span>
                    {status === "closed" && <Lock className="absolute top-2 right-2 h-3 w-3 text-red-600" aria-hidden="true" />}
                    {evs.slice(0, 2).map(ev => (
                      <div key={ev.id} className="mt-1 truncate rounded bg-brand-100 px-1 py-0.5 text-xs font-medium text-brand-700">{ev.title}</div>
                    ))}
                    {bks.length > 0 && status !== "closed" && (
                      <div className="mt-1 truncate text-xs font-medium text-amber-700">{bks.length} booking{bks.length > 1 ? "s" : ""}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Booking CTA banner for guests ── */}
        {!user && (
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brand-100 bg-brand-50 p-6">
            <div>
              <p className="font-display text-lg font-semibold text-slate-900">Want to book a lab slot?</p>
              <p className="mt-1 text-sm text-slate-600">Log in to reserve time and register for events.</p>
            </div>
            <button onClick={() => navigate("/login")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
              Login / Sign Up
            </button>
          </div>
        )}
      </div>
      </section>

      {/* ── Date Detail Modal ── */}
      <AnimatePresence>
        {selectedDate && selectedDateInfo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
            onClick={() => setSelectedDate(null)}>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
              role="dialog" aria-modal="true" aria-labelledby="date-detail-title"
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
              {/* Modal header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "long" })}</p>
                  <h3 id="date-detail-title" className="font-display text-xl font-semibold text-slate-900">{new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</h3>
                </div>
                <button onClick={() => setSelectedDate(null)} aria-label="Close"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"><X className="h-5 w-5" /></button>
              </div>

              <div className="space-y-5 px-6 py-5">
                {/* Status banner */}
                {selectedDateInfo.status === "closed" ? (
                  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <Lock className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">Lab Closed</p>
                      <p className="text-red-700">{selectedDateInfo.closureReason}</p>
                    </div>
                  </div>
                ) : selectedDateInfo.status === "busy" ? (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" /> High demand — only limited slots available
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                    <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" /> Available for booking
                  </div>
                )}

                {/* Events on this day */}
                {selectedDateInfo.events.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Events</p>
                    <div className="space-y-2">
                      {selectedDateInfo.events.map((ev: any) => (
                        <div key={ev.id} className="rounded-lg border border-brand-100 bg-brand-50 p-3">
                          <p className="text-sm font-semibold text-slate-900">{ev.title}</p>
                          <p className="mt-0.5 text-xs text-slate-600">{ev.start_time?.slice(0,5)}–{ev.end_time?.slice(0,5)} · {ev.location}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Booking Section */}
                {selectedDateInfo.status !== "closed" && selectedDate && (
                  <div className="border-t border-slate-200 pt-4">
                    {user ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h4 className="text-base font-semibold text-slate-900">Need the Lab?</h4>
                            <p className="mt-0.5 text-sm text-slate-500">Reserve your workstation</p>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="mb-1 text-xs text-slate-500">Status</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${selectedDateInfo.status === 'busy' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 'bg-green-50 text-green-700 ring-green-600/20'}`}>
                              {selectedDateInfo.status === "busy" ? "Limited Slots" : "Available"}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => setIsBookingModalOpen(true)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <CalendarIcon className="h-5 w-5" aria-hidden="true" />
                          <span>Book Date</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                        <p className="text-sm text-slate-600">Login required to book slots</p>
                        <button onClick={() => navigate("/login")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900">Sign In / Register</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SlotBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        user={user}
        initialDate={selectedDate || ""}
        onSuccess={() => {
          setIsBookingModalOpen(false);
          setSelectedDate(null);
          loadData();
        }}
      />
    </div>
  );
};

export default Events;


import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import { Calendar, MapPin, Clock, ArrowLeft, Share2, CalendarPlus, UserCheck, Users, X, Loader2, CheckCircle, Lock, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { calendarFileName, calendarFileUrl } from '../utils/calendar';
import { getComputedEventStatus, STATUS_STYLES } from '../utils/eventStatus';
import { motion, AnimatePresence } from 'framer-motion';

const INPUT_CLS = 'block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';
const LABEL_CLS = 'mb-1.5 block text-sm font-medium text-slate-700';

const EventDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeHighlightIdx, setActiveHighlightIdx] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    degree: '',
    program: '',
    srn: '',
    phone_number: '+91 '
  });

  useEffect(() => {
    const fetchEvent = async () => {
      if (id) {
        try {
          const signedIn = !!localStorage.getItem('token');

          const data: any = await authService.getEventById(id);

          if (data) {
            setEvent({
              ...data,
              category: data.type || data.event_type,
              imageUrl: data.banner_image || data.banner_url || null,
              date: new Date(`${data.start_date}T${data.start_time || '00:00:00'}`)
            });

            if (signedIn) {
              if (await authService.isRegisteredForEvent(id).catch(() => false)) setRegistered(true);
              const { user } = await authService.getCurrentSession();
              if (user?.name) setForm(prev => ({ ...prev, name: user.name }));
            }
          }
        } catch (err) {
          console.error("Error fetching event details:", err);
        }
      }
      setLoading(false);
    };
    fetchEvent();
  }, [id]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Any signed-in account can register;
      // the API takes the user id and email from the session.
      if (!localStorage.getItem('token')) { navigate('/login'); return; }

      const payload = {
        event_id: id,
        ...form
      };

      await authService.registerForEvent(payload);
      setRegistered(true);
      setRegistering(false);
    } catch (err: any) {
      console.error("Registration detail error:", err);
      alert(err.message || "Registration failed. Please check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-white pt-16" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden="true" /><span className="sr-only">Loading</span>
    </div>
  );
  if (!event) return <div className="min-h-screen bg-white pt-28 text-center text-base text-slate-600">Event not found</div>;

  const calendarUrl = event ? calendarFileUrl(event) : '#';
  const spotsLeft = (event?.max_attendees || 0) - (event?.registered_count || 0);
  const computedStatus = getComputedEventStatus(event);
  const statusStyle = STATUS_STYLES[computedStatus];
  const isCompleted = computedStatus === 'completed';
  const highlights: string[] = event.highlights || [];

  const eventDate = event?.date instanceof Date && !isNaN(event.date.getTime())
    ? event.date
    : new Date();

  return (
    <div className="min-h-screen bg-white">
      {/* Page header */}
      <section className="border-b border-slate-200 bg-white pt-24 pb-10 md:pt-28 md:pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
             <button onClick={() => navigate('/events')} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Events
             </button>
             <div className="mt-6">
               <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusStyle.cls}`}>
                  {statusStyle.label}
               </span>
             </div>
             <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">{event.title}</h1>
             <div className="mt-4 flex flex-col flex-wrap gap-3 text-sm text-slate-600 sm:text-base md:flex-row md:gap-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 shrink-0 text-brand-500" aria-hidden="true" />
                  {eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 shrink-0 text-brand-500" aria-hidden="true" />
                  {eventDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
                <div className="flex items-center gap-2"><MapPin className="h-5 w-5 shrink-0 text-brand-500" aria-hidden="true" /> {event.location || 'Location TBD'}</div>
             </div>
        </div>
      </section>

      <section className="bg-slate-50 py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">

             {/* Content Side */}
             <div className="order-2 space-y-12 lg:order-1 lg:w-2/3">
                 {event.imageUrl && (
                   <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100">
                     <img src={event.imageUrl} alt={event.title} className="h-full w-full object-cover" />
                   </div>
                 )}
                 <div>
                   <h2 className="font-display text-xl font-semibold text-slate-900">About This Event</h2>
                   <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                      {event.description || 'No description provided.'}
                   </p>
                   <div className="mt-8 flex items-center gap-2 text-sm font-medium text-slate-500">
                     <Users className="h-5 w-5 text-brand-500" aria-hidden="true" /> {event.registered_count || 0} / {event.max_attendees || 0} Participants
                   </div>
                 </div>

                 {/* Past Event Highlights */}
                 {isCompleted && highlights.length > 0 && (
                   <section>
                     <h2 className="mb-6 flex items-center gap-3 font-display text-xl font-semibold text-slate-900">
                       <ImageIcon className="h-5 w-5 text-brand-500" aria-hidden="true" /> Event Highlights
                     </h2>
                     <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                       {highlights.map((url, idx) => (
                         <div
                           key={idx}
                           onClick={() => setActiveHighlightIdx(idx)}
                           className={`group relative cursor-zoom-in overflow-hidden rounded-xl bg-slate-100 ${idx === 0 ? 'col-span-2 h-56' : 'h-36'}`}
                         >
                           <img src={url} alt={`Highlight ${idx + 1}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                         </div>
                       ))}
                     </div>
                   </section>
                 )}
             </div>

             {/* Registration Side */}
             <div className="order-1 lg:order-2 lg:w-1/3">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
                   <h3 className="mb-4 font-display text-xl font-semibold text-slate-900">Registration</h3>

                   {isCompleted ? (
                     <div className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-6 py-3 text-sm font-medium text-slate-600">
                       <Lock className="h-4 w-4" aria-hidden="true" /> Registrations Closed
                     </div>
                   ) : !registered ? (
                       <button
                         disabled={spotsLeft <= 0}
                         onClick={() => setRegistering(true)}
                         className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                       >
                         {spotsLeft > 0 ? 'Register Now' : 'Event Full'}
                       </button>
                   ) : (
                       <button disabled className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-50 px-6 py-3 text-base font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
                          <UserCheck className="h-5 w-5" aria-hidden="true" /> Registered Successfully
                       </button>
                   )}

                   <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                       <a
                          href={calendarUrl}
                          download={calendarFileName(event)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                       >
                          <CalendarPlus className="h-4 w-4" aria-hidden="true" /> <span className="hidden md:inline">Add to Calendar</span><span className="md:hidden">Calendar</span>
                       </a>

                       <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
                          <Share2 className="h-4 w-4" aria-hidden="true" /> Share
                       </button>
                   </div>

                   <div className={`mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ring-1 ring-inset ${statusStyle.cls}`}>
                     {computedStatus === 'ongoing' && <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />}
                     {computedStatus === 'upcoming' && <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />}
                     {computedStatus === 'completed' && <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
                     {statusStyle.label} — {computedStatus === 'upcoming' ? `Starts ${event.start_date}` : computedStatus === 'ongoing' ? 'Happening now!' : `Ended ${event.end_date || event.start_date}`}
                   </div>
                </div>
             </div>
          </div>
      </div>
      </section>

      {/* Highlights Lightbox */}
      <AnimatePresence>
        {activeHighlightIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setActiveHighlightIdx(null); }}
          >
            <button onClick={() => setActiveHighlightIdx(null)} aria-label="Close"
              className="absolute top-4 right-4 z-[110] inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/20">
              <X className="h-5 w-5" />
            </button>
            {highlights.length > 1 && (
              <>
                <button onClick={() => setActiveHighlightIdx((activeHighlightIdx - 1 + highlights.length) % highlights.length)} aria-label="Previous image"
                  className="absolute left-4 top-1/2 z-[110] inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/20">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={() => setActiveHighlightIdx((activeHighlightIdx + 1) % highlights.length)} aria-label="Next image"
                  className="absolute right-4 top-1/2 z-[110] inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/20">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            <div className="relative flex max-h-[85vh] max-w-5xl items-center justify-center">
              <img src={highlights[activeHighlightIdx]} alt="Highlight" className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-xl" />
              <div className="absolute -bottom-10 w-full text-center text-xs font-medium text-white/80">
                {activeHighlightIdx + 1} of {highlights.length}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Registration Overlay */}
      {registering && !isCompleted && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
          <div className="absolute inset-0 bg-slate-900/50" aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="event-pass-title"
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
             <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
               <div>
                 <h2 id="event-pass-title" className="font-display text-xl font-semibold text-slate-900">Event Pass</h2>
                 <p className="mt-0.5 text-sm text-slate-500">Complete your registration</p>
               </div>
               <button onClick={() => setRegistering(false)} aria-label="Close"
                 className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
                 <X className="h-5 w-5" />
               </button>
             </div>

             <form onSubmit={handleRegister}>
               <div className="space-y-4 px-6 py-5">
                 <div>
                   <label htmlFor="reg-name" className={LABEL_CLS}>Full Name</label>
                   <input id="reg-name" required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                     className={INPUT_CLS} />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reg-degree" className={LABEL_CLS}>Degree</label>
                      <input id="reg-degree" required value={form.degree} onChange={e => setForm({...form, degree: e.target.value})}
                        placeholder="e.g. B.Tech"
                        className={INPUT_CLS} />
                    </div>
                    <div>
                      <label htmlFor="reg-srn" className={LABEL_CLS}>SRN / ID</label>
                      <input id="reg-srn" required value={form.srn} onChange={e => setForm({...form, srn: e.target.value})}
                        placeholder="RE22..."
                        className={INPUT_CLS} />
                    </div>
                 </div>
                 <div>
                   <label htmlFor="reg-program" className={LABEL_CLS}>Program / Branch</label>
                   <input id="reg-program" required value={form.program} onChange={e => setForm({...form, program: e.target.value})}
                     className={INPUT_CLS} />
                 </div>
                  <div>
                    <label htmlFor="reg-phone" className={LABEL_CLS}>Phone Number</label>
                    <input
                      id="reg-phone"
                      required
                      type="tel"
                      placeholder="+91 0000000000"
                      value={form.phone_number}
                      onChange={e => {
                        let val = e.target.value;
                        if (!val.startsWith('+91 ')) val = '+91 ' + val.replace(/^\+91\s?/, '');
                        setForm({...form, phone_number: val});
                      }}
                      className={INPUT_CLS}
                    />
                  </div>
               </div>

               <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                 <button type="submit" disabled={submitting}
                   className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
                   {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserCheck className="h-4 w-4" aria-hidden="true" />}
                   {submitting ? 'Processing...' : 'Confirm Registration'}
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetails;

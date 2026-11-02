
import React, { useState, useEffect } from 'react';
import Hero from '../components/Hero';
import { Calendar, ArrowRight, MapPin, Clock, Star, Layers, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const TESTIMONIALS = [
  {
    id: 1,
    text: "The IDEA Lab provided me with the tools and mentorship to turn my paper concept into a patented prototype.",
    author: "Aditya Rao",
    role: "Final Year, Mechanical Engg",
    image: avatarUrl("Aditya Rao", "#0D8ABC")
  },
  {
    id: 2,
    text: "As a faculty member, having an industrial-grade fabrication facility on campus allows us to bridge the gap between theory and application.",
    author: "Dr. Meera S.",
    role: "Associate Professor, ECE",
    image: avatarUrl("Meera S", "#db2777")
  },
  {
    id: 3,
    text: "The cross-disciplinary environment here is unmatched. I collaborated with CS students to build AI for my biotech project.",
    author: "Rahul Varma",
    role: "Researcher, Biotechnology",
    image: avatarUrl("Rahul Varma", "#ea580c")
  }
];

import { authService } from '../services/api';
import { avatarUrl } from "../utils/avatar";

const reveal = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.4, ease: "easeOut" },
} as const;

const Home: React.FC = () => {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);



  useEffect(() => {
    let mounted = true;
    const fetchUpcomingEvents = async () => {
      try {
        const today = new Date();
        const twoMonthsLater = new Date();
        twoMonthsLater.setMonth(today.getMonth() + 2);

        const from = today.toISOString().split('T')[0];
        const to = twoMonthsLater.toISOString().split('T')[0];
        const all: any[] = await authService.getEvents();
        const data = (all || [])
          .filter(e => e.start_date >= from && e.start_date <= to)
          .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
          .slice(0, 3);
        if (mounted) setUpcomingEvents(data);
      } catch (err) {
        console.error("Error fetching homepage events:", err);
      } finally {
        if (mounted) setLoadingEvents(false);
      }
    };

    fetchUpcomingEvents();

    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Hero />

      {/* Detailed About Section */}
      <section className="bg-white py-16 md:py-24">
          <motion.div
            {...reveal}
            className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
          >
              <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-start">

                  {/* Text Content */}
                  <div className="lg:w-3/5">
                      <span className="flex items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">
                        <span className="h-0.5 w-8 bg-brand-500" aria-hidden="true"></span> About IDEA Lab
                      </span>
                      <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">
                        Catalyzing <br/>
                        <span className="text-brand-600">Future Innovation.</span>
                      </h2>

                      <div className="mt-6 space-y-4 text-base sm:text-lg leading-relaxed text-slate-600">
                          <p>
                            IDEA Lab is a dedicated innovation ecosystem designed to empower students, faculty, and young innovators to transform ideas into real-world solutions. The lab provides an open, collaborative environment equipped with advanced tools, rapid prototyping facilities, and modern digital fabrication technologies.
                          </p>
                          <p className="hidden md:block">
                            At its core, IDEA Lab encourages experiential learning—allowing learners to design, build, test, and refine their creations while developing strong technical and entrepreneurial skills.
                          </p>
                          <p className="hidden md:block">
                            The initiative aims to bridge the gap between classroom concepts and practical application, fostering a culture where innovation becomes a habit.
                          </p>

                          <div className="!mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                              <p className="font-display text-lg md:text-xl font-medium leading-relaxed text-slate-900">
                                "A place where imagination meets engineering, IDEA Lab stands as a catalyst for innovation."
                              </p>
                              <div className="mt-4 flex items-center gap-3">
                                  <div className="h-0.5 w-8 bg-brand-500" aria-hidden="true"></div>
                                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Innovation Mantra</span>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Visual/Image Side */}
                  <motion.div
                    {...reveal}
                    transition={{ ...reveal.transition, delay: 0.1 }}
                    className="lg:w-2/5 w-full relative lg:mt-10"
                  >
                      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent z-10"></div>
                          <img
                            src="img/homepage/DSC09625.JPG"
                            alt="Student Innovation"
                            loading="eager"
                            width="800"
                            height="600"
                            className="w-full h-full object-cover min-h-[300px] md:min-h-[400px]"
                          />
                          <div className="absolute bottom-6 left-6 right-6 z-20">
                              <span className="inline-flex rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700 shadow-sm">Innovation Hub</span>
                              <p className="mt-2 max-w-xs text-sm text-white">Turning theoretical concepts into functional prototypes.</p>
                          </div>
                      </div>
                  </motion.div>
              </div>
          </motion.div>
      </section>

      {/* TIMELINE SECTION (Responsive: Slide on Mobile, Zigzag on Desktop) */}
      <section className="bg-slate-50 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...reveal} className="mx-auto max-w-2xl text-center mb-10 md:mb-14">
             <span className="inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">
               <Calendar className="h-4 w-4" aria-hidden="true" /> Mark Your Calendars
             </span>
             <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">Upcoming Events</h2>
          </motion.div>

          <div className="relative">
            {/* Vertical Center Line (Desktop Only) */}
            {upcomingEvents.length > 0 && (
              <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 -translate-x-1/2" aria-hidden="true"></div>
            )}

            {/* Mobile Horizontal Scroll Container / Desktop Vertical Stack */}
            <div className="flex md:block overflow-x-auto md:overflow-visible gap-6 snap-x snap-mandatory pb-4 md:pb-0 no-scrollbar md:space-y-12">
              {loadingEvents ? (
                <div className="flex w-full flex-col items-center justify-center py-20 text-center text-sm text-slate-500" role="status">
                  <Loader2 className="mb-4 h-8 w-8 animate-spin text-brand-600" aria-hidden="true" />
                  Loading upcoming events...
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="relative z-10 w-full rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
                  No upcoming events scheduled for the next 2 months.
                </div>
              ) : (
                upcomingEvents.map((event, index) => {
                  const eventDate = new Date(`${event.start_date}T${event.start_time || '00:00:00'}`);

                  return (
                    <div
                        key={event.id}
                        className={`min-w-[85vw] md:min-w-0 snap-center relative flex flex-col md:flex-row items-center gap-8 ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}
                    >

                      {/* Content Card */}
                      <div className="w-full md:w-1/2 group">
                        <div className={`relative h-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 ${index % 2 === 0 ? 'md:mr-12' : 'md:ml-12'}`}>

                           {/* Date Badge */}
                           <div className="absolute top-6 right-6 flex min-w-[60px] flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <span className="text-xs font-semibold uppercase text-slate-500">{eventDate.toLocaleString('default', { month: 'short' })}</span>
                              <span className="font-display text-2xl font-bold text-slate-900">{eventDate.getDate()}</span>
                           </div>

                           <span className="mb-4 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20">
                                {event.event_type}
                           </span>

                           <Link to={`/events/${event.id}`}>
                              <h3 className="mb-3 truncate pr-20 font-display text-lg sm:text-xl font-semibold text-slate-900 transition-colors group-hover:text-brand-600">{event.title}</h3>
                           </Link>

                           <div className="mb-4 flex flex-col gap-2 text-sm text-slate-500">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                {eventDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </div>
                              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" /> {event.location}</div>
                           </div>

                           <p className="mb-6 line-clamp-3 text-sm leading-relaxed text-slate-600">{event.description}</p>

                           <Link to={`/events/${event.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4">
                              Event Details <ArrowRight className="h-4 w-4" aria-hidden="true" />
                           </Link>
                        </div>
                      </div>

                      {/* Center Node (Desktop Only) */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center justify-center h-12 w-12 rounded-full border-4 border-slate-50 bg-white ring-1 ring-slate-200 z-10" aria-hidden="true">
                         <div className="h-3 w-3 rounded-full bg-brand-500"></div>
                      </div>

                      {/* Empty space for balance (Desktop Only) */}
                      <div className="w-full md:w-1/2 hidden md:block"></div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-10 text-center md:mt-14">
               <Link to="/events" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700">
                  View Full Schedule <ArrowRight className="h-5 w-5" aria-hidden="true" />
               </Link>
            </div>
          </div>
        </div>
      </section>

      {/* UNIFIED FACILITIES SECTION (Hardware, 3D Print & PCB) */}
      <section className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div {...reveal} className="mx-auto max-w-2xl text-center mb-10 md:mb-14">
                <span className="inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">
                    <Layers className="h-4 w-4" aria-hidden="true" /> Lab Resources
                </span>
                <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">
                    Build with <span className="text-brand-600">The Best.</span>
                </h2>
            </motion.div>

            {/* Carousel for mobile, Grid for desktop */}
            <div
              className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-x-auto md:overflow-visible pb-4 md:pb-0 scrollbar-hide snap-x snap-mandatory"
            >

                {/* Hardware Card */}
                <div className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 shrink-0 w-[85vw] md:w-auto snap-center">
                    <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                        <img
                            src="img/comp/DSC09591.JPG"
                            alt="Hardware Library"
                            loading="eager"
                            width="600"
                            height="450"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                    </div>

                    <div className="flex flex-1 flex-col p-5">

                        <h3 className="font-display text-lg font-semibold text-slate-900">Hardware Library</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                            Microcontrollers, sensors, and actuators. Real-time tracking and instant digital indents.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {['Arduino/ESP32', 'Sensors', 'Motors'].map((tag, i) => (
                                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/10">
                                    {tag}
                                </span>
                            ))}
                        </div>

                        <Link to="/components" className="mt-auto self-start pt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4">
                            Browse <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </Link>
                    </div>
                </div>

                {/* 3D Print Card */}
                <div className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 shrink-0 w-[85vw] md:w-auto snap-center">
                    <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                        <img
                            src="img/comp/DSC09502.JPG"
                            alt="3D Printing"
                            loading="eager"
                            width="600"
                            height="450"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                    </div>

                    <div className="flex flex-1 flex-col p-5">

                        <h3 className="font-display text-lg font-semibold text-slate-900">Fabrication Station</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                            Industrial-grade FDM and SLA printing. Upload files and track progress remotely.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {['FDM', 'SLA Resin', 'Rapid Proto'].map((tag, i) => (
                                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/10">
                                    {tag}
                                </span>
                            ))}
                        </div>

                        <Link to="/3d-print" className="mt-auto self-start pt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4">
                            Start Printing <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </Link>
                    </div>
                </div>

                {/* PCB Printing Card */}
                <div className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 shrink-0 w-[85vw] md:w-auto snap-center">
                    <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                        <img
                            src="img/homepage/pcb.JPG"
                            alt="PCB Fabrication"
                            loading="eager"
                            width="600"
                            height="450"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                       <h3 className="font-display text-lg font-semibold text-slate-900">PCB Lab</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                            Complete PCB fabrication workflow. From circuit design to etching, soldering, and testing.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {['Etching', 'Soldering', 'Testing', 'Design'].map((tag, i) => (
                                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/10">
                                    {tag}
                                </span>
                            ))}
                        </div>

                        <Link to="/pcb-order" className="mt-auto self-start pt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4">
                            Order PCB <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </Link>
                    </div>
                </div>

            </div>
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section className="bg-slate-50 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
           <motion.div {...reveal} className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">

              <div className="md:w-1/3 text-center md:text-left">
                 <span className="block text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">Community Voices</span>
                 <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">What People Say</h2>
                 <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
                   Hear from the students, faculty, and researchers who are building the future at IDEA Lab.
                 </p>
                 <Link to="/testimonials" className="group mt-6 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4">
                    View All Stories <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                 </Link>
              </div>

              <div className="md:w-2/3 w-full">
                 <div className="relative flex min-h-[250px] md:min-h-[300px] flex-col justify-center rounded-xl border border-slate-200 bg-white p-6 pb-14 md:p-10 md:pb-14 shadow-sm">

                    <div>
                       <div className="flex gap-1 mb-4 md:mb-6 text-brand-500 justify-center md:justify-start" aria-hidden="true">
                          {[1,2,3,4,5].map(star => <Star key={star} className="h-4 w-4 md:h-5 md:w-5 fill-current" />)}
                       </div>

                       <p key={activeTestimonial} className="mb-6 md:mb-8 animate-fade-in text-center md:text-left font-display text-lg md:text-xl font-medium leading-relaxed text-slate-900">
                         "{TESTIMONIALS[activeTestimonial].text}"
                       </p>

                       <div className="flex items-center gap-4 border-t border-slate-200 pt-6 animate-fade-in justify-center md:justify-start">
                          <img
                             src={TESTIMONIALS[activeTestimonial].image}
                             alt={TESTIMONIALS[activeTestimonial].author}
                             className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200"
                          />
                          <div className="text-left">
                             <h4 className="text-sm md:text-base font-semibold text-slate-900">{TESTIMONIALS[activeTestimonial].author}</h4>
                             <p className="text-sm text-slate-500">{TESTIMONIALS[activeTestimonial].role}</p>
                          </div>
                       </div>
                    </div>

                    {/* Indicators */}
                    <div className="absolute bottom-2 right-4 md:right-6 flex gap-1">
                       {TESTIMONIALS.map((_, idx) => (
                          <button
                             key={idx}
                             onClick={() => setActiveTestimonial(idx)}
                             aria-label={`Show testimonial ${idx + 1}`}
                             aria-current={idx === activeTestimonial}
                             className="flex h-10 items-center px-1"
                          >
                             <span className={`block h-1.5 rounded-full transition-all duration-300 ${idx === activeTestimonial ? 'w-6 bg-brand-600' : 'w-2 bg-slate-200 hover:bg-slate-300'}`} />
                          </button>
                       ))}
                    </div>
                 </div>
              </div>

           </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...reveal} className="rounded-2xl border border-brand-100 bg-brand-50 px-6 py-12 text-center md:px-12 md:py-16">
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">Ready to build the future?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">
              Join a community of innovators. The AICTE IDEA Lab is open to all students.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
               <Link to="/events" className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700">
                Browse Events
              </Link>
              <Link to="/login" className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900">
                Member Login
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;

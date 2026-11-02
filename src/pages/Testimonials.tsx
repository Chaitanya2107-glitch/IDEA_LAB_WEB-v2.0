
import React from 'react';
import { Star } from 'lucide-react';
import { avatarUrl } from "../utils/avatar";
// Assuming testimonials remain static for now
const TESTIMONIALS = [ // Assuming testimonials remain static for now
  {
    id: 1,
    text: "The IDEA Lab provided me with the tools and mentorship to turn my paper concept into a patented prototype. The 24/7 access is a game changer.",
    author: "Aditya Rao",
    role: "Final Year, Mechanical Engg",
    image: avatarUrl("Aditya Rao", "#0D8ABC")
  },
  {
    id: 2,
    text: "As a faculty member, having an industrial-grade fabrication facility on campus allows us to bridge the gap between theory and practical application effortlessly.",
    author: "Dr. Meera S.",
    role: "Associate Professor, ECE",
    image: avatarUrl("Meera S", "#db2777")
  },
  {
    id: 3,
    text: "The cross-disciplinary environment here is unmatched. I collaborated with CS students to build AI for my biotech project. Simply amazing.",
    author: "Rahul Varma",
    role: "Researcher, Biotechnology",
    image: avatarUrl("Rahul Varma", "#ea580c")
  },
  {
    id: 4,
    text: "Access to high-end CNC machines and 3D printers helped our startup 'AgriTech' build the MVP in record time.",
    author: "Sneha Kapoor",
    role: "Alumni & Founder, AgriTech",
    image: avatarUrl("Sneha Kapoor", "#22c55e")
  },
  {
    id: 5,
    text: "The workshops on IoT and Embedded Systems gave me practical skills that landed me my dream job at Bosch.",
    author: "Karthik N.",
    role: "Student, EEE",
    image: avatarUrl("Karthik N", "#6366f1")
  },
  {
    id: 6,
    text: "A truly world-class facility. The mentorship from industry experts during the hackathons was invaluable.",
    author: "Priya D.",
    role: "Student, CSE",
    image: avatarUrl("Priya D", "#f59e0b")
  }
];

const TestimonialCard: React.FC<{ t: any, isMobile?: boolean }> = ({ t, isMobile }) => (
    <div className={`group flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${
        isMobile
        ? 'min-w-[300px] w-[85vw] snap-center mr-4'
        : 'transition-shadow hover:shadow-md hover:border-slate-300'
    }`}>
        <div>
            <div className="mb-4 flex gap-1 text-brand-500" aria-hidden="true">
                {[1,2,3,4,5].map(s => <Star key={s} className="h-4 w-4 fill-current" />)}
            </div>
            <p className="mb-6 text-base leading-relaxed text-slate-600">"{t.text}"</p>
        </div>

        <div className="flex items-center gap-4 border-t border-slate-200 pt-6">
            <img src={t.image} alt={t.author} className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200" />
            <div>
                <h4 className="text-base font-semibold text-slate-900">{t.author}</h4>
                <p className="text-sm text-slate-500">{t.role}</p>
            </div>
        </div>
    </div>
);

const Testimonials: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">

      {/* Header */}
      <section className="border-b border-slate-200 bg-white pt-24 pb-10 md:pt-28 md:pb-12">
         <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">Success Stories</h1>
            <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">
              Discover how the IDEA Lab is transforming education and innovation at REVA University.
            </p>
         </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">

         {/* MOBILE VIEW: Horizontal Scrolling Snap List */}
         <div className="md:hidden">
             <div className="flex overflow-x-auto pb-4 snap-x snap-mandatory no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6">
                {TESTIMONIALS.map(t => (
                   <TestimonialCard key={t.id} t={t} isMobile={true} />
                ))}
                {/* Spacer for right padding */}
                <div className="min-w-[1px] h-1"></div>
             </div>
             <div className="mt-2 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                 Swipe to see more
             </div>
         </div>

         {/* DESKTOP VIEW: Grid Layout */}
         <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
               <TestimonialCard key={t.id} t={t} isMobile={false} />
            ))}
         </div>

      </div>
    </div>
  );
};

export default Testimonials;

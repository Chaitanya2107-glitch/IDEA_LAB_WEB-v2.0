
import React from 'react';
import { FileText, Download, ExternalLink, Video } from 'lucide-react';
// Assuming this page remains static for now
const Resources: React.FC = () => { // Assuming this page remains static for now
  return (
    <div className="min-h-screen bg-white">
      <section className="border-b border-slate-200 bg-white pt-24 pb-10 md:pt-28 md:pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">Student Resources</h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">Manuals, Software, and Guidelines for IDEA Lab equipment.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
         <div className="grid gap-6 lg:gap-8 md:grid-cols-2">

            {/* Downloads */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
               <h2 className="mb-6 flex items-center gap-3 font-display text-xl font-semibold text-slate-900">
                  <FileText className="h-5 w-5 text-brand-500" aria-hidden="true" /> Manuals & Guidelines
               </h2>
               <div className="space-y-3">
                  {[
                     "IDEA Lab Safety Protocol (PDF)",
                     "3D Printer Operation Manual (v2.1)",
                     "Laser Cutter Safety Guidelines",
                     "Project Proposal Template (DOCX)",
                     "Indent Request Format"
                  ].map((item, i) => (
                     <div key={i} className="group flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50">
                        <span className="text-sm font-medium text-slate-700">{item}</span>
                        <Download className="h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-brand-600" aria-hidden="true" />
                     </div>
                  ))}
               </div>
            </div>

            {/* Software Links */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
               <h2 className="mb-6 flex items-center gap-3 font-display text-xl font-semibold text-slate-900">
                  <ExternalLink className="h-5 w-5 text-brand-500" aria-hidden="true" /> Software Tools
               </h2>
               <div className="space-y-3">
                  {[
                     { name: "Ultimaker Cura (Slicer)", desc: "For FDM 3D Printing" },
                     { name: "Autodesk Fusion 360", desc: "CAD/CAM Design (Student License)" },
                     { name: "Arduino IDE", desc: "Microcontroller Programming" },
                     { name: "KiCad PCB", desc: "Electronics Design Automation" }
                  ].map((item, i) => (
                     <div key={i} className="group flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50">
                        <div>
                           <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                           <p className="text-sm text-slate-500">{item.desc}</p>
                        </div>
                        <ExternalLink className="h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-brand-600" aria-hidden="true" />
                     </div>
                  ))}
               </div>
            </div>

            {/* Tutorials */}
             <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
               <h2 className="mb-6 flex items-center gap-3 font-display text-xl font-semibold text-slate-900">
                  <Video className="h-5 w-5 text-brand-500" aria-hidden="true" /> Video Tutorials
               </h2>
               <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((_, i) => (
                     <div key={i} className="group relative aspect-video cursor-pointer overflow-hidden rounded-lg bg-slate-100">
                        <img src={['/img/comp/DSC09506.JPG', '/img/comp/DSC09520.JPG', '/img/comp/DSC09532.JPG', '/img/comp/DSC09579.JPG', '/img/comp/DSC09587.JPG', '/img/comp/DSC09598.JPG'][i % 6]} alt="Tutorial" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-slate-950/60 to-transparent">
                           <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950/40 text-white ring-1 ring-inset ring-white/25">
                              <PlayIcon />
                           </div>
                        </div>
                        <div className="absolute bottom-4 left-4 right-4">
                           <p className="text-sm font-semibold text-white">Introduction to {i === 0 ? '3D Printing' : i === 1 ? 'CNC Machining' : 'PCB Design'}</p>
                        </div>
                     </div>
                  ))}
               </div>
            </div>

         </div>
      </div>
    </div>
  );
};

const PlayIcon = () => (
   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
);

export default Resources;

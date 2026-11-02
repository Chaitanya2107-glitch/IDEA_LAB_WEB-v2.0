import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Play, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import { FadeIn } from '../components/FadeIn';

const ProjectCard: React.FC<{ project: any }> = ({ project }) => {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isHovered && videoRef.current && project.video) {
      videoRef.current.currentTime = 0;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } else if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [isHovered, project.video]);

  return (
    <div
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md hover:border-slate-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
         <img
            src={project.image_url || project.image}
            alt={project.title}
            loading="lazy"
            className={`h-full w-full object-cover transition-opacity duration-300 ${isHovered && project.video ? 'opacity-0' : 'opacity-100'}`}
         />
         {project.video && (
             <video
                ref={videoRef}
                src={project.video}
                loop
                muted
                playsInline
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
             />
         )}
         <span className="absolute top-3 left-3 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700 shadow-sm">
           {project.category}
         </span>
         {project.video && (
             <div className={`absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition-opacity duration-300 ${isHovered ? 'opacity-0' : 'opacity-100'}`}>
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
             </div>
         )}
      </div>

      <div className="flex flex-1 flex-col p-5">
         <h3 className="line-clamp-2 font-display text-lg font-semibold text-slate-900 transition-colors group-hover:text-brand-600">{project.title}</h3>
         <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-600">
            {project.description}
         </p>

         <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <span className="truncate text-sm text-slate-500">By {project.author}</span>
            <button
                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4"
            >
                View Project <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </button>
         </div>
      </div>
    </div>
  );
};

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchProjects = async () => {
      try {
        const data = await authService.getProjects();
        if (mounted) {
          setProjects(data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error("Fetch projects error:", err);
        if (mounted) setLoading(false);
      }
    };
    fetchProjects();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Page header ── */}
      <section className="border-b border-slate-200 bg-white pt-24 pb-10 md:pt-28 md:pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">
            <Sparkles className="h-4 w-4 text-brand-500" aria-hidden="true" /> Innovation Showcase
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
            Innovation in<br />
            <span className="text-brand-600">Continuous Motion</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">
            Explore the breakthrough technologies and creative solutions developed by the brilliant minds at REVA IDEA Lab.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Real-time Projects", "Industry Standard", "Student Driven", "Impact Focus"].map(s => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/10">{s}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => <div key={i} className="h-96 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : (
            <FadeIn className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map(proj => (
                 <ProjectCard key={proj.id} project={proj} />
              ))}
            </FadeIn>
          )}
        </div>
      </section>
    </div>
  );
};

export default Projects;

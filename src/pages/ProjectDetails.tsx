
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import { ArrowLeft, Calendar, Tag, User, Layers, ExternalLink, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [activeImageIdx, setActiveImageIdx] = useState<number | null>(null);

  const isMediaVideo = (url: string) => {
    if (!url) return false;
    return url.toLowerCase().match(/\.(mp4|webm|mov|ogg|avi)$/) || url.includes('/videos/');
  };

  useEffect(() => {
    const fetchProject = async () => {
      if (id) {
        const data: any = await authService.getProjectById(id).catch(() => null);

        if (data) {
          setProject({
            ...data,
            longDescription: data.long_description || data.description
          });
        }
      }
      setLoading(false);
    };
    fetchProject();
  }, [id]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-white pt-16" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden="true" /><span className="sr-only">Loading</span>
    </div>
  );

  if (!project) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 pt-16 text-center">
        <h2 className="mb-4 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Project Not Found</h2>
        <button onClick={() => navigate('/projects')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700">Back to Projects</button>
    </div>
  );

  const heroImage = project.image_url || project.image;
  const hasHeroVideo = project.video && isMediaVideo(project.video);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Page header */}
      <section className="border-b border-slate-200 bg-white pt-24 pb-10 md:pt-28 md:pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <button onClick={() => navigate('/projects')} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All Projects
            </button>
            <div className="mt-6">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20">
                    {project.category}
                </span>
            </div>
            <h1 className="mt-2 max-w-4xl font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">{project.title}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600 sm:text-base">
                <div className="flex items-center gap-2"><User className="h-5 w-5 text-brand-500" aria-hidden="true" /> {project.author}</div>
                <div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-brand-500" aria-hidden="true" /> {project.date}</div>
            </div>
        </div>
      </section>

      <section className="bg-slate-50 py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">

              {/* Main Content */}
              <div className="space-y-12 lg:w-2/3">
                  <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100">
                      {hasHeroVideo ? (
                          <video src={project.video} autoPlay loop muted playsInline className="h-full w-full object-cover" />
                      ) : heroImage ? (
                          <img src={heroImage} alt={project.title} className="h-full w-full object-cover" />
                      ) : (
                          <div className="flex h-full w-full items-center justify-center">
                              <Layers className="h-16 w-16 text-slate-300" aria-hidden="true" />
                          </div>
                      )}
                  </div>

                  <section>
                      <h2 className="font-display text-xl font-semibold text-slate-900">Project by {project.author}</h2>
                      <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">{project.long_description || project.description}</p>
                  </section>

                  {project.gallery && project.gallery.length > 0 && (
                      <section>
                          <h2 className="mb-6 font-display text-xl font-semibold text-slate-900">Project Gallery Highlights</h2>
                          <div className="grid grid-cols-2 gap-3 md:gap-6">
                              {project.gallery.map((url, idx) => {
                                  const isVideo = isMediaVideo(url);
                                  return (
                                    <div
                                      key={idx}
                                      className={`group relative cursor-zoom-in overflow-hidden rounded-xl bg-slate-100 shadow-sm transition-shadow hover:shadow-md ${idx === 0 ? 'col-span-2 h-[200px] md:h-[400px]' : 'h-[120px] md:h-[250px]'}`}
                                      onClick={() => setActiveImageIdx(idx)}
                                    >
                                        {isVideo ? (
                                          <div className="relative h-full w-full">
                                            <video src={url} className="h-full w-full object-cover" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30">
                                              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm">
                                                <ChevronRight className="h-6 w-6" aria-hidden="true" />
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <img src={url} alt={`Gallery ${idx}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                                        )}
                                    </div>
                                  );
                              })}
                          </div>
                      </section>
                  )}
              </div>

              {/* Sidebar Info */}
              <div className="lg:w-1/3">
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
                      <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-slate-900">
                          <Layers className="h-5 w-5 text-brand-500" aria-hidden="true" /> Tech Stack
                      </h3>

                      <div className="mb-6 flex flex-wrap gap-2">
                          {project.technologies?.map(tech => (
                              <span key={tech} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/10">
                                  <Tag className="h-3 w-3 text-brand-500" aria-hidden="true" /> {tech}
                              </span>
                          ))}
                      </div>

                      <div className="border-t border-slate-200 pt-6">
                          <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
                              Contact Author <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      </section>

      {/* Modern Lightbox Modal */}
      <AnimatePresence>
        {activeImageIdx !== null && project.gallery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-4 md:p-10"
            onClick={(e) => { if(e.target === e.currentTarget) setActiveImageIdx(null); }}
          >
            <button
              onClick={() => setActiveImageIdx(null)}
              aria-label="Close"
              className="absolute top-4 right-4 z-[110] inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>

            {project.gallery.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImageIdx((activeImageIdx - 1 + project.gallery.length) % project.gallery.length)}
                  aria-label="Previous media"
                  className="absolute left-4 top-1/2 z-[110] inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/20"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setActiveImageIdx((activeImageIdx + 1) % project.gallery.length)}
                  aria-label="Next media"
                  className="absolute right-4 top-1/2 z-[110] inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/20"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            <motion.div
              layoutId={`gallery-${activeImageIdx}`}
              className="relative flex h-full max-h-[85vh] w-full max-w-5xl items-center justify-center"
            >
              {isMediaVideo(project.gallery[activeImageIdx]) ? (
                <video
                  src={project.gallery[activeImageIdx]}
                  controls
                  autoPlay
                  className="max-h-full max-w-full rounded-xl shadow-xl"
                />
              ) : (
                <img
                  src={project.gallery[activeImageIdx]}
                  alt="Full View"
                  className="max-h-full max-w-full rounded-xl object-contain shadow-xl"
                />
              )}
              <div className="absolute -bottom-12 left-0 w-full text-center text-xs font-medium text-white/80">
                Media {activeImageIdx + 1} of {project.gallery.length}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectDetails;

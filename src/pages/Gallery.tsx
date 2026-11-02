import React, { useEffect, useState } from 'react';
import { Play, X, Image as ImageIcon, Video, Camera, SortDesc } from 'lucide-react';
import { authService } from '../services/api';
import { FadeIn } from '../components/FadeIn';

const GalleryLoader = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[300px]" role="status">
    {[1,2,3,4,5,6].map(i => (
      <div key={i} className="flex items-center justify-center animate-pulse rounded-lg bg-slate-100">
        <ImageIcon className="h-8 w-8 text-slate-300" aria-hidden="true" />
      </div>
    ))}
    <span className="sr-only">Loading</span>
  </div>
);

const Gallery: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchGallery = async () => {
      setLoading(true);
      try {
        const data = await authService.getGalleryItems();
        if (mounted) {
          setItems(data || []);
        }
      } catch (error) {
        console.error("Error fetching gallery:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchGallery();
    return () => { mounted = false; };
  }, []);

  // Filter items
  const filteredItems = items.filter(item => filter === 'all' || item.item_type === filter);

  // Sort items
  const sortedAndFilteredItems = [...filteredItems].sort((a, b) => {
    // Assuming items have a created_at property, otherwise use id or fallback
    const dateA = new Date(a.created_at || '2000-01-01').getTime();
    const dateB = new Date(b.created_at || '2000-01-01').getTime();

    if (sortOrder === 'newest') return dateB - dateA;
    return dateA - dateB;
  });

  const chip = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ── Page header ── */}
      <section className="border-b border-slate-200 bg-white pt-24 pb-10 md:pt-28 md:pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">
              <Camera className="h-4 w-4" aria-hidden="true" /> Media Gallery
            </span>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
              Captured
              <span className="text-brand-600"> Moments</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">
              A glimpse into the daily innovations and breakthroughs happening at the IDEA Lab.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── Filters & Sort ── */}
      <div className="sticky top-16 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">

          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setFilter('all')}
              className={chip(filter === 'all')}
            >
              All Media
            </button>
            <button
              onClick={() => setFilter('image')}
              className={chip(filter === 'image')}
            >
              <ImageIcon className="h-4 w-4" aria-hidden="true" /> Photos
            </button>
            <button
              onClick={() => setFilter('video')}
              className={chip(filter === 'video')}
            >
              <Video className="h-4 w-4" aria-hidden="true" /> Videos
            </button>
          </div>

          <div className="flex items-center gap-2">
            <SortDesc className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              aria-label="Sort order"
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="newest">Most Recent</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

        </div>
      </div>

      {/* ── Masonry Grid ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {loading ? (
          <GalleryLoader />
        ) : sortedAndFilteredItems.length === 0 ? (
          <FadeIn>
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <p className="text-base font-semibold text-slate-900">No {filter === 'all' ? 'media' : filter + 's'} found in the gallery yet.</p>
            </div>
          </FadeIn>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[250px] md:auto-rows-[300px]">
            {sortedAndFilteredItems.map((item, index) => (
              <FadeIn key={item.id} delay={Math.min(index * 0.05, 0.3)} className={`relative group cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition-shadow hover:shadow-md ${
                  item.display_size === 'large' ? 'md:col-span-2 md:row-span-2' :
                  item.display_size === 'medium' ? 'md:row-span-2' : ''
                }`}>

                {item.item_type === 'video' ? (
                  <div className="w-full h-full relative" onClick={() => setSelectedItem(item)}>
                      <img src={item.poster_url || item.image_url} alt={item.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/10 transition-colors group-hover:bg-slate-950/30">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                              <Play className="ml-1 h-6 w-6 fill-current text-brand-600" aria-hidden="true" />
                          </div>
                      </div>
                  </div>
                ) : (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    loading="lazy"
                    onClick={() => setSelectedItem(item)}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                )}

                {/* Overlay info */}
                <div onClick={() => setSelectedItem(item)} className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-slate-950/60 to-transparent p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
                  {item.tags && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {item.tags.split(',').map((tag: string) => (
                        <span key={tag} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700 shadow-sm">
                            {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  <h3 className="font-display text-lg font-semibold text-white">
                    {item.title}
                  </h3>
                  {item.caption && <p className="mt-1 truncate text-sm text-slate-200">{item.caption}</p>}
                </div>

              </FadeIn>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label={selectedItem.title}>
              <button
                onClick={() => setSelectedItem(null)}
                aria-label="Close"
                className="absolute top-4 right-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                  <X className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="relative flex w-full max-w-6xl max-h-[90vh] flex-col items-center overflow-y-auto rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200 md:p-6">
                  {selectedItem.item_type === 'video' ? (
                      <video
                         src={selectedItem.image_url}
                         controls
                         autoPlay
                         className="max-w-full max-h-[70vh] rounded-xl bg-slate-900"
                      />
                  ) : (
                      <img
                         src={selectedItem.image_url}
                         alt={selectedItem.title}
                         className="max-w-full max-h-[70vh] object-contain rounded-xl"
                      />
                  )}
                  <div className="mt-5 text-center px-4">
                      <h3 className="font-display text-xl font-semibold text-slate-900">{selectedItem.title}</h3>
                      {selectedItem.caption && <p className="mx-auto mt-2 max-w-2xl text-base leading-relaxed text-slate-600">{selectedItem.caption}</p>}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Gallery;

// src/components/cms/AmbassadorCMS.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  Inbox, Package, Users, Calendar, History, Settings, Shield,
  LogOut, Printer, Download, CheckCircle, XCircle, Clock,
  Loader2, Eye, Layers, Palette, Weight, DollarSign, User as UserIcon,
  CircuitBoard, LayoutDashboard, ChevronRight, Bell,
  PlayCircle, AlertCircle, ArrowRight, Zap, GraduationCap, Cpu, Box, ClipboardList, UserCircle, Home,
  Plus, Edit3, Trash2, Upload, FileText, Globe, Image as ImageIcon, Save, ExternalLink, Video
} from "lucide-react";
import { authService } from "../../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { avatarUrl } from "../../utils/avatar";

type CMSTab = "gallery" | "projects" | "pages" | "documents";

interface AmbassadorCMSProps {
  staffId: string;
  staffName: string;
  isAdmin?: boolean;
}

/* ─── Status badge ─── */
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending:  "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  const icon: Record<string, React.ReactNode> = {
    pending:  <Clock className="w-3 h-3" />,
    approved: <CheckCircle className="w-3 h-3" />,
    rejected: <XCircle className="w-3 h-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold capitalize ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {icon[status]} {status}
    </span>
  );
};

/* ══════════════ GALLERY MANAGER ══════════════ */
const GalleryManager: React.FC<{ staffId: string; staffName: string }> = ({ staffId, staffName }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ 
    title: "", 
    caption: "", 
    image_url: "", 
    link: "", 
    tags: "",
    item_type: "image",
    display_size: "small",
    poster_url: ""
  });
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await authService.getGalleryItems();
      setItems(data ?? []);
    } catch (err) {
      console.error("Fetch gallery error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openNew = () => { 
    setEditing(null); 
    setForm({ title: "", caption: "", image_url: "", link: "", tags: "", item_type: "image", display_size: "small", poster_url: "" }); 
    setShowForm(true); 
  };
  
  const openEdit = (item: any) => { 
    setEditing(item); 
    setForm({ 
      title: item.title, 
      caption: item.caption ?? "", 
      image_url: item.image_url, 
      link: item.link ?? "", 
      tags: item.tags ?? "",
      item_type: item.item_type ?? "image",
      display_size: item.display_size ?? "small",
      poster_url: item.poster_url ?? ""
    }); 
    setShowForm(true); 
  };

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedPoster, setSelectedPoster] = useState<File | null>(null);

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // 1. Bulk Upload Handler
      if (selectedFiles.length > 0) {
        setUploading(true);
        setUploadProgress(10); // Start progress

        // Upload all files in parallel
        const uploadPromises = selectedFiles.map(file => 
          uploadFile(file, "projects", form.item_type === "video" ? "videos" : "photos")
        );
        
        const urls = await Promise.all(uploadPromises);

        if (urls.some(url => url !== null)) {
          // Create bulk payload with fallback titles from filenames
          const bulkPayload = urls.map((url, idx) => {
            if (!url) return null;
            return {
              title: form.title || selectedFiles[idx].name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' '),
              caption: form.caption,
              item_type: form.item_type,
              display_size: form.display_size,
              image_url: url,
              link: form.link,
              tags: form.tags,
              poster_url: form.item_type === 'video' ? form.poster_url : "",
              created_by: staffId
            };
          }).filter(Boolean);

          if (bulkPayload.length > 0) {
            await authService.addGalleryItem(bulkPayload);
          }
        }
      } 
      // 2. Single Update/Upload Handler
      else {
        let finalUrl = form.image_url;
        let finalPoster = form.poster_url;

        if (selectedFile) {
          setUploading(true);
          const url = await uploadFile(selectedFile, "projects", form.item_type === "video" ? "videos" : "photos");
          if (url) finalUrl = url;
        }

        if (selectedPoster) {
          const url = await uploadFile(selectedPoster, "projects", "posters");
          if (url) finalPoster = url;
        }

        if (!finalUrl && !editing) {
          alert("Please upload a file or provide a URL.");
          setSaving(false);
          return;
        }

        const payload = { 
          title: form.title,
          caption: form.caption,
          item_type: form.item_type,
          display_size: form.display_size,
          image_url: finalUrl,
          link: form.link,
          tags: form.tags,
          poster_url: finalPoster,
          created_by: staffId 
        };

        if (editing) {
          await authService.updateGalleryItem(editing.id, { ...payload, updated_at: new Date().toISOString() });
        } else {
          await authService.addGalleryItem(payload);
        }
      }

      setShowForm(false);
      setSelectedFile(null);
      setSelectedFiles([]);
      setSelectedPoster(null);
      fetch();
    } catch (err: any) {
      console.error("Gallery save error:", err);
      alert("Failed to save gallery item: " + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this gallery item?")) return;
    try {
      await authService.deleteGalleryItem(id);
      fetch();
    } catch (err: any) {
      alert("Failed to delete: " + err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Gallery Management</h2>
          <p className="text-sm text-slate-400 mt-0.5">Add, edit captions, and manage the laboratory gallery.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 transition">
          <Plus className="w-4 h-4" /> Add Media
        </button>
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-lg">{editing ? "Edit Gallery Item" : "Add New Media"}</h3>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded-full transition"><XCircle className="w-5 h-5 text-slate-400" /></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                   {/* Preview Area */}
                  <div className="relative aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-100 flex items-center justify-center">
                    {form.image_url || selectedFile || selectedFiles.length > 0 ? (
                      form.item_type === 'video' ? (
                        <div className="text-center">
                          <Video className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-[10px] text-slate-400 mt-1">Video selected</p>
                        </div>
                      ) : (
                        <div className="relative w-full h-full">
                          <img 
                            src={selectedFiles.length > 0 ? URL.createObjectURL(selectedFiles[0]) : (selectedFile ? URL.createObjectURL(selectedFile) : form.image_url)} 
                            alt="preview" className="w-full h-full object-cover" 
                          />
                          {selectedFiles.length > 1 && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <p className="text-white font-black text-xl">+{selectedFiles.length - 1} more</p>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-200" />
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-6">
                        <div className="w-full space-y-2">
                          <div className="flex justify-between text-[10px] font-bold text-brand-600 uppercase">
                            <span>Uploading {selectedFiles.length || 1} items...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-brand-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field 
                      label="Item Type" 
                      value={form.item_type} 
                      onChange={v => setForm({...form, item_type: v})} 
                      select 
                      options={[{v: 'image', l: 'Photo'}, {v: 'video', l: 'Video'}]} 
                    />
                    <Field 
                      label="Display Size" 
                      value={form.display_size} 
                      onChange={v => setForm({...form, display_size: v})} 
                      select 
                      options={[{v: 'small', l: 'Small'}, {v: 'medium', l: 'Medium'}, {v: 'large', l: 'Large'}]} 
                    />
                  </div>

                  {form.item_type === 'video' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 items-end">
                        <Field label="Video Poster/Thumb" type="file" accept="image/*" onFileChange={setSelectedPoster} value="" onChange={() => {}} />
                        <p className="text-[10px] text-slate-400 pb-3 truncate">OR URL ↓</p>
                      </div>
                      <Field label="Poster URL" value={form.poster_url} onChange={v => setForm({...form, poster_url: v})} placeholder="https://..." />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 items-end">
                    <Field 
                      label={form.item_type === 'video' ? "Upload Video" : `Upload Photo${!editing ? 's (Max 10)' : ''}`} 
                      type="file" 
                      accept={form.item_type === 'video' ? "video/*" : "image/*"} 
                      onFileChange={setSelectedFile} 
                      onFilesChange={(files) => {
                        if (files.length > 10) {
                          alert("You can only select up to 10 photos at once.");
                          setSelectedFiles(files.slice(0, 10));
                        } else {
                          setSelectedFiles(files);
                        }
                      }}
                      multiple={form.item_type === 'image' && !editing}
                      value="" 
                      onChange={() => {}} 
                    />
                    {form.item_type === 'image' && (
                      <p className="text-[10px] font-black text-slate-300 uppercase italic">Max 10MB per image. 5-10MB files are auto-compressed.</p>
                    )}
                  </div>
                  <Field label="Media URL" value={form.image_url} onChange={v => setForm({...form, image_url: v})} placeholder="https://..." />
                  <Field label="Title" value={form.title} onChange={v => setForm({...form, title: v})} placeholder="Project Prototype" />
                  <Field label="Caption" value={form.caption} onChange={v => setForm({...form, caption: v})} placeholder="Short description…" textarea />
                  <Field label="Tags" value={form.tags} onChange={v => setForm({...form, tags: v})} placeholder="workshop, pcb, 2024" />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-50">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
                <button onClick={handleSave} disabled={(selectedFiles.length === 0 && (!form.title || (!form.image_url && !selectedFile))) || saving}
                  className="flex-1 relative py-3 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition disabled:opacity-40 flex flex-col items-center justify-center overflow-hidden">
                  <div className="flex items-center justify-center gap-2 relative z-10">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {saving ? (uploading ? `Uploading ${Math.round(uploadProgress)}%` : "Saving…") : "Save Media"}
                  </div>
                  {uploading && (
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      className="absolute left-0 bottom-0 h-1 bg-white/30"
                    />
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-brand-200" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<ImageIcon className="w-12 h-12" />} text="No gallery items yet" sub="Start showcasing lab successes by adding your first photo." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-10">
          {items.map(item => (
            <motion.div
              layout
              key={item.id}
              className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100/60 shadow-xl shadow-slate-200/20 group hover:shadow-2xl hover:shadow-slate-300/40 transition-all hover:-translate-y-2 relative"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <img 
                  src={item.image_url} 
                  alt={item.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                  onError={e => (e.currentTarget.src = avatarUrl(item.title, '#f1f5f9', '#94a3b8'))} 
                />
                
                {/* Overlay with details */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                  <div className="flex items-center gap-2 mb-2">
                     <span className="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[8px] font-black text-white uppercase tracking-widest">{item.item_type}</span>
                     <span className="px-2 py-0.5 bg-brand-500/80 backdrop-blur-md rounded-full text-[8px] font-black text-white uppercase tracking-widest">{item.display_size}</span>
                  </div>
                  <h4 className="text-white font-black text-lg leading-tight uppercase tracking-tighter">{item.title}</h4>
                  <p className="text-white/70 text-xs line-clamp-2 mt-1">{item.caption}</p>
                </div>

                {item.link && (
                  <a href={item.link} target="_blank" rel="noreferrer"
                    className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg hover:bg-brand-600 hover:text-white transition-all transform hover:rotate-12">
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-wrap gap-1.5 min-w-0">
                    {item.tags?.split(",").slice(0, 3).map((t: string) => (
                      <span key={t} className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md truncate max-w-[80px]">
                        {t.trim()}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl">
                    <button 
                      onClick={() => openEdit(item)} 
                      className="p-2 text-slate-400 hover:text-brand-600 hover:bg-white rounded-lg transition-all shadow-sm shadow-transparent hover:shadow-slate-200"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)} 
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all shadow-sm shadow-transparent hover:shadow-slate-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ══════════════ PROJECT MANAGER ══════════════ */
const ProjectManager: React.FC<{ staffId: string }> = ({ staffId }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    title: "",
    category: "",
    image_url: "",
    video: "",
    description: "",
    long_description: "",
    author: "",
    technologies: "",
    date: "",
    gallery: [] as string[]
  });

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await authService.getProjects();
      setProjects(data ?? []);
    } catch (err) {
      console.error("Fetch projects error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [selectedHighlights, setSelectedHighlights] = useState<FileList | null>(null);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let finalImage = form.image_url;
      let finalVideo = form.video;

      if (selectedImage) {
        const url = await uploadFile(selectedImage, "projects", "covers");
        if (url) finalImage = url;
      }

      if (selectedVideo) {
        const url = await uploadFile(selectedVideo, "projects", "videos");
        if (url) finalVideo = url;
      }

      let finalGallery = [...form.gallery];
      if (selectedHighlights && selectedHighlights.length > 0) {
        const uploadPromises = Array.from(selectedHighlights).map(file => 
          uploadFile(file, "projects", "gallery")
        );
        const uploadedUrls = await Promise.all(uploadPromises);
        finalGallery = [...finalGallery, ...uploadedUrls.filter((url): url is string => url !== null)];
      }

      if (!finalImage && !editing) {
        alert("Please upload a project image.");
        setSaving(false);
        return;
      }

      const payload = {
        title: form.title,
        category: form.category,
        description: form.description,
        long_description: form.long_description,
        author: form.author,
        date: form.date,
        image_url: finalImage,
        video: finalVideo,
        gallery: finalGallery,
        technologies: form.technologies ? form.technologies.split(",").map(t => t.trim()).filter(t => t) : [],
        created_by: staffId,
        updated_at: new Date().toISOString()
      };

      if (editing) {
        await authService.updateProject(editing.id, payload);
      } else {
        await authService.addProject(payload);
      }

      setShowForm(false);
      setSelectedImage(null);
      setSelectedVideo(null);
      setSelectedHighlights(null);
      fetch();
    } catch (err: any) {
      console.error("Project save error:", err);
      // More descriptive error message for better debugging
      const errorMsg = err.message || (typeof err === "string" ? err : "An unknown error occurred");
      alert("Failed to save project: " + errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Project Management</h2>
          <p className="text-sm text-slate-400 mt-0.5">Manage the laboratory's innovation projects.</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ title: "", category: "", image_url: "", video: "", description: "", long_description: "", author: "", technologies: "", date: "", gallery: [] }); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 transition">
          <Plus className="w-4 h-4" /> Add Project
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <motion.div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">{editing ? "Edit Project" : "New Project"}</h3>
                <button onClick={() => setShowForm(false)}><XCircle className="w-5 h-5 text-slate-400" /></button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Title" value={form.title} onChange={v => setForm({...form, title: v})} />
                <Field label="Category" value={form.category} onChange={v => setForm({...form, category: v})} placeholder="IoT, Robotics, etc." />
                <Field label="Author" value={form.author} onChange={v => setForm({...form, author: v})} />
                <Field label="Date" value={form.date} onChange={v => setForm({...form, date: v})} placeholder="Sep 2024" />
                <div className="col-span-2">
                  <Field label="Description" value={form.description} onChange={v => setForm({...form, description: v})} textarea />
                </div>
                <div className="col-span-2">
                  <Field label="Technologies (comma separated)" value={form.technologies} onChange={v => setForm({...form, technologies: v})} />
                </div>
                <div className="col-span-2">
                  <Field label="Title / Cover Image" type="file" accept="image/*" onFileChange={setSelectedImage} value="" onChange={() => {}} />
                  <p className="text-[10px] font-black text-slate-300 mt-1 uppercase italic">Max 10MB. 5-10MB files are auto-compressed.</p>
                </div>
                <Field label="Project Video (optional)" type="file" accept="video/*" onFileChange={setSelectedVideo} value="" onChange={() => {}} />
                
                <div className="col-span-2 border-t pt-4 mt-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2 text-brand-600">Gallery Highlights</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    {form.gallery.map((url, i) => {
                      const isVideo = url.toLowerCase().match(/\.(mp4|webm|mov|ogg|avi)$/);
                      return (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border group bg-slate-100 flex items-center justify-center">
                          {isVideo ? (
                            <div className="text-center">
                              <Video className="w-6 h-6 text-slate-400 mx-auto" />
                              <span className="text-[8px] font-bold text-slate-400 uppercase mt-1 block">Video</span>
                            </div>
                          ) : (
                            <img src={url} className="w-full h-full object-cover" />
                          )}
                          <button 
                            onClick={() => setForm({...form, gallery: form.gallery.filter((_, idx) => idx !== i)})}
                            className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      );
                    })}
                    <label className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-slate-300 hover:text-brand-500 hover:border-brand-500 cursor-pointer transition-colors bg-slate-50">
                      <Plus className="w-6 h-6" />
                      <span className="text-[10px] font-bold mt-1">Add Highlights</span>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*,video/*" 
                        className="hidden" 
                        onChange={e => setSelectedHighlights(e.target.files)} 
                      />
                    </label>
                  </div>
                  {selectedHighlights && selectedHighlights.length > 0 && (
                    <p className="text-xs text-brand-600 font-medium bg-brand-50 px-3 py-1.5 rounded-lg inline-block">
                      {selectedHighlights.length} new highlights selected
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 border rounded-xl font-bold text-slate-600">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Project
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List Projects */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map(p => (
          <div key={p.id} className="bg-white border rounded-2xl p-4 flex gap-4 items-center">
            <img src={p.image_url || p.image} className="w-20 h-20 rounded-xl object-cover" />
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{p.title}</p>
              <p className="text-xs text-slate-400">{p.category} • {p.author}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => { 
                  setEditing(p); 
                  setForm({
                    ...p, 
                    image_url: p.image_url || p.image || "",
                    technologies: Array.isArray(p.technologies) ? p.technologies.join(", ") : (p.technologies || ""),
                    date: p.date || "",
                    gallery: p.gallery || []
                  }); 
                  setShowForm(true); 
                }} 
                className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button 
                onClick={async () => { 
                  if(confirm("Delete?")) { 
                    try {
                      await authService.deleteProject(p.id); 
                      fetch(); 
                    } catch (err: any) {
                      alert("Delete failed: " + err.message);
                    }
                  } 
                }} 
                className="p-2 hover:bg-red-50 rounded-lg text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};



/* ══════════════ PAGE EDITOR ══════════════ */
const CMS_PAGES = [
  { key: "about",        label: "About Us",          fields: ["hero_subtitle", "mission", "vision"] },
  { key: "team",         label: "Team",               fields: ["intro"] },
  { key: "projects",     label: "Project Showcase",   fields: ["intro"] },
  { key: "testimonials", label: "Testimonials",       fields: ["intro"] },
  { key: "resources",    label: "Resources",          fields: ["intro"] },
];

const PageEditor: React.FC<{ staffId: string }> = ({ staffId }) => {
  const [activePage, setActivePage] = useState(CMS_PAGES[0]);
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadPage = async (page: typeof CMS_PAGES[0]) => {
    setLoading(true);
    try {
      const data = await authService.getCMSPage(page.key);
      setContent(data?.content ?? {});
    } catch (err) {
      console.error("Load page error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { loadPage(activePage); }, [activePage]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authService.updateCMSPage(activePage.key, content, staffId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert("Page save failed: " + err.message);
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Page Editor</h2>
        <p className="text-sm text-slate-400 mt-0.5">Edit live content for public-facing pages.</p>
      </div>

      <div className="flex gap-6">
        {/* Page selector sidebar */}
        <div className="w-44 shrink-0 space-y-1">
          {CMS_PAGES.map(p => (
            <button key={p.key} onClick={() => { setActivePage(p); setSaved(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                activePage.key === p.key ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-50"
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="flex-1 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-700">{activePage.label}</h3>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 transition disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>
          ) : (
            <div className="space-y-5">
              {activePage.fields.map(field => (
                <div key={field}>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">
                    {field.replace(/_/g, " ")}
                  </label>
                  <textarea
                    rows={4}
                    value={content[field] ?? ""}
                    onChange={e => setContent({ ...content, [field]: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none text-slate-700 leading-relaxed"
                    placeholder={`Enter ${field.replace(/_/g, " ")}…`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ══════════════ PDF REVIEW ══════════════ */
const PDFReview: React.FC<{ staffId: string; staffName: string; isAdmin?: boolean }> = ({ staffId, staffName, isAdmin }) => {
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", file_url: "", file_name: "" });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPdfs = async () => {
    setLoading(true);
    try {
      const data = await authService.getPDFReviews(staffId, isAdmin);
      setPdfs(data ?? []);
    } catch (err) {
      console.error("Fetch PDFs error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPdfs(); }, []);

  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    let finalUrl = form.file_url;

    if (selectedFile) {
      setUploading(true);
      const url = await uploadFile(selectedFile, "projects", "reviews");
      if (url) finalUrl = url;
      setUploading(false);
    }

    if (!finalUrl) {
      alert("Please provide a file URL or upload a PDF.");
      setSaving(false);
      return;
    }

    try {
      await authService.submitPDFReview({ 
        ...form, 
        file_url: finalUrl,
        file_name: selectedFile?.name || form.file_name || "document.pdf",
        uploaded_by: staffId, 
        uploader_name: staffName, 
        status: "pending" 
      });
    } catch (err: any) {
      alert("Submission failed: " + err.message);
    }
    setSaving(false);
    setShowForm(false);
    setSelectedFile(null);
    setForm({ title: "", description: "", file_url: "", file_name: "" });
    fetchPdfs();
  };

  const handleAdminAction = async (id: string, status: "approved" | "rejected", notes?: string) => {
    try {
      await authService.updatePDFReviewStatus(id, status, notes);
      fetchPdfs();
    } catch (err: any) {
      alert("Action failed: " + err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{isAdmin ? "PDF Review Queue" : "Document Submissions"}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{isAdmin ? "Approve or reject submitted PDFs." : "Upload documents for admin review."}</p>
        </div>
        {!isAdmin && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 transition">
            <Upload className="w-4 h-4" /> Submit PDF
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
              <h3 className="font-bold text-lg text-slate-800">Submit for Review</h3>
              <Field label="Document Title" value={form.title} onChange={v => setForm({...form, title: v})} placeholder="e.g. Lab Handbook 2025" />
              <div className="grid grid-cols-2 gap-3 items-end">
                <Field label="Upload PDF" type="file" accept=".pdf" onFileChange={setSelectedFile} value="" onChange={() => {}} />
                <p className="text-[10px] text-slate-400 pb-3">OR use external URL ↓</p>
              </div>
              <Field label="PDF URL" value={form.file_url} onChange={v => setForm({...form, file_url: v})} placeholder="https://drive.google.com/..." />
              <Field label="Description (optional)" value={form.description} onChange={v => setForm({...form, description: v})} placeholder="Brief description…" textarea />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleSubmit} disabled={!form.title || !form.file_url || saving}
                  className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-40 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Submit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>
      ) : pdfs.length === 0 ? (
        <EmptyState icon={<FileText />} text="No documents yet" sub={isAdmin ? "Nothing pending review." : "Submit your first document for review."} />
      ) : (
        <div className="space-y-3">
          {pdfs.map(pdf => (
            <div key={pdf.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{pdf.title}</p>
                      {isAdmin && <p className="text-xs text-slate-400">Submitted by {pdf.uploader_name}</p>}
                    </div>
                  </div>
                  {pdf.description && <p className="text-sm text-slate-500 mt-2 pl-11">{pdf.description}</p>}
                  {pdf.admin_notes && (
                    <div className="mt-2 pl-11 text-xs text-slate-400 italic">Admin note: {pdf.admin_notes}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status={pdf.status} />
                  <a href={pdf.file_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 font-bold flex items-center gap-1 hover:underline">
                    <Eye className="w-3 h-3" /> View PDF
                  </a>
                </div>
              </div>

              {isAdmin && pdf.status === "pending" && (
                <div className="flex gap-2 mt-4 pl-11">
                  <button onClick={() => handleAdminAction(pdf.id, "approved")}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition border border-green-200">
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button onClick={() => {
                    const notes = prompt("Optional: Add rejection note");
                    handleAdminAction(pdf.id, "rejected", notes || undefined);
                  }}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition border border-red-200">
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ══════════════ MAIN COMPONENT ══════════════ */
const AmbassadorCMS: React.FC<AmbassadorCMSProps> = ({ staffId, staffName, isAdmin }) => {
  const [tab, setTab] = useState<CMSTab>("gallery");

  const tabs = [
    { id: "gallery" as CMSTab,   label: "Gallery Registry",   icon: <ImageIcon className="w-4 h-4" /> },
    { id: "projects" as CMSTab,  label: "Project Showcase",  icon: <FileText className="w-4 h-4" /> },
    { id: "documents" as CMSTab, label: "Document Archive",  icon: <Inbox className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
       {/* ── HEADER ── */}
       <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.4em] mb-2">Content Synthesis</p>
          <h1 className="text-4xl font-light text-slate-900 tracking-tight flex items-center gap-3">
             Web Presence & CMS <Globe className="w-8 h-8 text-brand-600" />
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-lg">
            Curate the laboratory's digital footprint. Manage high-impact project showcases, media galleries, and public-facing informational modules.
          </p>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-[2rem] p-1.5 flex bg-slate-50 w-fit shrink-0 shadow-lg shadow-slate-200/20 overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
              tab === t.id ? "bg-white text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={tab} 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: -15 }} 
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="pb-12"
        >
          {tab === "gallery"   && <GalleryManager staffId={staffId} staffName={staffName} />}
          {tab === "projects"  && <ProjectManager staffId={staffId} />}
          {tab === "pages"     && <PageEditor staffId={staffId} />}
          {tab === "documents" && <PDFReview staffId={staffId} staffName={staffName} isAdmin={isAdmin} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AmbassadorCMS;

import { processImageUpload } from '../../utils/image-utils';

const uploadFile = async (file: File, bucket: string, folder: string = "cms", onProgress?: (p: number) => void): Promise<string | null> => {
  // 1. Process/Compress if it's an image
  let processedFile = file;
  if (file.type.startsWith("image/")) {
    processedFile = await processImageUpload(file);
  }

  // 2. Secondary check for non-image files (videos etc)
  const MB = 1024 * 1024;
  if (file.type.startsWith("video/") && file.size > 50 * MB) {
    throw new Error(`Video size must be less than 50MB. Your file is ${(file.size / MB).toFixed(2)}MB.`);
  }

  // Signed upload URL from the API; the API picks the file name and checks the type.
  const { publicUrl } = await authService.uploadFile(bucket as "projects", processedFile, folder);
  return publicUrl;
};

const Field: React.FC<{ 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  placeholder?: string; 
  textarea?: boolean; 
  type?: string;
  onFileChange?: (file: File) => void;
  onFilesChange?: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  select?: boolean;
  options?: { v: string; l: string }[];
}> = ({ label, value, onChange, placeholder, textarea, type = "text", onFileChange, onFilesChange, multiple, accept, select, options }) => (
  <div>
    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{label}</label>
    {select ? (
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
      >
        {options?.map(opt => (
          <option key={opt.v} value={opt.v}>{opt.l}</option>
        ))}
      </select>
    ) : type === "file" ? (
      <input 
        type="file" 
        multiple={multiple}
        accept={accept}
        onChange={e => {
          if (multiple && e.target.files) {
            onFilesChange?.(Array.from(e.target.files));
          } else if (e.target.files?.[0]) {
            onFileChange?.(e.target.files[0]);
          }
        }}
        className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" 
      />
    ) : textarea ? (
      <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
    ) : (
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
    )}
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode; text: string; sub?: string }> = ({ icon, text, sub }) => (
  <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-16 text-center">
    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-200 scale-125">{icon}</div>
    <p className="font-bold text-slate-400">{text}</p>
    {sub && <p className="text-xs text-slate-300 mt-1">{sub}</p>}
  </div>
);

import React, { useState, useRef, useEffect } from 'react';
import { User, Bell, Moon, Save, Camera, ShieldCheck, Mail, Linkedin, AlignLeft, Smartphone, Zap, GraduationCap, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../services/api';
import { INPUT_CLASS } from './AuthCard';
import { avatarUrl } from '../utils/avatar';

interface SettingsPanelProps {
  user: any; // Accepts User or Staff object
  onUpdate: (updatedData: any) => Promise<void>;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ user, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('profile');
  
  // Profile State
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar);
  const [bio, setBio] = useState(user.bio || '');
  const [skills, setSkills] = useState(user.skills || '');
  const [linkedin, setLinkedin] = useState(user.linkedin || '');
  
  // Student Specific State
  const [srn, setSrn] = useState(user.srn || '');
  const [degree, setDegree] = useState(user.degree || '');
  const [program, setProgram] = useState(user.program || '');
  const [semester, setSemester] = useState<string>(user.semester ? String(user.semester) : '');
  
  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityMessage, setSecurityMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const isStaffAccount = user.employeeId !== undefined || user.is_verified !== undefined;

  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      setName(user.name);
      setAvatar(user.avatar);
      setBio(user.bio || '');
      setSkills(user.skills || '');
      setLinkedin(user.linkedin || '');
      setSrn(user.srn || '');
      setDegree(user.degree || '');
      setProgram(user.program || '');
      setSemester(user.semester ? String(user.semester) : '');
  }, [user]);

  // Photos are uploaded to the portal's own storage; the profile keeps the file's URL.
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const { publicUrl } = await authService.uploadFile('projects', file, 'avatars');
      if (publicUrl) setAvatar(publicUrl);
    } catch (err: any) {
      alert(`Could not upload the photo: ${err.message}`);
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityMessage(null);
    if (newPassword !== confirmPassword) {
      setSecurityMessage({ kind: 'error', text: "The new passwords don't match." });
      return;
    }
    setSecurityBusy(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityMessage({ kind: 'success', text: 'Password changed. Other devices have been signed out.' });
    } catch (err: any) {
      setSecurityMessage({ kind: 'error', text: err.message || 'Could not change the password.' });
    } finally {
      setSecurityBusy(false);
    }
  };

  const signOutEverywhere = async () => {
    if (!confirm('Sign out on every device, including this one?')) return;
    await authService.logoutEverywhere().catch(() => {});
    window.location.href = isStaffAccount ? '/staff-login' : '/login';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatePayload: any = { 
          name, 
          avatar,
          bio,
          skills,
          linkedin,
          degree,
          program,
          semester: semester || null,
      };

      if (user.type === 'university') {
          updatePayload.srn = srn;
      }

      await onUpdate(updatePayload);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Settings Update Error:", err);
    } finally {
      setSaving(false);
    }
  };

  const isUniversity = user.type === 'university';

  return (
    <div className="flex min-h-[600px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:flex-row">
        {/* Sidebar */}
        <div className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-slate-200 bg-white p-3 md:w-64 md:flex-col md:border-b-0 md:border-r">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex flex-1 items-center justify-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors md:w-full md:flex-none md:justify-start ${
                activeTab === 'profile' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <User className="h-4 w-4" aria-hidden="true" />
              <span>Profile</span>
            </button>
            <button 
              onClick={() => setActiveTab('security')}
              className={`flex flex-1 items-center justify-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors md:w-full md:flex-none md:justify-start ${
                activeTab === 'security' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Security</span>
            </button>
            <button 
              onClick={() => setActiveTab('preferences')}
              className={`flex flex-1 items-center justify-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors md:w-full md:flex-none md:justify-start ${
                activeTab === 'preferences' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              <span>Preferences</span>
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto relative">
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        role="status"
                        className="absolute top-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-lg"
                    >
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        <span className="font-medium">Changes Saved Successfully</span>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="space-y-6 max-w-3xl">
                <div className="flex flex-col items-start mb-6">
                   <div 
                      className="group relative mb-3 h-24 w-24 cursor-pointer overflow-hidden rounded-full ring-1 ring-slate-200"
                      onClick={() => fileInputRef.current?.click()}
                   >
                     <img src={avatar || avatarUrl(name)} alt={name} className="h-full w-full object-cover" />
                     <div className={`absolute inset-0 flex items-center justify-center bg-slate-900/50 transition-opacity ${uploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {uploadingAvatar ? <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden="true" /> : <Camera className="h-6 w-6 text-white" aria-hidden="true" />}
                     </div>
                   </div>
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFileChange} />
                   <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4 disabled:opacity-50"
                    >
                      {uploadingAvatar ? 'Uploading…' : 'Change Picture'}
                   </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
                        <input 
                          type="text" 
                          value={name} 
                          onChange={(e) => setName(e.target.value)}
                          className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500" 
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Unique ID</label>
                        <input type="text" defaultValue={user.id} disabled className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500" />
                      </div>
                  </div>

                  {/* Academic Details — shown for all users */}
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <GraduationCap className="h-4 w-4 text-brand-500" aria-hidden="true" /> Academic Details
                    </h4>

                    {user.type === 'university' && (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">SRN / University ID</label>
                        <input
                          type="text"
                          value={srn}
                          onChange={e => setSrn(e.target.value)}
                          className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                          placeholder="e.g. R21EC001"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Degree</label>
                        <div className="relative">
                          <select
                            value={degree}
                            onChange={e => { setDegree(e.target.value); setProgram(''); }}
                            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                          >
                            <option value="">Select degree…</option>
                            {["B.Tech","M.Tech","MBA","PhD","B.Sc","M.Sc","Faculty","Other"].map(d => (
                              <option key={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Program</label>
                        <div className="relative">
                          <select
                            value={program}
                            onChange={e => setProgram(e.target.value)}
                            disabled={!degree}
                            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                          >
                            <option value="">Select program…</option>
                            {({
                              "B.Tech": ["Computer Science & Engineering","Electronics & Communication","Mechanical Engineering","Civil Engineering","Electrical Engineering","Information Technology","AI & Machine Learning","Data Science","Biotechnology"],
                              "M.Tech": ["Computer Science","VLSI Design","Structural Engineering","Power Systems","Robotics & Automation","AI & Machine Learning","Signal Processing"],
                              "MBA":    ["Finance","Marketing","Operations Management","Human Resources","Business Analytics","Entrepreneurship"],
                              "PhD":    ["Computer Science","Electronics","Mechanical","Management Studies","Physics","Chemistry"],
                              "B.Sc":   ["Physics","Chemistry","Mathematics","Biology","Computer Science","Statistics"],
                              "M.Sc":   ["Physics","Chemistry","Mathematics","Computer Science","Data Science"],
                              "Faculty":["Computer Science","Electronics","Mathematics","Physics","Management","Mechanical"],
                              "Other":  ["Not Applicable"],
                            } as Record<string,string[]>)[degree]?.map(p => (
                              <option key={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {degree && !["Faculty","PhD","Other"].includes(degree) && (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Current Semester</label>
                        <select
                          value={semester}
                          onChange={e => setSemester(e.target.value)}
                          className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                        >
                          <option value="">Select semester…</option>
                          {[1,2,3,4,5,6,7,8].map(s => (
                            <option key={s} value={String(s)}>{s === 1 ? '1st' : s === 2 ? '2nd' : s === 3 ? '3rd' : `${s}th`} Semester</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"><AlignLeft className="h-4 w-4 text-slate-400" aria-hidden="true" /> Bio</label>
                    <textarea 
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us a bit about yourself..."
                        rows={3}
                        className="min-h-[120px] block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    ></textarea>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"><Zap className="h-4 w-4 text-slate-400" aria-hidden="true" /> Skills (Comma separated)</label>
                    <input 
                      type="text" 
                      value={skills} 
                      onChange={(e) => setSkills(e.target.value)}
                      placeholder="e.g. IoT, 3D Printing, Python"
                      className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500" 
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"><Linkedin className="h-4 w-4 text-slate-400" aria-hidden="true" /> LinkedIn Profile</label>
                    <input 
                      type="url" 
                      value={linkedin} 
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                      className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECURITY TAB */}
            {activeTab === 'security' && (
              <div className="space-y-6 max-w-2xl">
                 {securityMessage && (
                   <div role={securityMessage.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${securityMessage.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                     {securityMessage.text}
                   </div>
                 )}

                 <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                        <Mail className="h-4 w-4 text-brand-500" aria-hidden="true" /> Email address
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">{user.email}</p>
                    {!(user as any).has_password && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Signed in with {user.email.endsWith('@reva.edu.in') ? 'your REVA Microsoft account' : 'Microsoft or Google'}
                      </div>
                    )}
                    {!(user as any).has_password && (
                      <p className="mt-2 text-xs text-slate-500">Your password is managed by Microsoft or Google, not by this site. To also sign in with a password here, use "Create one with your email" on the sign-in page with this address.</p>
                    )}
                 </div>

                 {(user as any).has_password && <form onSubmit={changePassword} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                    <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                        <ShieldCheck className="h-4 w-4 text-brand-500" aria-hidden="true" /> Change password
                    </h3>
                    <input type="password" required autoComplete="current-password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={INPUT_CLASS} aria-label="Current password" />
                    <input type="password" required minLength={8} maxLength={128} autoComplete="new-password" placeholder="New password (at least 8 characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={INPUT_CLASS} aria-label="New password" />
                    <input type="password" required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Repeat new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={INPUT_CLASS} aria-label="Repeat new password" />
                    <button type="submit" disabled={securityBusy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50">
                      {securityBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null} Update password
                    </button>
                 </form>}

                 <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                        <Smartphone className="h-4 w-4 text-brand-500" aria-hidden="true" /> Signed-in devices
                    </h3>
                    <p className="mt-1 mb-3 text-sm text-slate-500">Lost a device or used a shared computer? Sign out everywhere.</p>
                    <button type="button" onClick={signOutEverywhere} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                      Sign out on all devices
                    </button>
                 </div>
              </div>
            )}

            {/* PREFERENCES TAB */}
            {activeTab === 'preferences' && (
              <div className="space-y-6 max-w-2xl">
                 <div className="space-y-4">
                    <h3 className="border-b border-slate-200 pb-2 font-semibold text-slate-900">Notifications</h3>
                    <label className="flex items-center justify-between cursor-pointer">
                       <span className="text-sm text-slate-700">Email Alerts for Returns</span>
                       <input type="checkbox" defaultChecked className="accent-brand-600 w-4 h-4" />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                       <span className="text-sm text-slate-700">New Workshop Announcements</span>
                       <input type="checkbox" defaultChecked className="accent-brand-600 w-4 h-4" />
                    </label>
                 </div>

                 <div className="space-y-4 pt-4">
                    <h3 className="border-b border-slate-200 pb-2 font-semibold text-slate-900">Appearance</h3>
                    <label className="flex items-center justify-between cursor-pointer">
                       <span className="text-sm text-slate-700 flex items-center gap-2"><Moon className="h-4 w-4 text-slate-400" aria-hidden="true" /> Dark Mode (Beta)</span>
                       <input type="checkbox" className="accent-brand-600 w-4 h-4" />
                    </label>
                 </div>
              </div>
            )}

            <div className="mt-8 flex justify-end border-t border-slate-200 pt-6">
               <button 
                 onClick={handleSave} 
                 disabled={saving}
                 className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
               >
                 {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                 Save Changes
               </button>
            </div>
        </div>
    </div>
  );
};

export default SettingsPanel;

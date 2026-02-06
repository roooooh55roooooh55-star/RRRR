
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Video, VideoType, UserInteractions } from './types';
import { db, ensureAuth } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { SYSTEM_CONFIG } from './TechSpecs';
import { InteractiveMarquee, VideoCardThumbnail, SafeAutoPlayVideo, getNeonColor, formatVideoSource } from './MainContent';

const LOGO_URL = "https://i.top4top.io/p_3643ksmii1.jpg";
const R2_WORKER_URL = SYSTEM_CONFIG.cloudflare.workerUrl;
const R2_PUBLIC_URL = SYSTEM_CONFIG.cloudflare.publicUrl;

// --- Sub-components (LayoutEditor) ---
const LayoutEditor: React.FC<{ initialVideos: Video[] }> = ({ initialVideos }) => {
  const [layout, setLayout] = useState<any[]>([]);
  const [isLocked, setIsLocked] = useState(true);
  const [loading, setLoading] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        await ensureAuth();
        const docSnap = await getDoc(doc(db, "Settings", "HomeLayout"));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setLayout(data.sections || []);
          setIsLocked(data.isLocked !== undefined ? data.isLocked : true);
        }
      } catch (e) {}
    };
    fetchSettings();
  }, []);

  const addSection = (type: string, label: string) => {
    if (isLocked) return alert("النظام مغلق! افتح القفل للتعديل.");
    const newSection = { 
        id: Date.now().toString(), 
        type, 
        label, 
        showLabel: true, // Default to showing title
        width: 100, 
        height: type === 'shorts_grid' ? 400 : (type.includes('slider') ? 220 : 250), 
        marginTop: 0,
        marginBottom: 40, // Default spacing between sections
        gap: 12 // Default gap between items
    };
    setLayout([...layout, newSection]);
  };

  const updateSection = (id: string, key: string, value: any) => {
    if (isLocked) return;
    setLayout(layout.map(s => s.id === id ? { ...s, [key]: value } : s));
  };

  // --- New Logic: Move Sections Up/Down ---
  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (isLocked) return;
    const newLayout = [...layout];
    
    if (direction === 'up' && index > 0) {
        // Swap with previous
        [newLayout[index], newLayout[index - 1]] = [newLayout[index - 1], newLayout[index]];
    } else if (direction === 'down' && index < newLayout.length - 1) {
        // Swap with next
        [newLayout[index], newLayout[index + 1]] = [newLayout[index + 1], newLayout[index]];
    }
    
    setLayout(newLayout);
  };

  const saveLayout = async () => {
    setLoading(true);
    try {
      await ensureAuth();
      await setDoc(doc(db, "Settings", "HomeLayout"), { sections: layout, isLocked, lastUpdated: serverTimestamp() });
      alert("تم حفظ تصميم الواجهة والإعدادات بنجاح!");
    } catch (e) { alert("خطأ في الحفظ"); } finally { setLoading(false); }
  };

  const handleDragStart = (e: React.DragEvent, pos: number) => { if (!isLocked) { dragItem.current = pos; e.dataTransfer.effectAllowed = "move"; } };
  const handleDragEnter = (e: React.DragEvent, pos: number) => { if (!isLocked) dragOverItem.current = pos; };
  const handleDragEnd = () => {
    if (isLocked || dragItem.current === null || dragOverItem.current === null) return;
    const newLayout = [...layout];
    const item = newLayout.splice(dragItem.current, 1)[0];
    newLayout.splice(dragOverItem.current, 0, item);
    dragItem.current = null; dragOverItem.current = null;
    setLayout(newLayout);
  };

  return (
    <div className="p-4 sm:p-8 pb-[500px]">
        {/* Header Controls */}
        <div className="bg-neutral-900/95 border border-purple-500/30 p-2 rounded-2xl shadow-xl mb-8 flex items-center justify-between sticky top-0 z-[60] backdrop-blur-xl gap-2">
            <div className={`flex-1 overflow-x-auto scrollbar-hide flex items-center gap-2 px-2 ${isLocked ? "opacity-50 grayscale pointer-events-none" : ""}`}>
                <button onClick={() => addSection('long_video', 'فيديو كامل')} className="px-3 py-2 bg-white/5 rounded-lg text-[9px] font-bold text-cyan-400 shrink-0 uppercase border border-white/5">فيديو طويل</button>
                <button onClick={() => addSection('shorts_grid', 'شبكة 2×2')} className="px-3 py-2 bg-red-600/10 rounded-lg text-[9px] font-bold text-red-500 shrink-0 uppercase border border-red-500/20">شبكة شورتس</button>
                <button onClick={() => addSection('long_slider', 'شريط رعب')} className="px-3 py-2 bg-white/5 rounded-lg text-[9px] font-bold text-white shrink-0 uppercase border border-white/5">شريط طويل</button>
                <button onClick={() => addSection('slider_left', 'L-R')} className="px-3 py-2 bg-white/5 rounded-lg text-[9px] font-bold text-emerald-400 shrink-0 uppercase border border-white/5">يسار-يمين</button>
                <button onClick={() => addSection('slider_right', 'R-L')} className="px-3 py-2 bg-white/5 rounded-lg text-[9px] font-bold text-purple-400 shrink-0 uppercase border border-white/5">يمين-يسار</button>
            </div>
            <div className="flex gap-2 shrink-0 border-r border-white/10 pr-2">
                <button onClick={() => setIsLocked(!isLocked)} className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLocked ? "bg-red-600/10 text-red-500 border border-red-500/50" : "bg-green-600/10 text-green-500 border border-green-500/50"}`}>
                    {isLocked ? '🔒' : '🔓'}
                </button>
                <button onClick={saveLayout} disabled={loading} className="w-10 h-10 bg-purple-600 rounded-xl text-white font-bold flex items-center justify-center">
                    {loading ? '...' : '💾'}
                </button>
            </div>
        </div>

        {/* Sections List */}
        <div className="space-y-8">
            {layout.map((section, idx) => (
                <div key={section.id} draggable={!isLocked} onDragStart={e => handleDragStart(e, idx)} onDragEnter={e => handleDragEnter(e, idx)} onDragEnd={handleDragEnd} className={`group relative bg-black/40 border border-white/10 p-4 rounded-3xl transition-all ${!isLocked ? 'hover:border-purple-500 cursor-move' : ''}`}>
                    
                    {/* Controls Header inside each card */}
                    <div className={`flex items-center gap-3 mb-4 ${isLocked ? 'pointer-events-none opacity-50' : ''}`}>
                       
                       {/* Section Name Input */}
                       <div className="flex-1">
                           <label className="text-[9px] text-gray-500 block mb-1">اسم القسم</label>
                           <input type="text" value={section.label} onChange={e => updateSection(section.id, 'label', e.target.value)} className="bg-black/50 text-white font-bold w-full p-2 rounded-lg text-xs outline-none border border-white/10 focus:border-purple-500 transition-colors" placeholder="اسم القسم"/>
                       </div>
                       
                       {/* Show Label Checkbox */}
                       <div className="flex flex-col items-center px-2">
                           <label className="text-[9px] text-gray-500 block mb-1">العنوان</label>
                           <input type="checkbox" checked={section.showLabel !== false} onChange={e => updateSection(section.id, 'showLabel', e.target.checked)} className="w-5 h-5 accent-purple-600 cursor-pointer" />
                       </div>

                       {/* UP / DOWN / DELETE Buttons */}
                       <div className="flex items-center gap-1 self-end">
                           <button 
                               onClick={() => moveSection(idx, 'up')} 
                               disabled={idx === 0}
                               className={`w-9 h-9 rounded-lg border flex items-center justify-center text-lg font-bold transition-all ${idx === 0 ? 'border-gray-700 text-gray-700 cursor-not-allowed' : 'bg-blue-600/20 border-blue-500 text-blue-400 hover:bg-blue-600 hover:text-white'}`}
                               title="تحريك لأعلى"
                           >
                               ⬆️
                           </button>
                           <button 
                               onClick={() => moveSection(idx, 'down')} 
                               disabled={idx === layout.length - 1}
                               className={`w-9 h-9 rounded-lg border flex items-center justify-center text-lg font-bold transition-all ${idx === layout.length - 1 ? 'border-gray-700 text-gray-700 cursor-not-allowed' : 'bg-blue-600/20 border-blue-500 text-blue-400 hover:bg-blue-600 hover:text-white'}`}
                               title="تحريك لأسفل"
                           >
                               ⬇️
                           </button>
                           <button 
                               onClick={() => setLayout(layout.filter(s => s.id !== section.id))} 
                               className="w-9 h-9 rounded-lg bg-red-600/20 text-red-500 border border-red-500/50 flex items-center justify-center font-bold hover:bg-red-600 hover:text-white transition-colors ml-2"
                               title="حذف القسم"
                           >
                               X
                           </button>
                       </div>
                    </div>

                    {/* Advanced Spacing Controls */}
                    <div className={`grid grid-cols-2 gap-4 border-t border-white/5 pt-4 ${isLocked ? 'pointer-events-none opacity-50' : ''}`}>
                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="text-[9px] text-gray-400">بعد القسم (Spacing)</label>
                                <span className="text-[9px] text-purple-400">{section.marginBottom || 40}px</span>
                            </div>
                            <input 
                                type="range" min="0" max="200" step="5" 
                                value={section.marginBottom || 40} 
                                onChange={e => updateSection(section.id, 'marginBottom', parseInt(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="text-[9px] text-gray-400">تقارب الفيديوهات (Gap)</label>
                                <span className="text-[9px] text-cyan-400">{section.gap || 12}px</span>
                            </div>
                            <input 
                                type="range" min="0" max="50" step="2" 
                                value={section.gap || 12} 
                                onChange={e => updateSection(section.id, 'gap', parseInt(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                        </div>
                    </div>

                    {/* Visual Preview Stub */}
                    <div className="mt-4 py-2 bg-neutral-900/50 rounded-xl flex items-center justify-center text-[10px] text-gray-600 uppercase font-bold tracking-widest italic border border-white/5 border-dashed">
                         معاينة: {section.type} {section.type === 'shorts_grid' ? '(شبكة)' : '(شريط)'}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

const SectionRenamingManager: React.FC = () => {
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchLayout = async () => {
      try {
        await ensureAuth();
        const snap = await getDoc(doc(db, "Settings", "HomeLayout"));
        if (snap.exists()) setSections(snap.data().sections || []);
      } catch (e) {} finally { setLoading(false); }
    };
    fetchLayout();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await ensureAuth();
      await updateDoc(doc(db, "Settings", "HomeLayout"), { sections, lastUpdated: serverTimestamp() });
      alert("تم حفظ أسماء الأقسام!");
    } catch (e) { alert("فشل الحفظ"); } finally { setSaving(false); }
  };

  if (loading) return <div className="text-center p-8 text-cyan-500 animate-pulse font-black italic">جاري جلب بيانات الواجهة...</div>;

  return (
    <div className="p-4 sm:p-8 pb-32">
       <div className="bg-neutral-900 border border-cyan-500/30 p-6 rounded-[2.5rem] mb-8 shadow-xl">
          <h2 className="text-2xl font-black text-white italic">تسميات الواجهة</h2>
          <p className="text-[10px] text-gray-500 font-bold mt-1">تغيير الأسماء التي تظهر للمستخدمين فوق القوائم</p>
       </div>
       <div className="space-y-4">
          {sections.map((s, i) => (
             <div key={i} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex items-center gap-4 group">
                <span className="text-[10px] font-black text-red-500 w-20 shrink-0">{s.type.replace('_', ' ')}</span>
                <input type="text" value={s.label || ''} onChange={e => { const u = [...sections]; u[i].label = e.target.value; setSections(u); }} className="flex-1 bg-transparent text-white font-bold text-sm outline-none border-b border-white/10 focus:border-red-600 transition-colors" placeholder="مثال: أحدث الأهوال"/>
             </div>
          ))}
       </div>
       <button onClick={handleSave} disabled={saving} className="w-full mt-8 py-4 bg-cyan-600 hover:bg-cyan-500 rounded-2xl text-white font-black shadow-lg active:scale-95 transition-all">{saving ? 'جاري الحفظ...' : 'حفظ التغييرات 💾'}</button>
    </div>
  );
};

interface AdminDashboardProps { onClose: () => void; categories: string[]; initialVideos: Video[]; }

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose, categories, initialVideos }) => {
  const [currentPasscode, setCurrentPasscode] = useState('5030775');
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('الكل');
  const [viewMode, setViewMode] = useState<'videos' | 'analytics' | 'layout'>('videos'); 
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const requestDelete = (id: string) => setDeleteTargetId(id);

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await ensureAuth();
      await deleteDoc(doc(db, "videos", deleteTargetId));
      if (editingId === deleteTargetId) cancelEdit();
      setDeleteTargetId(null);
      alert("تم الحذف بنجاح!");
    } catch (e) { alert("فشل الحذف"); } finally { setIsDeleting(false); }
  };

  const [newVideo, setNewVideo] = useState({
    title: '', description: '', category: categories[0] || 'هجمات مرعبة', video_type: 'Shorts' as VideoType, is_trending: false, read_narrative: false, redirect_url: '', poster_url: '', video_url: '' 
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);
  const [generatedPosterBlob, setGeneratedPosterBlob] = useState<Blob | null>(null);
  const [isGeneratingThumb, setIsGeneratingThumb] = useState(false);

  useEffect(() => {
      const fetchPasscode = async () => {
          try {
              await ensureAuth();
              const snap = await getDoc(doc(db, "settings", "api_config"));
              if (snap.exists() && snap.data().admin_passcode) setCurrentPasscode(snap.data().admin_passcode);
          } catch (e) {} finally { setIsAuthLoading(false); }
      };
      fetchPasscode();
  }, []);

  const handleAuth = () => { if (passcode === currentPasscode) setIsAuthenticated(true); else { alert("الرمز خاطئ!"); setPasscode(''); } };

  const generateAutoThumbnail = async (file: File): Promise<Blob | null> => {
        setIsGeneratingThumb(true);
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.muted = true; video.playsInline = true; video.autoplay = true; 
            const timeout = setTimeout(() => { setIsGeneratingThumb(false); video.remove(); resolve(null); }, 10000); 
            video.onloadeddata = () => { video.currentTime = 1.5; };
            video.onseeked = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const targetWidth = 320;
                    const scaleFactor = targetWidth / video.videoWidth; 
                    canvas.width = targetWidth; canvas.height = video.videoHeight * scaleFactor;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob((blob) => {
                            clearTimeout(timeout);
                            setIsGeneratingThumb(false); video.remove();
                            resolve(blob);
                        }, 'image/jpeg', 0.4); 
                    } else { throw new Error(); }
                } catch(e) { clearTimeout(timeout); setIsGeneratingThumb(false); video.remove(); resolve(null); }
            };
            video.onerror = () => { clearTimeout(timeout); setIsGeneratingThumb(false); video.remove(); resolve(null); };
        });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPreviewUrl(URL.createObjectURL(file));
      setGeneratedPosterBlob(null); setPosterPreviewUrl(null);
      const blob = await generateAutoThumbnail(file);
      if (blob) { setGeneratedPosterBlob(blob); setPosterPreviewUrl(URL.createObjectURL(blob)); }
    }
  };

  const cancelEdit = () => {
    setEditingId(null); setPreviewUrl(null); setPosterPreviewUrl(null); setGeneratedPosterBlob(null);
    setNewVideo({ title: '', description: '', category: categories[0], video_type: 'Shorts', is_trending: false, read_narrative: false, redirect_url: '', poster_url: '', video_url: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePublish = async () => {
    if (isGeneratingThumb) return alert("جاري معالجة صورة الغلاف...");
    const file = fileInputRef.current?.files?.[0];
    
    // Check if we are uploading new OR editing existing with a valid previous URL
    if (!editingId && !file && !newVideo.redirect_url) return alert("اختر فيديو أو ضع رابطاً!");

    setIsUploading(true); setUploadProgress(0);
    try {
      await ensureAuth();
      
      // CRITICAL FIX: Default to existing URLs (from edit state) if no new file is selected
      // This prevents wiping the video URL when just editing title/trending status
      let finalVideoUrl = newVideo.video_url || ""; 
      let finalPosterUrl = newVideo.poster_url || "";

      // Only if a NEW file is selected, override URL
      if (file && previewUrl && previewUrl.startsWith('blob:')) {
          const safeFileName = `vid_${Date.now()}.mp4`;
          await new Promise<void>((res, rej) => {
              const xhr = new XMLHttpRequest();
              xhr.open('PUT', `${R2_WORKER_URL}/${encodeURIComponent(safeFileName)}`, true);
              xhr.upload.onprogress = (e) => e.lengthComputable && setUploadProgress((e.loaded / e.total) * 100);
              xhr.onload = () => xhr.status < 300 ? res() : rej();
              xhr.onerror = rej; xhr.send(file);
          });
          finalVideoUrl = `${R2_PUBLIC_URL}/${safeFileName}`;
      }

      // Handle new poster upload
      if (generatedPosterBlob) {
          const safePosterName = `poster_${Date.now()}.jpg`;
          await new Promise<void>((res, rej) => {
              const xhr = new XMLHttpRequest();
              xhr.open('PUT', `${R2_WORKER_URL}/${encodeURIComponent(safePosterName)}`, true);
              xhr.setRequestHeader('Content-Type', 'image/jpeg');
              xhr.onload = () => xhr.status < 300 ? res() : rej();
              xhr.onerror = rej; xhr.send(generatedPosterBlob);
          });
          finalPosterUrl = `${R2_PUBLIC_URL}/${safePosterName}`;
      }

      const videoData = { 
          ...newVideo, 
          video_url: finalVideoUrl, 
          poster_url: finalPosterUrl 
      };

      if (editingId) {
          // Update existing doc
          await updateDoc(doc(db, "videos", editingId), videoData);
      } else {
          // Create new doc
          await addDoc(collection(db, "videos"), { 
              ...videoData, 
              created_at: serverTimestamp(), 
              views: 0, 
              likes: 0 
          });
      }
      
      alert("تم النشر/التعديل بنجاح!"); cancelEdit();
    } catch (e) { 
        console.error(e);
        alert("فشل النشر"); 
    } finally { setIsUploading(false); }
  };

  const filteredVideos = useMemo(() => initialVideos.filter(v => (filterCategory === 'الكل' || v.category === filterCategory) && v.title.toLowerCase().includes(searchQuery.toLowerCase())), [initialVideos, searchQuery, filterCategory]);

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="relative mb-8">
            <div className="absolute inset-0 bg-red-600 blur-2xl opacity-20 animate-pulse rounded-full"></div>
            <img src={LOGO_URL} className="w-24 h-24 rounded-full border-4 border-red-600 relative z-10 shadow-[0_0_30px_red]" />
        </div>
        <h2 className="text-2xl font-black text-red-600 mb-6 italic tracking-wider">لوحة التحكم</h2>
        <input type="password" value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="أدخل الرمز السري..." className="bg-neutral-900 border border-white/10 p-4 rounded-2xl text-white text-center w-72 mb-6 outline-none focus:border-red-600 transition-all font-black text-xl"/>
        <button onClick={handleAuth} className="bg-red-600 hover:bg-red-500 text-white font-black px-16 py-4 rounded-2xl shadow-[0_0_20px_red] active:scale-95 transition-all text-lg">دخول السيادة</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[900] bg-black overflow-hidden flex flex-col" dir="rtl">
      <div className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-black/90 backdrop-blur-3xl shrink-0 z-50">
        <div className="flex gap-2">
            <button onClick={() => setViewMode('videos')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${viewMode === 'videos' ? 'bg-red-600/10 border-red-500 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'bg-black border-white/5 text-gray-400 hover:text-white'}`}>المكتبة</button>
            <button onClick={() => setViewMode('layout')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${viewMode === 'layout' ? 'bg-purple-600/10 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-black border-white/5 text-gray-400 hover:text-white'}`}>الواجهة</button>
            <button onClick={() => setViewMode('analytics')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${viewMode === 'analytics' ? 'bg-cyan-600/10 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-black border-white/5 text-gray-400 hover:text-white'}`}>الأسماء</button>
        </div>
        <div onClick={onClose} className="w-10 h-10 rounded-full border-2 border-red-600 flex items-center justify-center cursor-pointer text-white font-black hover:bg-red-600 transition-colors">X</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8 pb-32">
        {viewMode === 'layout' ? <LayoutEditor initialVideos={initialVideos} /> : viewMode === 'analytics' ? <SectionRenamingManager /> : (
            <div className="space-y-8 max-w-5xl mx-auto">
                <div className={`bg-neutral-900/30 border p-6 rounded-[2.5rem] shadow-2xl flex flex-col gap-6 ${editingId ? 'border-blue-600/50' : 'border-white/5'}`}>
                    <div className="flex gap-6 items-stretch">
                        <div onClick={() => !isUploading && !isGeneratingThumb && fileInputRef.current?.click()} className="flex-1 aspect-video border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center bg-black/50 cursor-pointer overflow-hidden relative group hover:border-red-600 transition-colors">
                          <input type="file" ref={fileInputRef} accept="video/*" className="hidden" onChange={handleFileSelect} />
                          {isGeneratingThumb ? (
                              <div className="flex flex-col items-center gap-3">
                                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                  <div className="text-blue-400 font-black text-xs">جاري تجهيز الغلاف...</div>
                              </div>
                          ) : isUploading ? (
                              <div className="flex flex-col items-center gap-3">
                                  <div className="text-white font-black text-3xl">{Math.round(uploadProgress)}%</div>
                                  <div className="text-red-500 font-bold text-[10px] animate-pulse">جاري الرفع للخزنة...</div>
                              </div>
                          ) : (previewUrl || newVideo.video_url) ? (
                              <>
                                <video src={previewUrl || newVideo.video_url} className="w-full h-full object-cover group-hover:opacity-60 transition-opacity" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <span className="bg-black/70 text-white px-3 py-1 rounded-lg text-xs font-bold">تغيير الفيديو</span>
                                </div>
                              </>
                          ) : (
                              <div className="text-center">
                                  <svg className="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                                  <div className="text-gray-500 font-black text-xs">اضغط لرفع فيديو جديد</div>
                              </div>
                          )}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <input type="text" placeholder="عنوان الكابوس..." value={newVideo.title} onChange={e => setNewVideo({...newVideo, title: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-white font-black outline-none focus:border-red-600 transition-colors" />
                        <textarea placeholder="السرد المرعب (نص القصة)..." value={newVideo.description} onChange={e => setNewVideo({...newVideo, description: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-white min-h-[120px] outline-none focus:border-red-600 transition-colors" />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <select value={newVideo.category} onChange={e => setNewVideo({...newVideo, category: e.target.value})} className="bg-black/50 border border-white/10 rounded-2xl p-4 text-red-500 font-black outline-none cursor-pointer">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                            <select value={newVideo.video_type} onChange={e => setNewVideo({...newVideo, video_type: e.target.value as VideoType})} className="bg-black/50 border border-white/10 rounded-2xl p-4 text-white font-black outline-none cursor-pointer"><option value="Shorts">Shorts</option><option value="Long Video">Long Video</option></select>
                        </div>

                        {/* زر الترند المطلوب بشكل واضح جداً */}
                        <div className="mt-4 p-1">
                            <button 
                                onClick={() => setNewVideo(prev => ({ ...prev, is_trending: !prev.is_trending }))}
                                className={`w-full py-4 rounded-2xl border-2 font-black transition-all duration-300 flex items-center justify-center gap-4 text-lg active:scale-95 group relative overflow-hidden ${newVideo.is_trending ? 'bg-red-600 border-red-500 text-white shadow-[0_0_30px_red]' : 'bg-black border-white/20 text-gray-400 hover:border-red-500/50 hover:text-white'}`}
                            >
                                {newVideo.is_trending && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer pointer-events-none"></div>}
                                <span className={`text-3xl transition-transform group-hover:scale-125 ${newVideo.is_trending ? 'animate-bounce' : ''}`}>🔥</span>
                                <div className="flex flex-col items-start">
                                    <span className="uppercase tracking-widest text-sm">{newVideo.is_trending ? 'تم تفعيل وضع الترند (NIGHTMARE MODE)' : 'وضع الترند معطل'}</span>
                                    <span className="text-[10px] opacity-70 font-normal">{newVideo.is_trending ? 'سيظهر هذا الفيديو في مقدمة الصفحة مع إطار ناري' : 'اضغط لتفعيل النار'}</span>
                                </div>
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {editingId && <button onClick={cancelEdit} className="px-8 bg-white/5 hover:bg-white/10 rounded-2xl text-white font-bold transition-colors">إلغاء</button>}
                        <button disabled={isUploading || isGeneratingThumb} onClick={handlePublish} className="flex-1 py-5 bg-red-600 hover:bg-red-500 rounded-2xl font-black text-white shadow-xl shadow-red-900/20 active:scale-[0.98] transition-all text-lg">
                            {isUploading ? 'جاري الرفع للحديقة...' : editingId ? 'حفظ التعديلات 💾' : 'نشر الفيديو الآن 🔥'}
                        </button>
                    </div>
                </div>

                <div className="space-y-4 pt-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black text-white italic">أرشيف الفيديوهات</h2>
                        <input type="text" placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-neutral-900 border border-white/10 px-4 py-2 rounded-xl text-xs text-white outline-none w-48 focus:border-red-600 transition-all"/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredVideos.map(v => (
                            <div key={v.id} className={`bg-neutral-900/40 border border-white/5 p-4 rounded-[2rem] flex flex-col gap-4 group hover:border-red-600/30 transition-colors ${editingId === v.id ? 'ring-2 ring-blue-500' : ''}`}>
                                <div className="aspect-video bg-black rounded-2xl overflow-hidden relative">
                                    <video src={v.video_url} poster={v.poster_url || undefined} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" preload="metadata" />
                                    {v.is_trending && <div className="absolute top-2 left-2 bg-red-600 text-[7px] font-black text-white px-2 py-0.5 rounded-md shadow-lg flex items-center gap-1"><span>🔥</span> TREND</div>}
                                </div>
                                <div className="px-1">
                                    <h3 className="text-xs font-black text-white truncate italic">{v.title}</h3>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-[8px] font-bold text-gray-500 uppercase">{v.category}</span>
                                        <span className="text-[8px] font-black text-red-500">{v.video_type}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { 
                                        setEditingId(v.id); 
                                        setNewVideo({
                                            title: v.title,
                                            description: v.description,
                                            category: v.category,
                                            video_type: v.video_type,
                                            is_trending: v.is_trending,
                                            read_narrative: v.read_narrative || false,
                                            redirect_url: v.redirect_url || '',
                                            poster_url: v.poster_url || '',
                                            video_url: v.video_url || ''
                                        }); 
                                        setPreviewUrl(v.video_url); // Set existing URL for preview
                                        setPosterPreviewUrl(v.poster_url || null); 
                                        // Scroll to top
                                        document.querySelector('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' });
                                    }} className="flex-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 py-2 rounded-xl text-[10px] font-black transition-colors">تعديل</button>
                                    <button onClick={() => requestDelete(v.id)} className="flex-1 bg-red-600/10 hover:bg-red-600/20 text-red-500 py-2 rounded-xl text-[10px] font-black transition-colors">حذف</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* مودال تأكيد الحذف */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[1200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-neutral-900 border-2 border-red-600/30 p-10 rounded-[3rem] text-center max-w-sm shadow-[0_0_60px_rgba(220,38,38,0.2)] animate-in zoom-in duration-200">
                <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </div>
                <h3 className="text-xl font-black text-white mb-2">حذف كابوس للأبد؟</h3>
                <p className="text-gray-500 text-xs mb-8 font-bold">لا يمكن التراجع عن هذا القرار، الفيديو سيختفي من أرشيف الحديقة.</p>
                <div className="flex flex-col gap-3">
                    <button onClick={confirmDelete} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black shadow-lg transition-all active:scale-95">نعم، امسحه تماماً 💀</button>
                    <button onClick={() => setDeleteTargetId(null)} className="w-full bg-white/5 hover:bg-white/10 text-white py-4 rounded-2xl font-bold border border-white/10 transition-all">تراجع</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

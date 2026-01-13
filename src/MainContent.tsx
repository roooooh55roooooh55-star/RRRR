
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Video, UserInteractions } from './types';
import { downloadVideoWithProgress } from './offlineManager';
import { db, ensureAuth } from './firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import CustomDynamicLayout from './CustomDynamicLayout';

export const LOGO_URL = "https://i.top4top.io/p_3643ksmii1.jpg";

// Distinct Colors Palette - Massive Expansion for Variety
const COLOR_PALETTE = [
  'border-red-600', 'border-red-500', 'border-red-400',
  'border-orange-600', 'border-orange-500', 'border-orange-400',
  'border-amber-500', 'border-amber-400', 'border-yellow-500',
  'border-yellow-400', 'border-lime-500', 'border-lime-400',
  'border-green-600', 'border-green-500', 'border-green-400',
  'border-emerald-500', 'border-emerald-400', 'border-teal-500',
  'border-teal-400', 'border-cyan-500', 'border-cyan-400',
  'border-sky-500', 'border-sky-400', 'border-blue-600',
  'border-blue-500', 'border-indigo-500', 'border-indigo-400',
  'border-violet-600', 'border-violet-500', 'border-purple-600',
  'border-purple-500', 'border-fuchsia-600', 'border-fuchsia-500',
  'border-pink-600', 'border-pink-500', 'border-rose-500'
];

export const getNeonColor = (id: string, indexOffset: number = 0) => {
  let hash = 0;
  const str = id + indexOffset.toString();
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Ensure we cycle through the massive palette
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return { 
      border: COLOR_PALETTE[index], 
  };
};

export const getDeterministicStats = (seed: string) => {
  let hash = 0;
  if (!seed) return { views: 0, likes: 0 };
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const baseViews = Math.abs(hash % 900000) + 500000; 
  const views = baseViews * (Math.abs(hash % 5) + 2); 
  const likes = Math.abs(Math.floor(views * (0.12 + (Math.abs(hash % 15) / 100)))); 
  return { views, likes };
};

export const formatBigNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

export const formatVideoSource = (video: Video) => {
  if (!video) return "";
  let r2Url = video.video_url || "";
  
  if (video.redirect_url && video.redirect_url.trim() !== "" && !r2Url) {
    return ""; // Can't play redirect without video source
  }
  
  if (!r2Url || !r2Url.startsWith('http')) return "";

  try {
     new URL(r2Url);
  } catch(e) { return ""; }
  
  return r2Url;
};

// --- SAFE VIDEO COMPONENT FOR AUTOPLAY ---
export const SafeAutoPlayVideo: React.FC<React.VideoHTMLAttributes<HTMLVideoElement>> = (props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    const v = videoRef.current;
    if (v && props.src) {
      v.muted = true;
      // We do NOT call play() here automatically to keep page load lightning fast.
      // Playback is handled by parents or interaction.
    }
  }, [props.src]);

  return <video ref={videoRef} {...props} autoPlay={false} preload="none" />;
};

export const NeonTrendBadge = ({ is_trending }: { is_trending: boolean }) => {
  if (!is_trending) return null;
  return (
    <div className="absolute top-2 left-2 z-50">
      <div className="p-1.5 rounded-lg bg-red-600 text-white shadow-[0_0_15px_#ef4444] animate-pulse flex items-center justify-center border border-red-400">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.55,11.2C17.32,10.93 15.33,8.19 15.33,8.19C15.33,8.19 15.1,10.03 14.19,10.82C13.21,11.66 12,12.24 12,13.91C12,15.12 12.6,16.22 13.56,16.89C13.88,17.11 14.24,17.29 14.63,17.41C15.4,17.63 16.23,17.61 17,17.33C17.65,17.1 18.23,16.69 18.66,16.15C19.26,15.38 19.5,14.41 19.34,13.44C19.16,12.56 18.63,11.83 18.05,11.33C17.9,11.23 17.73,11.25 17.55,11.2M13,3C13,3 12,5 10,7C8.5,8.5 7,10 7,13C7,15.76 9.24,18 12,18C12,18 11.5,17.5 11,16.5C10.5,15.5 10,14.5 10,13.5C10,12.5 10.5,11.5 11.5,10.5C12.5,9.5 14,8 14,8C14,8 15,10 16,12C16.5,13 17,14 17,15C17,15.5 16.9,16 16.75,16.5C17.5,16 18,15C18,13 17,11.5 15,10C13.5,8.88 13,3 13,3Z"/>
        </svg>
      </div>
    </div>
  );
};

const JoyfulNeonLion: React.FC<{ isDownloading: boolean, hasDownloads: boolean }> = ({ isDownloading, hasDownloads }) => (
  <div className="relative">
    {isDownloading && <div className="absolute inset-0 bg-yellow-400 blur-lg rounded-full opacity-40 animate-pulse"></div>}
    <svg 
      className={`w-7 h-7 transition-all duration-500 ${isDownloading ? 'text-yellow-400 scale-110 drop-shadow-[0_0_10px_#facc15]' : hasDownloads ? 'text-cyan-400 drop-shadow-[0_0_8px_#22d3ee]' : 'text-gray-600'}`} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9z" />
      <path d="M8 9.5c0-1.5 1-2.5 4-2.5s4 1 4 2.5" strokeLinecap="round" />
      <circle cx="9.5" cy="11" r="0.8" fill="currentColor" />
      <circle cx="14.5" cy="11" r="0.8" fill="currentColor" />
      <path d="M10 15.5c.5 1 1.5 1.5 2 1.5s1.5-.5 2-1.5" strokeLinecap="round" />
    </svg>
  </div>
);

export const VideoCardThumbnail: React.FC<{ 
  video: Video, 
  isOverlayActive: boolean, 
  interactions: UserInteractions,
  onLike?: (id: string) => void,
  onCategoryClick?: (category: string) => void
}> = ({ video, isOverlayActive, interactions, onLike, onCategoryClick }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);
  
  const stats = useMemo(() => video ? getDeterministicStats(video.video_url) : { views: 0, likes: 0 }, [video?.video_url]);
  const formattedSrc = formatVideoSource(video);
  // Add randomness to color selection based on ID to ensure adjacent variety
  const colors = useMemo(() => video ? getNeonColor(video.id) : {border: 'border-white/10'}, [video]);
  
  const isLiked = interactions?.likedIds?.includes(video?.id) || false;
  const isSaved = interactions?.savedIds?.includes(video?.id) || false;
  const watchItem = interactions?.watchHistory?.find(h => h.id === video?.id);
  const progress = watchItem ? watchItem.progress : 0;
  const isWatched = progress > 0.05; 
  const isHeartActive = isLiked || isSaved;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || hasError || !video) return;
    
    if (isOverlayActive) {
      v.pause();
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        // Only play if visible, but rely on poster for initial load
        const playPromise = v.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {});
        }
      } else {
        v.pause();
      }
    }, { threshold: 0.15 }); 
    observer.observe(v);
    return () => observer.disconnect();
  }, [video?.video_url, isOverlayActive, hasError, video]);

  if (!video) return null;

  if (hasError || !formattedSrc) {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 border border-red-900/30 rounded-2xl p-4 text-center group transform-gpu backface-hidden">
            <div className="w-10 h-10 rounded-full bg-red-900/20 flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-red-700 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <span className="text-[10px] font-bold text-red-800">الكابوس تالف</span>
            <p className="text-[8px] text-red-900 mt-1">{video.title}</p>
        </div>
    );
  }

  // --- STYLE LOGIC ---
  const containerStyle = video.is_trending 
    ? 'border-red-600 border-[2.5px] shadow-[0_0_15px_rgba(220,38,38,0.5)]' 
    : `${colors.border} border-2`;

  return (
    <div className={`w-full h-full relative overflow-hidden group rounded-2xl transition-transform duration-300 transform-gpu backface-hidden active:scale-95 ${containerStyle} bg-black`}>
      
      {/* 
         PERFORMANCE OPTIMIZATION: 
         - preload="none" ensures instant rendering of the grid without fetching video data.
         - poster={video.poster_url} provides the visual immediately.
         - object-cover ensures it fills the distinct frame.
      */}
      <video 
        ref={videoRef} 
        src={formattedSrc}
        poster={video.poster_url || undefined} 
        muted 
        loop 
        playsInline 
        crossOrigin="anonymous" 
        preload="none" 
        className="w-full h-full object-cover opacity-100 contrast-110 saturate-125 pointer-events-none landscape:object-contain relative z-10 bg-black" 
        onError={() => setHasError(true)}
      />
      
      <NeonTrendBadge is_trending={video.is_trending} />

      <div className="absolute top-2 right-2 flex flex-col items-center gap-1 z-30">
        <button 
          onClick={(e) => { e.stopPropagation(); onLike?.(video.id); }}
          className={`p-2 rounded-xl backdrop-blur-md border transition-all duration-300 ${isHeartActive ? 'bg-red-600/30 border-red-500 text-red-500' : 'bg-black/60 border-white/20 text-gray-400 hover:border-red-500/50'}`}
        >
          <svg className="w-5 h-5" fill={isHeartActive ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </button>

        {!isWatched && (
          <div className="px-2 py-0.5 bg-yellow-400/10 border border-yellow-400 rounded-md backdrop-blur-sm mt-1">
             <span className="text-[9px] font-black text-blue-400">جديد</span>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 z-20 pointer-events-none">
        <div className="flex justify-start mb-1">
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              onCategoryClick?.(video.category); 
            }}
            className="pointer-events-auto bg-red-600/10 border border-red-600/50 backdrop-blur-md px-2 py-0.5 rounded-[6px] flex items-center gap-1 hover:bg-red-600 hover:text-white transition-all active:scale-90"
          >
             <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
             <span className="text-[8px] font-black text-red-500 hover:text-white truncate max-w-[80px]">{video.category}</span>
          </button>
        </div>

        <p className="text-white text-[10px] font-black line-clamp-1 italic text-right leading-tight drop-shadow-md">{video.title}</p>
        
        <div className="flex items-center justify-end gap-3 mt-1.5 opacity-90">
          <div className="flex items-center gap-1">
             <span className="text-[8px] font-bold text-gray-300 font-mono tracking-tight">{formatBigNumber(stats.likes)}</span>
             <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </div>
          <div className="flex items-center gap-1 border-l border-white/20 pl-3">
             <span className="text-[8px] font-bold text-gray-300 font-mono tracking-tight">{formatBigNumber(stats.views)}</span>
             <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          </div>
        </div>
      </div>
      
      {progress > 0 && progress < 0.99 && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10 z-30">
          <div className="h-full bg-red-600" style={{ width: `${progress * 100}%` }}></div>
        </div>
      )}
    </div>
  );
};

const ResumeNotificationFull: React.FC<{ video: Video, onPlay: () => void, onClose: () => void, pos: {top: string, left: string, anim: string} }> = ({ video, onPlay, onClose, pos }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
     const h = window.innerHeight;
     const w = window.innerWidth;
     let topVal = (parseFloat(pos.top) / 100) * h;
     let leftVal = (parseFloat(pos.left) / 100) * w;
     const popupWidth = 280; 
     const popupHeight = 100;
     const padding = 10;
     if (leftVal + popupWidth > w) leftVal = w - popupWidth - padding;
     if (leftVal < padding) leftVal = padding;
     if (topVal + popupHeight > h) topVal = h - popupHeight - padding;
     if (topVal < padding + 50) topVal = padding + 50; 
     setPosition({ x: leftVal, y: topVal });
  }, [pos]);

  useEffect(() => {
    const timer1 = setTimeout(() => setIsVisible(true), 100);
    const timer2 = setTimeout(() => { if (!isDragging) setIsVisible(false); }, 8000);
    const timer3 = setTimeout(() => { if (!isDragging) onClose(); }, 8500);
    return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
  }, [onClose, isDragging]);

  const handlePermanentDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    sessionStorage.setItem('hadiqa_dismiss_resume', 'true');
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  if (!video || hasError) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setDragStart({ 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const newX = e.touches[0].clientX - dragStart.x;
    const newY = e.touches[0].clientY - dragStart.y;
    setPosition({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const screenH = window.innerHeight;
    const screenW = window.innerWidth;
    const isBottomCenter = position.y > screenH * 0.75 && position.x > screenW * 0.25 && position.x < screenW * 0.75;
    if (isBottomCenter) {
        sessionStorage.setItem('hadiqa_dismiss_resume', 'true');
        setIsVisible(false);
        setTimeout(onClose, 300);
    }
  };

  const borderColor = "border-yellow-400";
  const textColor = "text-yellow-400";

  return (
    <>
        <div 
        ref={elementRef}
        onClick={!isDragging ? onPlay : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`fixed z-[400] transition-transform duration-75 ease-linear flex items-center gap-3 p-2 bg-black/95 border-2 ${borderColor} rounded-2xl cursor-grab active:cursor-grabbing max-w-[280px] group select-none`}
        style={{ 
            top: 0, 
            left: 0,
            transform: `translate(${position.x}px, ${position.y}px) scale(${isDragging ? 1.05 : 1})`,
            opacity: isVisible ? 1 : 0,
            boxShadow: isDragging ? `0 0 20px 5px ${video.is_trending ? '#ef4444' : '#facc15'}` : ''
        }}
        >
        <button 
            onClick={handlePermanentDismiss}
            className="absolute -top-3 -left-3 z-[410] bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center border border-white/50 shadow-md active:scale-90 transition-transform"
        >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <div className="w-16 h-20 shrink-0 rounded-xl overflow-hidden border border-white/20 relative pointer-events-none">
            <video 
                src={formatVideoSource(video)} 
                muted autoPlay loop playsInline 
                className="w-full h-full object-cover" 
                onError={() => setHasError(true)}
                crossOrigin="anonymous" 
                preload="metadata"
                poster={video.poster_url || undefined}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div className="absolute bottom-1 right-1">
            <svg className="w-4 h-4 text-white animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
        </div>
        <div className="flex flex-col gap-0.5 pr-2 pointer-events-none">
            <span className={`text-[9px] font-black uppercase tracking-widest ${textColor} animate-pulse`}>نكمل الحكاية؟</span>
            <h4 className="text-xs font-black text-white italic line-clamp-2 leading-tight drop-shadow-md">{video.title}</h4>
            <div className="w-full h-1 bg-white/20 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-yellow-400 to-red-500 animate-[progress_8s_linear_forwards] w-full origin-left"></div>
            </div>
        </div>
        </div>
    </>
  );
};

export const InteractiveMarquee: React.FC<{ 
  videos: Video[], 
  onPlay: (v: Video) => void,
  direction?: 'left-to-right' | 'right-to-left',
  isShorts?: boolean,
  interactions: UserInteractions,
  transparent?: boolean, 
  onLike?: (id: string) => void, 
  gap?: number; // New Prop for dynamic gap
}> = ({ videos, onPlay, direction = 'right-to-left', isShorts = false, interactions, transparent = false, onLike, gap = 20 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [internalSpeed, setInternalSpeed] = useState(direction === 'left-to-right' ? -0.8 : 0.8);
  const requestRef = useRef<number>(null);

  const displayVideos = useMemo(() => {
    if (!videos || videos.length === 0) return [];
    return videos.length < 5 ? [...videos, ...videos, ...videos, ...videos, ...videos] : [...videos, ...videos, ...videos];
  }, [videos]);

  const animate = useCallback(() => {
    const container = containerRef.current;
    if (container && !isDragging) {
        container.scrollLeft += internalSpeed;
        const { scrollLeft, scrollWidth } = container;
        if (scrollWidth > 0) {
           const singleSetWidth = scrollWidth / 3; 
           if (internalSpeed > 0 && scrollLeft >= singleSetWidth * 2) container.scrollLeft = scrollLeft - singleSetWidth;
           else if (internalSpeed < 0 && scrollLeft <= 10) container.scrollLeft = scrollLeft + singleSetWidth;
        }
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [isDragging, internalSpeed]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [animate]);

  if (displayVideos.length === 0) return null;
  
  // --- UPDATED DIMENSIONS FOR FULL BORDER VISIBILITY ---
  // Significantly increased container height to prevent glow clipping
  const containerHeight = isShorts ? 'h-72' : 'h-60'; 
  const itemDimensions = isShorts ? 'w-32 h-52' : 'w-64 h-36';

  const containerStyle = transparent 
    ? `relative overflow-hidden w-full ${containerHeight} bg-transparent animate-in fade-in duration-700`
    : `relative overflow-hidden w-full ${containerHeight} bg-neutral-900/5 border-y border-white/5 animate-in fade-in duration-700 shadow-inner`;

  return (
    <div className={containerStyle} dir="ltr">
      <div 
        ref={containerRef}
        // Apply dynamic gap directly via inline style
        className="flex px-6 py-6 h-full items-center overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing select-none"
        style={{ gap: `${gap}px` }}
      >
        {displayVideos.map((item, idx) => {
            if (!item || !item.video_url) return null;
            // Add slight randomness to color index for marquee to ensure variety
            const colors = getNeonColor(item.id, idx);
            const formattedSrc = formatVideoSource(item);
            const isLiked = interactions?.likedIds?.includes(item.id);

            return (
              <div key={`${item.id}-${idx}`} onClick={() => onPlay(item)} className={`${itemDimensions} shrink-0 rounded-xl overflow-hidden border-2 relative active:scale-95 transition-transform ${item.is_trending ? 'border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.6)]' : `${colors.border} shadow-[0_0_10px_rgba(255,255,255,0.1)]`} bg-black`} dir="rtl">
                <SafeAutoPlayVideo 
                   src={formattedSrc}
                   poster={item.poster_url || undefined} 
                   muted loop playsInline 
                   crossOrigin="anonymous" 
                   preload="none"
                   className="w-full h-full object-cover opacity-100 contrast-110 saturate-125 pointer-events-none landscape:object-contain relative z-10 bg-black" 
                   onError={(e) => e.currentTarget.style.display = 'none'}
                />
                
                <div className="absolute top-1 right-1 z-20">
                   <button 
                     onClick={(e) => { 
                        e.stopPropagation(); 
                        onLike && onLike(item.id); 
                     }}
                     className={`p-1.5 rounded-lg backdrop-blur-md border transition-all active:scale-75 ${isLiked ? 'bg-red-600/60 border-red-500 text-white shadow-none' : 'bg-black/40 border-white/20 text-gray-300 hover:text-white hover:border-white/50'}`}
                   >
                     <svg className="w-3 h-3" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                   </button>
                </div>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 backdrop-blur-[1px] pointer-events-none z-20">
                  <p className="text-[8px] font-black text-white truncate italic text-right leading-none">{item.title}</p>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
};

const MainContent: React.FC<any> = ({ 
  videos, categoriesList, interactions, onPlayShort, onPlayLong, onCategoryClick, onHardRefresh, onOfflineClick, loading, isOverlayActive, downloadProgress, syncStatus, onLike
}) => {
  // ... (Previous logic for data fetching, no changes needed here) ...
  // Re-render MainContent but rely on CustomDynamicLayout mostly now
  const [pullOffset, setPullOffset] = useState(0);
  const [startY, setStartY] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [resumeNotification, setResumeNotification] = useState<{video: Video, pos: {top: string, left: string, anim: string}} | null>(null);
  const [show3DModal, setShow3DModal] = useState(false);
  const [layoutSettings, setLayoutSettings] = useState<{ sections: any[], isLocked: boolean }>({ sections: [], isLocked: true });

  useEffect(() => {
    const fetchLayout = async () => {
        try {
            await ensureAuth();
            const docRef = doc(db, "Settings", "HomeLayout");
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                const data = snapshot.data();
                setLayoutSettings({ 
                    sections: data.sections || [], 
                    isLocked: data.isLocked !== undefined ? data.isLocked : true 
                });
            }
        } catch (e) {
            console.error("Failed to load home layout:", e);
        }
    };
    fetchLayout();
  }, []);

  const safeVideos = useMemo(() => videos || [], [videos]);
  const shortsOnly = useMemo(() => safeVideos.filter((v: any) => v && v.video_type === 'Shorts'), [safeVideos]);
  const longsOnly = useMemo(() => safeVideos.filter((v: any) => v && v.video_type === 'Long Video'), [safeVideos]);

  // Fallback lists if no layout is defined
  const { 
    marqueeShorts1, marqueeLongs1, 
    gridShorts1, gridShorts2, 
    stackLongs1, 
    marqueeShorts2, marqueeLongs2, 
    gridShorts3, gridShorts4, 
    stackLongs2, 
    marqueeShorts3, marqueeLongs3 
  } = useMemo(() => {
     const usedIds = new Set<string>();
     const getUniqueBatch = (source: Video[], count: number): Video[] => {
        const available = source.filter(v => !usedIds.has(v.id));
        const selected = available.slice(0, count);
        selected.forEach(v => usedIds.add(v.id));
        return selected;
     };

     const ms1 = getUniqueBatch(shortsOnly, 12);
     const ml1 = getUniqueBatch(longsOnly, 8);
     const gs1 = getUniqueBatch(shortsOnly, 2);
     const gs2 = getUniqueBatch(shortsOnly, 2);
     const sl1 = getUniqueBatch(longsOnly, 4);
     const ms2 = getUniqueBatch(shortsOnly, 12);
     const ml2 = getUniqueBatch(longsOnly, 8);
     const gs3 = getUniqueBatch(shortsOnly, 2);
     const gs4 = getUniqueBatch(shortsOnly, 2);
     const sl2 = getUniqueBatch(longsOnly, 4);
     const ms3 = getUniqueBatch(shortsOnly, 12);
     const ml3 = getUniqueBatch(longsOnly, 8);

     return {
        marqueeShorts1: ms1, marqueeLongs1: ml1,
        gridShorts1: gs1, gridShorts2: gs2, stackLongs1: sl1,
        marqueeShorts2: ms2, marqueeLongs2: ml2,
        gridShorts3: gs3, gridShorts4: gs4, stackLongs2: sl2,
        marqueeShorts3: ms3, marqueeLongs3: ml3
     };
  }, [shortsOnly, longsOnly]);

  const unfinishedVideos = useMemo(() => {
    if (!interactions?.watchHistory) return [];
    return interactions.watchHistory
      .filter((h: any) => h.progress > 0.05 && h.progress < 0.95)
      .map((h: any) => safeVideos.find((vid: any) => vid && (vid.id === h.id)))
      .filter((v: any) => v !== undefined && v !== null && v.video_url).reverse();
  }, [interactions?.watchHistory, safeVideos]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return safeVideos.filter((v: any) => 
      v && v.video_url && (v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      v.category.toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 15);
  }, [searchQuery, safeVideos]);

  const getRandomPosition = () => {
    const top = Math.floor(Math.random() * 60) + 15 + '%'; 
    const left = Math.floor(Math.random() * 40) + 5 + '%'; 
    const animations = ['translate(100px, 0)', 'translate(-100px, 0)', 'translate(0, 100px)', 'translate(0, -100px)', 'scale(0.5)'];
    const anim = animations[Math.floor(Math.random() * animations.length)];
    return { top, left, anim };
  };

  useEffect(() => {
    if (isOverlayActive) return;
    if (sessionStorage.getItem('hadiqa_dismiss_resume') === 'true') return;
    const interval = setInterval(() => {
      if (sessionStorage.getItem('hadiqa_dismiss_resume') === 'true') return;
      if (unfinishedVideos.length > 0) {
        const randomVideo = unfinishedVideos[Math.floor(Math.random() * unfinishedVideos.length)];
        setResumeNotification({
            video: randomVideo,
            pos: getRandomPosition()
        });
      }
    }, 30000); 
    return () => clearInterval(interval);
  }, [unfinishedVideos, isOverlayActive]);

  const isActuallyRefreshing = loading || pullOffset > 30;

  return (
    <div 
      onTouchStart={(e) => window.scrollY === 0 && setStartY(e.touches[0].pageY)}
      onTouchMove={(e) => { if (startY === 0) return; const diff = e.touches[0].pageY - startY; if (diff > 0 && diff < 150) setPullOffset(diff); }}
      onTouchEnd={() => { if (pullOffset > 80) onHardRefresh(); setPullOffset(0); setStartY(0); }}
      className="flex flex-col pb-8 w-full bg-black min-h-screen relative"
      style={{ transform: `translateY(${pullOffset / 2}px)` }} dir="rtl"
    >
      <style>{`
        @keyframes spin3D { 0% { transform: perspective(400px) rotateY(0deg); } 100% { transform: perspective(400px) rotateY(360deg); } }
        .animate-spin-3d { animation: spin3D 3s linear infinite; }
      `}</style>
      
      {/* Header and Nav Code... */}
      <header className="flex items-center justify-between py-1 bg-black relative px-4 border-b border-white/5 shadow-lg h-12">
        <div className="flex items-center gap-2" onClick={onHardRefresh}>
          <img src={LOGO_URL} className={`w-8 h-8 rounded-full border-2 transition-all duration-500 ${isActuallyRefreshing ? 'border-yellow-400' : 'border-red-600'}`} />
          {isActuallyRefreshing ? (
             <div className="flex items-center gap-2">
                 <h1 className="text-sm font-black italic text-red-600">الحديقة المرعبة</h1>
                 <div className="px-2 py-0.5 border border-yellow-400 rounded-lg bg-yellow-400/10 animate-pulse">
                     <span className="text-[10px] font-black text-blue-400">تحديث</span>
                 </div>
             </div>
          ) : (
             <h1 className="text-sm font-black italic text-red-600 transition-colors duration-500">الحديقة المرعبة</h1>
          )}
        </div>
        <div className="flex items-center gap-3 -translate-x-2">
          
          <div className="flex items-center gap-2">
             <button onClick={() => setShow3DModal(true)} className="p-2 bg-white/5 border border-cyan-500/50 rounded-xl active:scale-90 transition-all group relative overflow-hidden w-9 h-9 flex items-center justify-center">
                <div className="absolute inset-0 bg-cyan-400/10 animate-pulse"></div>
                <span className="block font-black text-[10px] text-cyan-400 animate-spin-3d">3D</span>
             </button>
          </div>
          <button onClick={() => setIsSearchOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/20 text-white active:scale-90 transition-all hover:border-red-600 hover:text-red-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </button>
          <button onClick={onOfflineClick} className="p-1 transition-all active:scale-90 relative group">
            <JoyfulNeonLion isDownloading={downloadProgress !== null} hasDownloads={interactions?.downloadedIds?.length > 0} />
          </button>
        </div>
      </header>

      <nav className="nav-container nav-mask relative h-10 bg-black/95 backdrop-blur-2xl z-[100] border-b border-white/10 sticky top-16 overflow-x-auto scrollbar-hide flex items-center">
        <div className="animate-marquee-train flex items-center gap-4 px-10">
          {[...(categoriesList || []), ...(categoriesList || [])].map((cat, idx) => (
            <button key={`${cat}-${idx}`} onClick={() => onCategoryClick(cat)} className="neon-white-led shrink-0 px-4 py-1 rounded-full text-[9px] font-black text-white italic whitespace-nowrap">{cat}</button>
          ))}
        </div>
      </nav>

      {syncStatus && (
        <div className="px-5 py-2 bg-cyan-950/20 border-y border-cyan-900/30 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 bg-cyan-500 rounded-full animate-ping"></div>
             <span className="text-[8px] font-black text-cyan-400 italic">جاري تحميل المحتوى للخزنة...</span>
           </div>
           <span className="text-[9px] font-black text-white/60">{Math.round((syncStatus.current/syncStatus.total)*100)}%</span>
        </div>
      )}

      {/* --- RENDER LOGIC: ALWAYS PREFER CUSTOM LAYOUT IF AVAILABLE --- */}
      {layoutSettings.sections.length > 0 ? (
        /* CUSTOM DYNAMIC LAYOUT (Respects Admin Names) */
        <CustomDynamicLayout 
            sections={layoutSettings.sections}
            videos={safeVideos}
            interactions={interactions}
            onPlayShort={onPlayShort}
            onPlayLong={onPlayLong}
            onCategoryClick={onCategoryClick}
            onLike={onLike}
            isOverlayActive={isOverlayActive}
        />
      ) : (
        /* DEFAULT HARDCODED FALLBACK (Only if no layout saved) */
        <>
            {/* 1. Moving Shorts Marquee */}
            {marqueeShorts1.length > 0 && (
                <div className="mb-16"> {/* Increased spacing */}
                    <InteractiveMarquee videos={marqueeShorts1} onPlay={(v) => onPlayShort(v, shortsOnly)} isShorts={true} direction="left-to-right" interactions={interactions} transparent={false} onLike={onLike} />
                </div>
            )}
            
            {/* 2. Moving Long Videos Marquee */}
            {marqueeLongs1.length > 0 && (
                <div className="mb-16"> {/* Increased spacing */}
                    <InteractiveMarquee videos={marqueeLongs1} onPlay={(v) => onPlayLong(v, longsOnly)} direction="right-to-left" interactions={interactions} transparent={false} onLike={onLike} />
                </div>
            )}

            {/* 3. 2 Shorts Side-by-Side */}
            {gridShorts1.length > 0 && (
                <>
                <SectionHeader title="أهوال قصيرة (مختارة)" color="bg-yellow-500" />
                <div className="px-4 grid grid-cols-2 gap-3.5 mb-6">
                    {gridShorts1.map((v: any) => v && (
                    <div key={v.id} onClick={() => onPlayShort(v, shortsOnly)} className="aspect-[9/16] animate-in fade-in duration-500">
                        <VideoCardThumbnail video={v} interactions={interactions} isOverlayActive={isOverlayActive} onLike={onLike} onCategoryClick={onCategoryClick} />
                    </div>
                    ))}
                </div>
                </>
            )}

            {/* ... rest of the grid/stack sections remain same ... */}
            
            {/* 4. 2 Shorts Side-by-Side */}
            {gridShorts2.length > 0 && (
                <div className="px-4 grid grid-cols-2 gap-3.5 mb-6">
                    {gridShorts2.map((v: any) => v && (
                    <div key={v.id} onClick={() => onPlayShort(v, shortsOnly)} className="aspect-[9/16] animate-in fade-in duration-500">
                        <VideoCardThumbnail video={v} interactions={interactions} isOverlayActive={isOverlayActive} onLike={onLike} onCategoryClick={onCategoryClick} />
                    </div>
                    ))}
                </div>
            )}

            {/* 5. 4 Long Videos Stacked */}
            {stackLongs1.length > 0 && (
                <>
                <SectionHeader title="حكايات مرعبة (كاملة)" color="bg-red-600" />
                <div className="px-4 space-y-4 mb-6">
                    {stackLongs1.map((v: any) => v && (
                    <div key={v.id} onClick={() => onPlayLong(v, longsOnly)} className="aspect-video w-full animate-in zoom-in-95 duration-500">
                        <VideoCardThumbnail video={v} interactions={interactions} isOverlayActive={isOverlayActive} onLike={onLike} onCategoryClick={onCategoryClick} />
                    </div>
                    ))}
                </div>
                </>
            )}

            {/* 6. Moving Shorts Marquee */}
            {marqueeShorts2.length > 0 && (
                <div className="mb-16"> {/* Increased spacing */}
                    <SectionHeader title="ومضات من الجحيم" color="bg-orange-500" />
                    <InteractiveMarquee videos={marqueeShorts2} onPlay={(v) => onPlayShort(v, shortsOnly)} isShorts={true} direction="left-to-right" interactions={interactions} onLike={onLike} />
                </div>
            )}

            {/* 7. Moving Long Videos Marquee */}
            {marqueeLongs2.length > 0 && (
                <div className="mb-16"> {/* Increased spacing */}
                    <SectionHeader title="أرشيف الخزنة" color="bg-emerald-500" />
                    <InteractiveMarquee videos={marqueeLongs2} onPlay={(v) => onPlayLong(v, longsOnly)} direction="right-to-left" interactions={interactions} onLike={onLike} />
                </div>
            )}

            {/* Grid 2 Shorts */}
            {gridShorts3.length > 0 && (
                <>
                <SectionHeader title="ظلال متحركة" color="bg-purple-500" />
                <div className="px-4 grid grid-cols-2 gap-3.5 mb-6">
                    {gridShorts3.map((v: any) => v && (
                    <div key={v.id} onClick={() => onPlayShort(v, shortsOnly)} className="aspect-[9/16] animate-in fade-in duration-500">
                        <VideoCardThumbnail video={v} interactions={interactions} isOverlayActive={isOverlayActive} onLike={onLike} onCategoryClick={onCategoryClick} />
                    </div>
                    ))}
                </div>
                </>
            )}

            {/* Grid 2 Shorts */}
            {gridShorts4.length > 0 && (
                <div className="px-4 grid grid-cols-2 gap-3.5 mb-6">
                    {gridShorts4.map((v: any) => v && (
                    <div key={v.id} onClick={() => onPlayShort(v, shortsOnly)} className="aspect-[9/16] animate-in fade-in duration-500">
                        <VideoCardThumbnail video={v} interactions={interactions} isOverlayActive={isOverlayActive} onLike={onLike} onCategoryClick={onCategoryClick} />
                    </div>
                    ))}
                </div>
            )}

            {/* Stack Longs */}
            {stackLongs2.length > 0 && (
                <>
                <SectionHeader title="ملفات سرية" color="bg-blue-600" />
                <div className="px-4 space-y-4 mb-6">
                    {stackLongs2.map((v: any) => v && (
                    <div key={v.id} onClick={() => onPlayLong(v, longsOnly)} className="aspect-video w-full animate-in zoom-in-95 duration-500">
                        <VideoCardThumbnail video={v} interactions={interactions} isOverlayActive={isOverlayActive} onLike={onLike} onCategoryClick={onCategoryClick} />
                    </div>
                    ))}
                </div>
                </>
            )}

            {/* Marquee Shorts */}
            {marqueeShorts3.length > 0 && (
                <div className="mb-16"> {/* Increased spacing */}
                    <SectionHeader title="النهاية تقترب" color="bg-pink-600" />
                    <InteractiveMarquee videos={marqueeShorts3} onPlay={(v) => onPlayShort(v, shortsOnly)} isShorts={true} direction="left-to-right" interactions={interactions} onLike={onLike} />
                </div>
            )}

            {/* Marquee Longs */}
            {marqueeLongs3.length > 0 && (
                <div className="mb-16"> {/* Increased spacing */}
                    <SectionHeader title="الخروج من القبو" color="bg-white" />
                    <InteractiveMarquee videos={marqueeLongs3} onPlay={(v) => onPlayLong(v, longsOnly)} direction="right-to-left" interactions={interactions} onLike={onLike} />
                </div>
            )}
        </>
      )}

      {/* Rest of the component (modals, search, etc.) */}
      <div className="w-full h-8 bg-black flex items-center justify-center group relative border-y border-white/5 mt-4">
          <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest italic z-10">Vault Secure System</span>
      </div>

      {resumeNotification && (
        <ResumeNotificationFull 
          video={resumeNotification.video}
          pos={resumeNotification.pos} 
          onPlay={() => {
            if (resumeNotification.video.video_type === 'Shorts') {
              onPlayShort(resumeNotification.video, shortsOnly);
            } else {
              onPlayLong(resumeNotification.video);
            }
            setResumeNotification(null);
          }}
          onClose={() => setResumeNotification(null)}
        />
      )}

      {show3DModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center pb-80 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShow3DModal(false)}>
          <div className="bg-neutral-900/90 border border-cyan-500/50 p-8 rounded-[2rem] shadow-none text-center transform scale-100 relative overflow-hidden max-w-xs mx-4" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-pulse"></div>
            <h2 className="text-3xl font-black text-white mb-2 italic">تقنية 3D</h2>
            <p className="text-cyan-400 font-bold text-lg animate-pulse">قريباً جداً...</p>
            <div className="mt-6 flex justify-center">
               <div className="w-16 h-16 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin"></div>
            </div>
            <button onClick={() => setShow3DModal(false)} className="mt-8 bg-white/10 hover:bg-white/20 px-6 py-2 rounded-xl text-sm font-bold text-white transition-colors border border-white/10">إغلاق</button>
          </div>
        </div>
      )}

      {isSearchOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
          <div className="p-4 flex items-center gap-4 border-b-2 border-white/10 bg-black">
            <button onClick={() => setIsSearchOpen(false)} className="p-3.5 text-red-600 border-2 border-red-600 rounded-2xl shadow-none active:scale-75 transition-all bg-red-600/10">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <input 
              autoFocus
              type="text" 
              placeholder="ابحث في أرشيف الحديقة..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-white/5 border-2 border-white/10 rounded-2xl py-4.5 px-7 text-white text-base outline-none focus:border-red-600 transition-all font-black text-right"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {searchResults.length > 0 ? searchResults.map((v: any) => v && v.video_url && (
              <div key={v.id} onClick={() => { setIsSearchOpen(false); v.video_type === 'Shorts' ? onPlayShort(v, shortsOnly) : onPlayLong(v, longsOnly); }} className={`flex gap-4.5 p-4 bg-white/5 rounded-3xl border-2 active:scale-95 transition-all shadow-none group ${getNeonColor(v.id).border}`} style={{backgroundColor: 'black'}}>
                <div className="w-28 h-18 bg-black rounded-2xl overflow-hidden shrink-0 border-2 border-white/10">
                  <video src={formatVideoSource(v)} poster={v.poster_url || undefined} crossOrigin="anonymous" preload="metadata" className="w-full h-full object-cover opacity-100 contrast-110 saturate-125 transition-opacity" onError={(e) => e.currentTarget.style.display = 'none'} />
                </div>
                <div className="flex flex-col justify-center flex-1">
                  <h3 className="text-sm font-black text-white italic line-clamp-1 text-right">{v.title}</h3>
                  <span className="text-[9px] text-red-500 font-black uppercase mt-1.5 text-right italic tracking-widest bg-red-600/10 self-end px-2 py-0.5 rounded-md border border-red-600/20">{v.category}</span>
                </div>
              </div>
            )) : searchQuery.trim() && (
              <div className="flex flex-col items-center justify-center py-24 opacity-30 gap-5 text-center">
                <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <p className="font-black italic text-lg">لا توجد نتائج لهذا الكابوس..</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SectionHeader: React.FC<{ title: string, color: string }> = ({ title, color }) => (
  <div className="px-5 py-2 flex items-center gap-2.5">
    <div className={`w-1.5 h-3.5 ${color} rounded-full`}></div>
    <h2 className="text-[11px] font-black text-white italic uppercase tracking-[0.15em]">{title}</h2>
  </div>
);

export default MainContent;

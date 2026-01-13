
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Video, UserInteractions } from './types';
import { getDeterministicStats, formatBigNumber, LOGO_URL, formatVideoSource, NeonTrendBadge } from './MainContent';
import { playNarrative, stopCurrentNarrative } from './elevenLabsManager';

interface ShortsPlayerOverlayProps {
  initialVideo: Video;
  videoList: Video[];
  interactions: UserInteractions;
  onClose: () => void;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  onCategoryClick: (cat: string) => void;
  onSave: (id: string) => void;
  onProgress: (id: string, progress: number) => void;
  onDownload: (video: Video) => void;
  isGlobalDownloading: boolean;
}

const ShortsPlayerOverlay: React.FC<ShortsPlayerOverlayProps> = ({ 
  initialVideo, videoList, interactions, onClose, onLike, onDislike, onCategoryClick, onSave, onProgress, onDownload, isGlobalDownloading
}) => {
  const randomizedList = useMemo(() => [initialVideo, ...videoList.filter(v => v.id !== initialVideo.id).sort(() => Math.random() - 0.5)], [initialVideo, videoList]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  useEffect(() => {
    const v = videoRefs.current[`main-${currentIndex}`];
    if (v) v.play().catch(() => { v.muted = true; v.play(); });
    return () => stopCurrentNarrative();
  }, [currentIndex]);

  const handleClose = () => { stopCurrentNarrative(); onClose(); };

  return (
    <div className="fixed inset-0 bg-black z-[500] flex flex-col overflow-hidden">
      <div className="absolute top-5 right-4 z-[600]">
        <button onClick={handleClose} className="p-2 rounded-full bg-black/60 text-red-600 border border-red-600 shadow-[0_0_15px_red] active:scale-75 transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="flex-grow overflow-y-scroll snap-y snap-mandatory scrollbar-hide h-full w-full" onScroll={e => {
          const idx = Math.round(e.currentTarget.scrollTop / e.currentTarget.clientHeight);
          if (idx !== currentIndex) setCurrentIndex(idx);
      }}>
        {randomizedList.map((video, idx) => {
          const isLiked = interactions.likedIds.includes(video.id);
          const isActive = idx === currentIndex;

          return (
            <div key={`${video.id}-${idx}`} className="h-full w-full snap-start relative bg-black">
              <video 
                ref={el => { videoRefs.current[`main-${idx}`] = el; }}
                src={video.video_url} 
                className="h-full w-full object-cover"
                playsInline loop crossOrigin="anonymous"
              />
              
              {/* --- ميزة الرابط التفاعلي (Emoji Link Feature) --- */}
              {video.emoji_link && (
                  <div 
                    onClick={() => window.open(video.emoji_link, '_blank')} 
                    className="absolute top-1/3 left-1/2 -translate-x-1/2 z-[100] cursor-pointer animate-bounce group"
                    title="اضغط للانتقال"
                  >
                      <div className="w-20 h-20 bg-black/30 backdrop-blur-md rounded-full border-4 border-cyan-500 flex items-center justify-center text-5xl shadow-[0_0_40px_#22d3ee] transition-transform group-active:scale-90">
                          {video.emoji_icon || '🔗'}
                      </div>
                      <div className="mt-2 bg-cyan-900/80 text-white text-[10px] font-black px-3 py-1 rounded-full text-center border border-cyan-500">
                          اضغط هنا
                      </div>
                  </div>
              )}

              {/* Trend Badge Inside Player */}
              <NeonTrendBadge is_trending={video.is_trending} />

              <div className="absolute bottom-24 left-4 flex flex-col items-center gap-5 z-40">
                  <button onClick={() => onLike(video.id)} className={`p-3.5 rounded-full border-2 ${isLiked ? 'bg-red-600 border-red-400 text-white shadow-[0_0_20px_red]' : 'bg-black/40 border-white/20 text-white'}`}>
                      <svg className="w-6 h-6" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  </button>
                  <button onClick={() => onDownload(video)} className="p-3.5 rounded-full bg-black/40 border-2 border-white/20 text-white">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>
                  </button>
              </div>

              <div className="absolute bottom-24 right-4 z-40 max-w-[70%] text-right">
                  <button onClick={() => onCategoryClick(video.category)} className="bg-red-600 px-3 py-1 rounded-full text-[10px] font-black text-white italic mb-3">{video.category}</button>
                  <h3 className="text-white font-black italic drop-shadow-lg text-lg leading-tight">{video.title}</h3>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShortsPlayerOverlay;

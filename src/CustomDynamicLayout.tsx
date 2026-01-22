
import React, { useMemo } from 'react';
import { Video, UserInteractions } from './types';
import { InteractiveMarquee, VideoCardThumbnail, formatVideoSource, getNeonColor, SafeAutoPlayVideo } from './MainContent';

interface CustomDynamicLayoutProps {
  sections: any[];
  videos: Video[];
  interactions: UserInteractions;
  onPlayShort: (v: Video, list: Video[]) => void;
  onPlayLong: (v: Video) => void;
  onCategoryClick: (cat: string) => void;
  onLike: (id: string) => void;
  isOverlayActive: boolean;
}

const CustomDynamicLayout: React.FC<CustomDynamicLayoutProps> = ({ 
  sections, 
  videos, 
  interactions, 
  onPlayShort, 
  onPlayLong, 
  onCategoryClick,
  onLike,
  isOverlayActive
}) => {
  
  // نظام توزيع متطور يضمن عدم التكرار عبر الصفحة بالكامل
  const distributedContent = useMemo(() => {
    const usedIds = new Set<string>();
    const distribution: Record<string, Video[]> = {};

    const shortsOnly = videos.filter(v => v.video_type === 'Shorts');
    const longsOnly = videos.filter(v => v.video_type === 'Long Video');

    const pickVideos = (pool: Video[], count: number): Video[] => {
        if (!pool || pool.length === 0) return [];
        // Strict filtering: Only pick videos that haven't been used anywhere else on the page
        const available = pool.filter(v => !usedIds.has(v.id));
        
        // Take up to 'count' items
        const selected = available.slice(0, count);
        
        // Mark these IDs as globally used
        selected.forEach(v => usedIds.add(v.id));
        
        return selected;
    };

    sections.forEach((section, index) => {
        const key = section.id || `section-${index}`;
        if (section.type === 'long_video') {
            distribution[key] = pickVideos(longsOnly, 1);
        } else if (section.type === 'shorts_grid') {
            distribution[key] = pickVideos(shortsOnly, 4);
        } else if (section.type === 'long_slider') {
            distribution[key] = pickVideos(longsOnly, 8);
        } else if (section.type === 'slider_left' || section.type === 'slider_right') {
             distribution[key] = pickVideos(videos, 10);
        }
    });

    return distribution;
  }, [sections, videos]);

  return (
    <div className="w-full flex flex-col p-2 pb-24 animate-in fade-in duration-700 min-h-screen">
      {sections.map((section, idx) => {
        const key = section.id || `section-${idx}`;
        const sectionVideos = distributedContent[key] || [];

        if (sectionVideos.length === 0) return null;

        // Default style values if not present in DB
        const sectionMarginBottom = section.marginBottom !== undefined ? section.marginBottom : 60;
        const itemGap = section.gap !== undefined ? section.gap : 12;
        const showLabel = section.showLabel !== false; // Default to true

        return (
            <div 
            key={key} 
            className="mx-auto overflow-visible rounded-3xl transition-all duration-500 relative z-10"
            style={{ 
                width: `${section.width}%`, 
                height: section.height ? `${section.height}px` : 'auto',
                minHeight: section.type === 'shorts_grid' ? 'auto' : (section.type.includes('slider') ? 'auto' : `${section.height}px`),
                marginTop: `${section.marginTop || 0}px`,
                marginBottom: `${sectionMarginBottom}px` // User-defined spacing
            }}
            >
            {/* عنوان القسم الاختياري */}
            {showLabel && section.label && section.type !== 'long_video' && (
                <div className="px-3 mb-3 flex items-center gap-2">
                    <div className="w-1 h-4 bg-red-600 rounded-full shadow-[0_0_8px_red]"></div>
                    <h3 className="text-[11px] font-black text-white italic uppercase tracking-wider">{section.label}</h3>
                </div>
            )}

            {/* --- فيديو طويل مفرد --- */}
            {section.type === 'long_video' && sectionVideos[0] && (
                <div onClick={() => onPlayLong(sectionVideos[0])} className="w-full h-full">
                    <VideoCardThumbnail 
                      video={sectionVideos[0]} 
                      interactions={interactions} 
                      isOverlayActive={isOverlayActive} 
                      onLike={onLike}
                      onCategoryClick={onCategoryClick}
                    />
                </div>
            )}

            {/* --- شبكة شورتس (2×2) المطلوبة --- */}
            {section.type === 'shorts_grid' && (
                <div 
                    className="w-full grid grid-cols-2 px-1"
                    style={{ gap: `${itemGap}px` }} // User defined gap
                >
                {sectionVideos.slice(0, 4).map((v, i) => {
                    const isLiked = interactions?.likedIds?.includes(v.id);
                    const neonStyle = getNeonColor(v.id, i + idx); 
                    return (
                    <div key={v.id} onClick={() => onPlayShort(v, videos.filter(x => x.video_type === 'Shorts'))} className={`aspect-[9/16] rounded-2xl overflow-hidden relative border-2 ${v.is_trending ? 'border-red-600 shadow-[0_0_12px_red]' : neonStyle.border} bg-black active:scale-95 transition-transform`}>
                        <SafeAutoPlayVideo 
                            src={formatVideoSource(v)} 
                            poster={v.poster_url || undefined}
                            className="w-full h-full object-cover" 
                            muted loop playsInline 
                        />
                        <div className="absolute top-2 right-2 z-20">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onLike(v.id); }}
                                className={`p-1.5 rounded-lg backdrop-blur-md border transition-all ${isLiked ? 'bg-red-600/60 border-red-500 text-white' : 'bg-black/40 border-white/20 text-gray-300'}`}
                            >
                                <svg className="w-3 h-3" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                            </button>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-2"><p className="text-[8px] font-black text-white truncate text-right italic">{v.title}</p></div>
                    </div>
                    );
                })}
                </div>
            )}

            {/* --- السلايدرز --- */}
            {section.type === 'slider_left' && (
                <InteractiveMarquee 
                    videos={sectionVideos} 
                    onPlay={(v: Video) => v.video_type === 'Shorts' ? onPlayShort(v, videos) : onPlayLong(v)} 
                    direction="left-to-right" 
                    interactions={interactions}
                    isShorts={true}
                    transparent={true} 
                    onLike={onLike}
                    gap={itemGap}
                />
            )}

            {section.type === 'slider_right' && (
                <InteractiveMarquee 
                    videos={sectionVideos} 
                    onPlay={(v: Video) => v.video_type === 'Shorts' ? onPlayShort(v, videos) : onPlayLong(v)} 
                    direction="right-to-left" 
                    interactions={interactions}
                    isShorts={true} 
                    transparent={true} 
                    onLike={onLike}
                    gap={itemGap}
                />
            )}

            {section.type === 'long_slider' && (
                <InteractiveMarquee 
                    videos={sectionVideos} 
                    onPlay={(v: Video) => onPlayLong(v)} 
                    direction="right-to-left" 
                    interactions={interactions}
                    isShorts={false} 
                    transparent={true} 
                    onLike={onLike}
                    gap={itemGap}
                />
            )}
            </div>
        );
      })}
    </div>
  );
};

export default CustomDynamicLayout;

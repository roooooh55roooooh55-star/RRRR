
import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { Video, AppView, UserInteractions } from './types';
import { db, ensureAuth } from './firebaseConfig';
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import AppBar from './AppBar';
import MainContent from './MainContent';
import { downloadVideoWithProgress, removeVideoFromCache } from './offlineManager';
import { initSmartBuffering, cleanUpOldCache } from './smartCache';
import { SmartBrain } from './SmartLogic'; 
import { SYSTEM_CONFIG } from './TechSpecs'; 

const ShortsPlayerOverlay = lazy(() => import('./ShortsPlayerOverlay'));
const LongPlayerOverlay = lazy(() => import('./LongPlayerOverlay'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const AIOracle = lazy(() => import('./AIOracle'));
const TrendPage = lazy(() => import('./TrendPage'));
const SavedPage = lazy(() => import('./SavedPage'));
const PrivacyPage = lazy(() => import('./PrivacyPage'));
const HiddenVideosPage = lazy(() => import('./HiddenVideosPage'));
const CategoryPage = lazy(() => import('./CategoryPage'));
const OfflinePage = lazy(() => import('./OfflinePage'));
const UnwatchedPage = lazy(() => import('./UnwatchedPage'));

export const OFFICIAL_CATEGORIES = SYSTEM_CONFIG.officialCategories;

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [activeCategory, setActiveCategory] = useState<string>('');
  
  const [interactions, setInteractions] = useState<UserInteractions>(() => {
    try {
      const saved = localStorage.getItem('al-hadiqa-interactions-v12');
      const data = saved ? JSON.parse(saved) : null;
      return data || { likedIds: [], dislikedIds: [], savedIds: [], savedCategoryNames: [], watchHistory: [], downloadedIds: [] };
    } catch (e) {
      return { likedIds: [], dislikedIds: [], savedIds: [], savedCategoryNames: [], watchHistory: [], downloadedIds: [] };
    }
  });

  const [rawVideos, setRawVideos] = useState<Video[]>(() => {
    try {
      const cached = localStorage.getItem('rooh1_videos_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) { return []; }
  });

  const [displayVideos, setDisplayVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(() => {
    const cached = localStorage.getItem('rooh1_videos_cache');
    return !cached;
  });
  const [isRefreshing, setIsRefreshing] = useState(false); 

  const [selectedShort, setSelectedShort] = useState<{ video: Video, list: Video[] } | null>(null);
  const [selectedLong, setSelectedLong] = useState<{ video: Video, list: Video[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{id: string, progress: number} | null>(null);

  const isOverlayActive = useMemo(() => !!selectedShort || !!selectedLong, [selectedShort, selectedLong]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- SMART RECOMMENDATION ENGINE ---
  const applySmartRecommendations = useCallback((videos: Video[], userInteractions: UserInteractions) => {
    if (!videos || videos.length === 0) return [];
    
    const userInterests = SmartBrain.getTopInterests();
    const primaryInterest = userInterests.length > 0 ? userInterests[0] : null;
    
    const seenIds = new Set([
        ...userInteractions.dislikedIds,
        ...userInteractions.watchHistory.filter(w => w.progress > 0.1).map(w => w.id)
    ]);

    const unseenVideos = videos.filter(v => !seenIds.has(v.id));
    const seenVideos = videos.filter(v => seenIds.has(v.id));

    // Improved Scoring with more randomness for "Different Videos" effect
    const scoreVideo = (v: Video) => {
        let score = Math.random() * 40; // Increased random weight to ensure shuffle
        
        if (primaryInterest && v.category === primaryInterest) score += 30; 
        else if (userInterests.includes(v.category)) score += 10;

        if (v.is_trending) score += 15;
        
        return score;
    };

    const sortedUnseen = unseenVideos.sort((a, b) => scoreVideo(b) - scoreVideo(a));
    
    const finalFeed = sortedUnseen.length < 5 
        ? [...sortedUnseen, ...seenVideos.sort(() => 0.5 - Math.random()).slice(0, 10)] 
        : sortedUnseen;

    return finalFeed;
  }, []);

  // --- INTERACTIVE CLOSE & REFRESH ---
  // Triggered when X is clicked in Shorts/Long player
  const handleClosePlayer = useCallback(() => {
      setSelectedShort(null);
      setSelectedLong(null);
      
      // Fast timeout to allow UI to close first
      setTimeout(() => {
          // 1. Generate a fresh list
          let freshList = applySmartRecommendations(rawVideos, interactions);
          
          // 2. FORCE SHUFFLE: If the top video is the same as before, rotate the list
          // This guarantees the user sees something "different" immediately
          if (displayVideos.length > 0 && freshList.length > 0) {
             const currentTopId = displayVideos[0].id;
             // If smart algo put the same video at top (due to high score), move it
             if (freshList[0].id === currentTopId) {
                 const topItem = freshList.shift();
                 if (topItem) freshList.push(topItem); // Move to end
                 // Additional shuffle of top 5 to be sure
                 const topBatch = freshList.slice(0, 5).sort(() => 0.5 - Math.random());
                 freshList = [...topBatch, ...freshList.slice(5)];
             }
          }

          // 3. Apply Update
          setDisplayVideos([...freshList]); // Spread to force re-render
          showToast("تم تغيير الواقع.. فيديوهات جديدة ظهرت ☠️");
          window.scrollTo({ top: 0, behavior: 'smooth' });
          
          // 4. Preload new content
          initSmartBuffering(freshList.slice(0, 3));
      }, 50);
  }, [rawVideos, interactions, applySmartRecommendations, displayVideos]);

  // --- TRIGGER FEED UPDATE (Background) ---
  const handleVideoFinish = useCallback((category: string) => {
      SmartBrain.saveInterest(category);
  }, []);

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    showToast("جاري تجهيز كوابيس جديدة...");

    const newOrder = applySmartRecommendations(rawVideos, interactions);
    
    if (newOrder.length > 0) {
        await initSmartBuffering(newOrder.slice(0, 3));
    }

    setDisplayVideos(newOrder);
    setCurrentView(AppView.HOME);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsRefreshing(false);
    showToast("تم التحديث بنجاح 💀");

    if (newOrder.length > 3) {
        initSmartBuffering(newOrder.slice(3, 8));
    }
  }, [rawVideos, interactions, applySmartRecommendations, isRefreshing]);

  // Initial Load
  useEffect(() => {
    if (rawVideos.length > 0) {
       const initialDisplay = applySmartRecommendations(rawVideos, interactions);
       setDisplayVideos(initialDisplay);
       initSmartBuffering(initialDisplay.slice(0, 3));
       cleanUpOldCache();
    }
  }, []); 

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    let isMounted = true;

    const initFirestore = async () => {
        try {
            await ensureAuth().catch(e => console.error("Background Auth Error:", e));
            if (!isMounted) return;

            const q = query(collection(db, "videos"), orderBy("created_at", "desc"));
            unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
                const videosList = snapshot.docs.map(doc => {
                    const data = doc.data();
                    let vType = data.video_type;
                    if (vType && typeof vType === 'string') vType = vType.trim();
                    return { id: doc.id, ...data, video_type: vType };
                }) as Video[];
                
                const validVideos = videosList.filter(v => (v.video_url && v.video_url.trim() !== "") || (v.redirect_url && v.redirect_url.trim() !== ""));
                
                localStorage.setItem('rooh1_videos_cache', JSON.stringify(validVideos));
                setRawVideos(validVideos);
                
                if (displayVideos.length === 0) {
                    const smartList = applySmartRecommendations(validVideos, interactions);
                    setDisplayVideos(smartList);
                    initSmartBuffering(smartList);
                }
                
                if (isMounted) setLoading(false);
            }, (err) => {
                console.error("Firestore Error:", err);
                if (isMounted) setLoading(false);
            });
        } catch (error) {
            console.error("Init Error:", error);
            if (isMounted) setLoading(false);
        }
    };

    initFirestore();
    return () => { isMounted = false; unsubscribe(); };
  }, []); 

  useEffect(() => { 
    localStorage.setItem('al-hadiqa-interactions-v12', JSON.stringify(interactions)); 
  }, [interactions]);

  const handleLikeToggle = (id: string) => {
    setInteractions(p => {
      const isAlreadyLiked = p.likedIds.includes(id);
      if (isAlreadyLiked) return { ...p, likedIds: p.likedIds.filter(x => x !== id) };
      return { ...p, likedIds: [...p.likedIds, id], dislikedIds: p.dislikedIds.filter(x => x !== id) };
    });
  };

  const handleDislike = (id: string) => {
    setInteractions(p => ({
      ...p,
      dislikedIds: Array.from(new Set([...p.dislikedIds, id])),
      likedIds: p.likedIds.filter(x => x !== id)
    }));
    showToast("تم الاستبعاد ⚰️");
    handleClosePlayer(); // Close and Refresh immediately on dislike
  };

  const handleDownloadToggle = async (video: Video) => {
    const videoId = video.id;
    const isDownloaded = interactions.downloadedIds.includes(videoId);
    if (isDownloaded) {
      if (window.confirm("حذف من الخزنة؟")) {
        await removeVideoFromCache(video.video_url);
        setInteractions(p => ({ ...p, downloadedIds: p.downloadedIds.filter(id => id !== videoId) }));
        showToast("تمت الإزالة");
      }
    } else {
      setDownloadProgress({ id: videoId, progress: 0 });
      const success = await downloadVideoWithProgress(video.video_url, (p) => setDownloadProgress({ id: videoId, progress: p }));
      if (success) {
        setInteractions(p => ({ ...p, downloadedIds: [...new Set([...p.downloadedIds, videoId])] }));
        showToast("تم الحفظ في الخزنة 🦁");
      }
      setDownloadProgress(null);
    }
  };

  const playShortVideo = (v: Video, list: Video[]) => {
      SmartBrain.saveInterest(v.category);
      const smartList = displayVideos.filter(vid => vid.video_type === 'Shorts');
      setSelectedShort({ video: v, list: smartList });
  };

  const playLongVideo = (v: Video, list?: Video[]) => {
      SmartBrain.saveInterest(v.category);
      const smartList = displayVideos.filter(vid => vid.video_type === 'Long Video');
      setSelectedLong({ video: v, list: smartList });
  };

  const renderContent = () => {
    const activeVideos = displayVideos.filter(v => !interactions.dislikedIds.includes(v.id)); 
    const shortsOnly = activeVideos.filter(v => v.video_type === 'Shorts');
    const longsOnly = activeVideos.filter(v => v.video_type === 'Long Video');

    switch(currentView) {
      case AppView.ADMIN:
        return (
          <Suspense fallback={null}>
            <AdminDashboard 
              onClose={() => setCurrentView(AppView.HOME)} 
              categories={OFFICIAL_CATEGORIES}
              initialVideos={activeVideos}
            />
          </Suspense>
        );
      case AppView.OFFLINE:
        return (
          <Suspense fallback={null}>
            <OfflinePage 
              allVideos={rawVideos} 
              interactions={interactions} 
              onPlayShort={playShortVideo} 
              onPlayLong={(v) => playLongVideo(v)} 
              onBack={() => setCurrentView(AppView.HOME)}
              onUpdateInteractions={setInteractions}
            />
          </Suspense>
        );
      case AppView.CATEGORY:
        return (
          <Suspense fallback={null}>
            <CategoryPage 
              category={activeCategory} 
              allVideos={displayVideos} 
              isSaved={interactions.savedCategoryNames.includes(activeCategory)}
              onToggleSave={() => setInteractions(p => {
                  const isSaved = p.savedCategoryNames.includes(activeCategory);
                  return { ...p, savedCategoryNames: isSaved ? p.savedCategoryNames.filter(c => c !== activeCategory) : [...p.savedCategoryNames, activeCategory] };
              })}
              onPlayShort={playShortVideo}
              onPlayLong={(v) => playLongVideo(v, longsOnly)}
              onBack={() => setCurrentView(AppView.HOME)}
            />
          </Suspense>
        );
      case AppView.TREND:
        return (
          <Suspense fallback={null}>
            <TrendPage 
              allVideos={rawVideos} 
              onPlayShort={playShortVideo} 
              onPlayLong={(v) => playLongVideo(v)} 
              excludedIds={interactions.dislikedIds} 
            />
          </Suspense>
        );
      case AppView.LIKES:
        return (
          <Suspense fallback={null}>
            <SavedPage 
              title="الإعجابات"
              savedIds={interactions.likedIds}
              savedCategories={[]} 
              allVideos={rawVideos} 
              onPlayShort={playShortVideo}
              onPlayLong={(v) => playLongVideo(v)}
              onCategoryClick={(cat) => { setActiveCategory(cat); setCurrentView(AppView.CATEGORY); }}
            />
          </Suspense>
        );
      case AppView.SAVED:
        return (
          <Suspense fallback={null}>
            <SavedPage 
              title="المحفوظات"
              savedIds={interactions.savedIds}
              savedCategories={interactions.savedCategoryNames}
              allVideos={rawVideos}
              onPlayShort={playShortVideo}
              onPlayLong={(v) => playLongVideo(v)}
              onCategoryClick={(cat) => { setActiveCategory(cat); setCurrentView(AppView.CATEGORY); }}
            />
          </Suspense>
        );
      case AppView.HIDDEN:
        return (
          <Suspense fallback={null}>
            <HiddenVideosPage 
              interactions={interactions}
              allVideos={rawVideos}
              onRestore={(id) => {
                setInteractions(p => ({ ...p, dislikedIds: p.dislikedIds.filter(x => x !== id) }));
                showToast("تم استعادة الروح المعذبة 🩸");
              }}
              onPlayShort={playShortVideo}
              onPlayLong={(v) => playLongVideo(v)}
            />
          </Suspense>
        );
      case AppView.PRIVACY:
        return (
          <Suspense fallback={null}>
            <PrivacyPage 
              onOpenAdmin={() => setCurrentView(AppView.ADMIN)} 
              onBack={() => { setCurrentView(AppView.HOME); handleManualRefresh(); }}
            />
          </Suspense>
        );
      case AppView.UNWATCHED:
        return (
           <Suspense fallback={null}>
             <UnwatchedPage 
               watchHistory={interactions.watchHistory}
               allVideos={rawVideos}
               onPlayShort={playShortVideo} 
               onPlayLong={(v) => playLongVideo(v)} 
             />
           </Suspense>
        );
      case AppView.HOME:
      default:
        return (
          <MainContent 
            videos={activeVideos} 
            categoriesList={OFFICIAL_CATEGORIES}
            interactions={interactions}
            onPlayShort={(v: Video, l: Video[]) => playShortVideo(v, shortsOnly)}
            onPlayLong={(v: Video) => playLongVideo(v, longsOnly)}
            onCategoryClick={(cat: string) => { setActiveCategory(cat); setCurrentView(AppView.CATEGORY); }}
            onHardRefresh={handleManualRefresh}
            onOfflineClick={() => setCurrentView(AppView.OFFLINE)}
            loading={loading}
            isOverlayActive={isOverlayActive}
            downloadProgress={downloadProgress}
            syncStatus={isRefreshing ? { current: 1, total: 1 } : null}
            onLike={handleLikeToggle}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <AppBar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        onRefresh={handleManualRefresh}
      />
      
      <main className="pt-16 pb-24 max-w-md mx-auto px-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[70vh] relative">
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-40 h-40 bg-red-600/20 blur-[50px] rounded-full animate-pulse"></div>
            </div>
            <div className="relative flex items-center justify-center">
              <div className="absolute w-28 h-28 rounded-full border-t-4 border-b-4 border-red-600 border-l-transparent border-r-transparent animate-spin" style={{ animationDuration: '1.5s' }}></div>
              <div className="relative z-10 w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 shadow-[0_0_50px_rgba(220,38,38,0.8)] animate-pulse">
                <img src="https://i.top4top.io/p_3643ksmii1.jpg" className="w-full h-full object-cover opacity-90" alt="Loading..." />
              </div>
            </div>
          </div>
        ) : renderContent()}
      </main>

      <Suspense fallback={null}>
        <AIOracle 
          onRefresh={handleManualRefresh} 
          allVideos={rawVideos} 
          interactions={interactions}
          onPlayVideo={(v) => v.type === 'short' 
              ? playShortVideo(v, rawVideos.filter(rv => rv.type === 'short')) 
              : playLongVideo(v, rawVideos.filter(rv => rv.type === 'long'))
          }
        />
      </Suspense>

      {selectedShort && (
        <Suspense fallback={null}>
          <ShortsPlayerOverlay 
            initialVideo={selectedShort.video}
            videoList={selectedShort.list}
            interactions={interactions}
            onClose={handleClosePlayer} // Ensures refresh happens on close
            onLike={handleLikeToggle}
            onDislike={handleDislike}
            onCategoryClick={(cat) => { setActiveCategory(cat); setCurrentView(AppView.CATEGORY); setSelectedShort(null); }}
            onSave={(id) => setInteractions(p => { const isSaved = p.savedIds.includes(id); return { ...p, savedIds: isSaved ? p.savedIds.filter(x => x !== id) : [...p.savedIds, id] }; })}
            onProgress={(id, progress) => {
                if (progress > 0.8) {
                    const vid = selectedShort.video;
                    if (vid) handleVideoFinish(vid.category);
                }
                setInteractions(p => { const history = p.watchHistory.filter(h => h.id !== id); return { ...p, watchHistory: [...history, { id, progress }] }; });
            }}
            onDownload={handleDownloadToggle}
            isGlobalDownloading={!!downloadProgress}
          />
        </Suspense>
      )}

      {selectedLong && (
        <Suspense fallback={null}>
          <LongPlayerOverlay 
            video={selectedLong.video}
            allLongVideos={selectedLong.list}
            onClose={handleClosePlayer} // Ensures refresh happens on close
            onLike={() => handleLikeToggle(selectedLong.video.id)}
            onDislike={() => handleDislike(selectedLong.video.id)}
            onSave={() => { const id = selectedLong.video.id; setInteractions(p => { const isSaved = p.savedIds.includes(id); return { ...p, savedIds: isSaved ? p.savedIds.filter(x => x !== id) : [...p.savedIds, id] }; }); }}
            onSwitchVideo={(v) => { SmartBrain.saveInterest(v.category); setSelectedLong({ video: v, list: selectedLong.list }); }}
            onCategoryClick={(cat) => { setActiveCategory(cat); setCurrentView(AppView.CATEGORY); setSelectedLong(null); }}
            onDownload={() => handleDownloadToggle(selectedLong.video)}
            isLiked={interactions.likedIds.includes(selectedLong.video.id)}
            isDisliked={interactions.dislikedIds.includes(selectedLong.video.id)}
            isSaved={interactions.savedIds.includes(selectedLong.video.id)}
            isDownloaded={interactions.downloadedIds.includes(selectedLong.video.id)}
            isGlobalDownloading={!!downloadProgress}
            onProgress={(p) => { 
                const id = selectedLong.video.id; 
                if (p > 0.9) {
                    handleVideoFinish(selectedLong.video.category);
                }
                setInteractions(prev => { const history = prev.watchHistory.filter(h => h.id !== id); return { ...prev, watchHistory: [...history, { id, progress: p }] }; }); 
            }}
          />
        </Suspense>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000] bg-red-600 text-white px-6 py-3 rounded-full font-black shadow-[0_0_20px_red] animate-bounce text-xs whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
};

export default App;

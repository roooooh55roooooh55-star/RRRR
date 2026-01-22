
import { Video } from './types';

const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB for high-speed buffering
const VIDEO_CACHE_NAME = 'rooh-video-previews-v4';
const IMAGE_CACHE_NAME = 'rooh-posters-v4';

export const preloadAsset = async (url: string, cacheName: string): Promise<boolean> => {
  if (!url || !url.startsWith('http')) return false;
  try {
    const cache = await caches.open(cacheName);
    const match = await cache.match(url);
    if (match) return true;

    const response = await fetch(url, {
      headers: cacheName === VIDEO_CACHE_NAME ? { 'Range': `bytes=0-${CHUNK_SIZE}` } : {},
      mode: 'cors',
      credentials: 'omit'
    });

    if (response.ok || response.status === 206) {
      await cache.put(url, response.clone());
      return true;
    }
    return false;
  } catch (e) { return false; }
};

export const initSmartBuffering = async (videos: Video[]): Promise<void> => {
  if (!navigator.onLine || !videos || videos.length === 0) return;
  
  // 1. Priority: Load ALL visible posters first (Instant UI)
  const visiblePosters = videos.slice(0, 15).map(v => v.poster_url ? preloadAsset(v.poster_url, IMAGE_CACHE_NAME) : Promise.resolve(false));
  await Promise.allSettled(visiblePosters);

  // 2. Secondary: Buffer video streams for the first few items
  const priorityVideos = videos.slice(0, 6).map(v => v.video_url ? preloadAsset(v.video_url, VIDEO_CACHE_NAME) : Promise.resolve(false));
  await Promise.allSettled(priorityVideos);
};

// --- NEW: AI-Triggered Super Boost ---
export const forceAggressiveBuffer = async (videos: Video[]): Promise<void> => {
    console.log("🚀 AI triggered aggressive buffering...");
    if (!navigator.onLine || !videos || videos.length === 0) return;

    // Load deeper into the list (next 20 videos) to solve lag instantly
    const deepBuffer = videos.slice(0, 20).map(v => v.video_url ? preloadAsset(v.video_url, VIDEO_CACHE_NAME) : Promise.resolve(false));
    await Promise.allSettled(deepBuffer);
};

export const cleanUpOldCache = async () => {
    try {
        const vCache = await caches.open(VIDEO_CACHE_NAME);
        const vKeys = await vCache.keys();
        if (vKeys.length > 50) for (let i = 0; i < vKeys.length - 25; i++) await vCache.delete(vKeys[i]);

        const iCache = await caches.open(IMAGE_CACHE_NAME);
        const iKeys = await iCache.keys();
        if (iKeys.length > 100) for (let i = 0; i < iKeys.length - 50; i++) await iCache.delete(iKeys[i]);
    } catch (e) {}
};

import { Video } from './types';

// حجم الجزء الذي سيتم تحميله (2 ميجابايت يكفي لـ 7-10 ثواني بجودة عالية)
const CHUNK_SIZE = 2 * 1024 * 1024; 
const VIDEO_CACHE_NAME = 'rooh-video-previews-v2';

/**
 * يقوم بتحميل أول جزء من الفيديو وتخزينه في الكاش
 * يعود بـ true إذا تم التحميل بنجاح
 */
export const preloadVideoChunk = async (url: string): Promise<boolean> => {
  if (!url || !url.startsWith('http')) return false;

  try {
    const cache = await caches.open(VIDEO_CACHE_NAME);
    const match = await cache.match(url);

    if (match) {
      return true; // موجود بالفعل
    }

    // طلب أول جزء من الملف
    const response = await fetch(url, {
      headers: {
        'Range': `bytes=0-${CHUNK_SIZE}`
      },
      mode: 'cors'
    });

    if (response.ok || response.status === 206) {
      // نقوم بتخزين الاستجابة في الكاش لاستخدامها لاحقاً
      // ملاحظة: المتصفح سيستخدم هذا الكاش تلقائياً عند طلب الفيديو لنفس النطاق
      await cache.put(url, response.clone());
      return true;
    }
    return false;
  } catch (e) {
    console.warn("Preload failed for:", url);
    return false;
  }
};

/**
 * الدالة الرئيسية التي تستدعى عند تحديث القائمة
 * تقوم بتحميل أول 5 فيديوهات لضمان سرعة العرض
 */
export const initSmartBuffering = async (videos: Video[]): Promise<void> => {
  if (!navigator.onLine || !videos || videos.length === 0) return;

  // التركيز على الفيديوهات الأولى التي تظهر للمستخدم
  const priorityQueue = videos.slice(0, 5); 

  // تنفيذ التحميل بشكل متوازي
  const promises = priorityQueue.map(video => {
      if (video.video_url) {
          return preloadVideoChunk(video.video_url);
      }
      return Promise.resolve(false);
  });

  await Promise.allSettled(promises);
};

/**
 * تنظيف الكاش القديم لتوفير مساحة الهاتف
 */
export const cleanUpOldCache = async () => {
    try {
        const cache = await caches.open(VIDEO_CACHE_NAME);
        const keys = await cache.keys();
        // إذا زاد عدد الملفات عن 50، احذف الأقدم
        if (keys.length > 50) {
            for (let i = 0; i < keys.length - 20; i++) {
                await cache.delete(keys[i]);
            }
        }
    } catch (e) {}
};

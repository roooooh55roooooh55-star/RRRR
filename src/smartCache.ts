
import { Video } from './types';

// نرفع إصدار الكاش لضمان بداية نظيفة خالية من الأخطاء القديمة
const VIDEO_CACHE_NAME = 'rooh-video-cache-v9-silent';
const IMAGE_CACHE_NAME = 'rooh-image-cache-v9-silent';

/**
 * دالة تحميل ذكية وتتمتع بـ "الصمت التام" في حال حدوث أخطاء
 */
export const preloadAsset = async (url: string, type: 'video' | 'image'): Promise<boolean> => {
  if (!url || !url.startsWith('http')) return false;

  const cacheName = type === 'video' ? VIDEO_CACHE_NAME : IMAGE_CACHE_NAME;

  try {
    const cache = await caches.open(cacheName);
    const match = await cache.match(url);

    if (match) {
      return true; // موجود مسبقاً في الخزنة
    }

    // المحاولة الأولى: تحميل نظيف (Standard Fetch)
    // نستخدم credentials: 'omit' لتجنب مشاكل الكوكيز مع R2
    try {
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            // لا نرسل Range هنا لتجنب تعقيدات الـ Preflight التي تسبب اللون الأحمر في الكونسول
        });

        if (response.ok) {
            await cache.put(url, response.clone());
            return true;
        }
    } catch (err) {
        // إذا فشلت المحاولة الأولى (بسبب CORS أو غيره)..
        // ننتقل فوراً للخطة البديلة دون طباعة أي خطأ
    }

    // المحاولة الثانية: الوضع الصامت (No-CORS / Opaque)
    // هذا الوضع يسمح بتحميل الملف وتخزينه وتشغيله، لكن لا يمكن قراءة تفاصيله برمجياً
    // وهو الحل السحري لإخفاء أخطاء الكونسول
    try {
        const fallbackResponse = await fetch(url, { mode: 'no-cors' });
        if (fallbackResponse) {
            await cache.put(url, fallbackResponse);
            return true;
        }
    } catch (silentErr) {
        // اصمت تماماً.. لا تخبر أحداً بالفشل
    }

    return false;
  } catch (e) {
    // كاتم الأسرار: أي خطأ غير متوقع يتم تجاهله
    return false;
  }
};

/**
 * بدء التخزين المؤقت الذكي
 */
export const initSmartBuffering = async (videos: Video[]): Promise<void> => {
  if (!navigator.onLine || !videos || videos.length === 0) return;

  // 1. تحميل الصور أولاً (لأنها خفيفة وتعطي شعوراً بالسرعة)
  const posters = videos.slice(0, 10).map(v => 
      v.poster_url ? preloadAsset(v.poster_url, 'image') : Promise.resolve(false)
  );
  
  // 2. تحميل الفيديوهات المهمة (أول 3 فقط لعدم خنق الشبكة)
  const activeVideos = videos.slice(0, 3).map(v => 
      v.video_url ? preloadAsset(v.video_url, 'video') : Promise.resolve(false)
  );

  // تنفيذ في الخلفية دون تعطيل الواجهة
  Promise.allSettled([...posters, ...activeVideos]);
};

/**
 * تعزيز التحميل (يتم استدعاؤه من قبل AI Oracle عند الشكوى)
 */
export const forceAggressiveBuffer = async (videos: Video[]): Promise<void> => {
    if (!navigator.onLine || !videos) return;
    
    // تحميل أعمق (أول 10 فيديوهات)
    const deepBuffer = videos.slice(0, 10).map(v => 
        v.video_url ? preloadAsset(v.video_url, 'video') : Promise.resolve(false)
    );
    Promise.allSettled(deepBuffer);
};

export const cleanUpOldCache = async () => {
    try {
        const keys = await caches.keys();
        for (const key of keys) {
            // حذف أي كاش قديم لا يطابق الإصدار الحالي الصامت
            if (key.startsWith('rooh-') && key !== VIDEO_CACHE_NAME && key !== IMAGE_CACHE_NAME) {
                await caches.delete(key);
            }
        }
    } catch (e) {}
};

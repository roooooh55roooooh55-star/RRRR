import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { SYSTEM_CONFIG } from "./TechSpecs";

// Using the strict configuration from TechSpecs.ts to ensure connectivity
const firebaseConfig = SYSTEM_CONFIG.firebase;

const app = initializeApp(firebaseConfig);

// Initialize Firestore with robust offline persistence settings
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const auth = getAuth(app);
export const storage = getStorage(app);

// Auth helper to ensure access to Firestore rules
export const ensureAuth = async () => {
  try {
    if (auth.currentUser) return auth.currentUser;
    // Attempt sign-in
    const result = await signInAnonymously(auth);
    console.log("🔥 Firebase Connected. User:", result.user.uid);
    return result.user;
  } catch (error: any) {
    // Gracefully handle offline/network errors
    if (error.code === 'auth/network-request-failed' || error.message?.includes('offline')) {
        console.warn("🔥 Auth: Network unavailable. Operating in offline mode.");
        return null;
    }
    console.error("🔥 Auth Error:", error);
    return null;
  }
};


import { GoogleGenAI, Type } from "@google/genai";
import { ensureAuth, db } from "./firebaseConfig";
// Fixed: Removed UserProfile from ./types import as it is missing from that module in the current structure
import { Video } from "./types";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Fixed: Define UserProfile locally to resolve "Module ./types has no exported member UserProfile" error
export interface UserProfile {
    name?: string;
    gender?: 'male' | 'female';
    interests?: string[];
    last_voice_limit_hit?: number; // Timestamp
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AIResponse {
    reply: string;
    action?: 'play_video' | 'none';
    search_query?: string;
    detected_user_info?: { name?: string; gender?: 'male' | 'female'; new_interest?: string; };
}

class SmartBrainLogic {
  private localInterests: string[] = [];

  constructor() {
    try {
      const saved = localStorage.getItem('smart_brain_interests');
      if (saved) this.localInterests = JSON.parse(saved);
    } catch (e) {}
  }

  // Fixed: Exclusively using process.env.API_KEY as per Google GenAI SDK guidelines
  private getGeminiKey(): string {
    return process.env.API_KEY || '';
  }

  async getUserProfile(uid: string): Promise<UserProfile> {
      try {
          const docSnap = await getDoc(doc(db, "users", uid));
          if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              if (data.interests) this.localInterests = Array.from(new Set([...this.localInterests, ...data.interests]));
              return data;
          }
      } catch (e) {}
      return { interests: this.localInterests };
  }

  async updateUserProfile(uid: string, data: Partial<UserProfile>) {
      try { await setDoc(doc(db, "users", uid), data, { merge: true }); } catch (e) {}
  }

  getTopInterests(): string[] { return this.localInterests; }

  async saveInterest(interest: string) {
    if (!interest || this.localInterests.includes(interest)) return;
    this.localInterests.push(interest);
    localStorage.setItem('smart_brain_interests', JSON.stringify(this.localInterests));
    const user = await ensureAuth();
    if (user) await this.updateUserProfile(user.uid, { interests: this.localInterests });
  }

  async askAssistant(userText: string, history: ChatMessage[] = [], availableVideos: Video[] = []): Promise<AIResponse> {
    // Fixed: Initializing GoogleGenAI exclusively with process.env.API_KEY in the constructor
    const ai = new GoogleGenAI({ apiKey: this.getGeminiKey() });
    const user = await ensureAuth();
    const profile = user ? await this.getUserProfile(user.uid) : { interests: this.localInterests };
    
    const systemInstruction = `
        أنتِ "سيدة الحديقة الملعونة". تتحدثين بلهجة مصرية عامية مرعبة وساخرة.
        المصدر الوحيد للفيديوهات هو "خزنة R2" الخاصة بنا.
        الرد يجب أن يكون قصيراً جداً (سطرين كحد أقصى).
        دائماً ذكّري المستخدم بالضغط على زر المايكروفون 🎙️ في لوحة المفاتيح للتحدث بدل الكتابة.
        إذا طلب فيديو، حددي "play_video" في الـ action.
        اسم المستخدم: ${profile.name || "ضحية مجهولة"}.
        اهتماماته: ${profile.interests?.join(', ')}.
        الفيديوهات المتاحة: [${availableVideos.map(v => v.title).slice(0, 30).join(", ")}].
    `;

    const contents = history.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
    contents.push({ role: 'user', parts: [{ text: userText }] });

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: contents,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                temperature: 1.2
            }
        });

        const responseText = result.text || "{}";
        const jsonResponse = JSON.parse(responseText) as AIResponse;

        if (jsonResponse.detected_user_info && user) {
            this.updateUserProfile(user.uid, jsonResponse.detected_user_info);
        }

        return jsonResponse;
    } catch (error) {
        return { reply: "الأرواح مشوشة.. جرب تاني.", action: "none" };
    }
  }
}

export const SmartBrain = new SmartBrainLogic();

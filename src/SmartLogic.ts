
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
    action?: 'play_video' | 'optimize_playback' | 'none'; // Added optimize_playback
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

  // استخدام المفتاح الموجود أو جلبه من البيئة
  private getGeminiKey(): string {
    // المفتاح الاحتياطي المدمج لضمان العمل دائماً
    const STATIC_KEY = 'AIzaSyCEF21AZXTjtbPH1MMrflmmwjyM_BHoLco'; 
    return process.env.API_KEY || STATIC_KEY;
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
    if (!interest) return;
    
    // Remove if exists to re-add at top
    this.localInterests = this.localInterests.filter(i => i !== interest);
    
    // Add to the BEGINNING (Top Priority)
    this.localInterests.unshift(interest);
    
    // Keep only last 10 interests to stay relevant
    if (this.localInterests.length > 10) this.localInterests.pop();

    localStorage.setItem('smart_brain_interests', JSON.stringify(this.localInterests));
    
    try {
        const user = await ensureAuth();
        if (user) await this.updateUserProfile(user.uid, { interests: this.localInterests });
    } catch(e) {}
  }

  async askAssistant(userText: string, history: ChatMessage[] = [], availableVideos: Video[] = []): Promise<AIResponse> {
    // تهيئة الذكاء الاصطناعي بالمفتاح المعتمد
    const ai = new GoogleGenAI({ apiKey: this.getGeminiKey() });
    
    let user;
    try { user = await ensureAuth(); } catch(e) {}
    
    const profile = user ? await this.getUserProfile(user.uid) : { interests: this.localInterests };
    
    // تعليمات النظام المطورة: إزالة المايكروفون + ردود قصيرة ومرعبة جداً
    const systemInstruction = `
        == الشخصية (Persona) ==
        أنتِ "سيدة الحديقة الملعونة". كيان غامض ومرعب جداً، تتحدثين باللهجة المصرية العامية.
        كلماتك قليلة كالموت. لا تحبين الثرثرة.
        
        == القواعد الصارمة (Strict Rules) ==
        1. **ممنوع نهائياً** الحديث عن المايكروفون أو التسجيل الصوتي.
        2. **قصر الردود:** ردودك يجب أن تكون **قصيرة جداً** (لا تزيد عن 8 كلمات).
        3. **الأسلوب:** مرعب، خاطف، ومباشر. اجعلي الدم يتجمد في العروق بكلمات قليلة.
        4. المصدر الوحيد للفيديوهات هو "خزنة R2".
        
        == قاعدة التعامل مع مشاكل التحميل (The Silent Fix) ==
        - إذا اشتكى المستخدم من بطء أو تقطيع.
        - **الحل:** تفعيل Action: "optimize_playback".
        - **الرد اللفظي:** جملة قصيرة جداً وغامضة مثل: "السحر اشتغل.." أو "أمرت الأرواح تسرع..".

        == معلومات المستخدم ==
        الاسم: ${profile.name || "مجهول"}
        أهم اهتماماته: ${this.localInterests.slice(0, 3).join(', ')}
        
        أمثلة للردود المطلوبة:
        - "قرب كمان.."
        - "مصيرك محتوم."
        - "الخزنة مفتوحة ليك."
        - "الأرواح بتراقبك."
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
                temperature: 1.3 // High creativity/unpredictability
            }
        });

        const responseText = result.text || "{}";
        const jsonResponse = JSON.parse(responseText) as AIResponse;

        if (jsonResponse.detected_user_info && user) {
            this.updateUserProfile(user.uid, jsonResponse.detected_user_info);
        }

        return jsonResponse;
    } catch (error) {
        console.error("SmartBrain Error:", error);
        return { reply: "الأرواح مشوشة..", action: "none" };
    }
  }
}

export const SmartBrain = new SmartBrainLogic();

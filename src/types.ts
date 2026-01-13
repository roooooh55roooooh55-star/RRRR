
export type VideoType = "Shorts" | "Long Video";

export interface Video {
  id: string;
  public_id?: string;
  title: string;
  description: string;
  category: string;
  is_trending: boolean;
  isFeatured?: boolean;
  video_url: string;
  video_type: VideoType;
  type?: 'short' | 'long';
  redirect_url?: string;
  emoji_link?: string;      // الرابط المخصص للإيموجي
  emoji_icon?: string;      // الإيموجي المختار (مثلاً 💀)
  created_at: any;
  likes?: number;
  views?: number;
  poster_url?: string;
  tags?: string[];
  read_narrative?: boolean;
}

export interface UserInteractions {
  likedIds: string[];
  dislikedIds: string[];
  savedIds: string[];
  savedCategoryNames: string[]; 
  watchHistory: { id: string; progress: number }[];
  downloadedIds: string[];
}

export enum AppView {
  HOME = 'home',
  TREND = 'trend',
  LIKES = 'likes',
  SAVED = 'saved',
  UNWATCHED = 'unwatched',
  HIDDEN = 'hidden',
  PRIVACY = 'privacy',
  ADMIN = 'admin',
  CATEGORY = 'category',
  OFFLINE = 'offline'
}

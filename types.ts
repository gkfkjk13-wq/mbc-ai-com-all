
export enum Language {
  KOREAN = 'kr',
  ENGLISH = 'en'
}

export enum Duration {
  SHORT = 'short',
  LONG = 'long'
}

export enum Tone {
  FRIENDLY = 'friendly',
  PROFESSIONAL = 'professional',
  HUMOROUS = 'humorous',
  EMOTIONAL = 'emotional'
}

export enum AgeGroup {
  TEENS = 'teens',
  TWENTIES = '20s',
  THIRTIES_PLUS = '30s+'
}

export interface Genre {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface GeneratedContent {
  id: string;
  genre: string;
  genreIcon: string;
  language: Language;
  duration: Duration;
  tone: Tone;
  ageGroup: AgeGroup;
  timestamp: string;
  favorite: boolean;
  script: string;
  titles: string[];
  imagePrompts: string[];
  ttsScript: string;
  // Visual specific fields
  visualStyle?: string;
  aspectRatio?: string;
  generatedImageUrl?: string; 
  generatedImages?: Record<number, string>; 
  generatedVideos?: Record<number, string>; // Maps scene index to video URL
  audioData?: string; 
}

export interface Message {
  text: string;
  type: 'success' | 'error' | 'info';
}

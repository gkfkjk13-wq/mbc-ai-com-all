
import { Genre } from './types';

export const GENRES: Genre[] = [
  { id: 'horror', name: '공포', icon: '👻', color: 'from-purple-600 to-pink-600' },
  { id: 'romance', name: '로맨스', icon: '💕', color: 'from-pink-500 to-red-500' },
  { id: 'comedy', name: '코미디', icon: '😂', color: 'from-yellow-500 to-orange-500' },
  { id: 'education', name: '교육', icon: '📚', color: 'from-blue-500 to-cyan-500' },
  { id: 'gaming', name: '게임', icon: '🎮', color: 'from-purple-500 to-indigo-600' },
  { id: 'cooking', name: '요리', icon: '🍳', color: 'from-orange-500 to-red-500' },
  { id: 'travel', name: '여행', icon: '✈️', color: 'from-cyan-500 to-blue-600' },
  { id: 'review', name: '리뷰', icon: '⭐', color: 'from-indigo-500 to-purple-600' },
  { id: 'asmr', name: 'ASMR', icon: '🎧', color: 'from-teal-500 to-green-500' },
  { id: 'vlog', name: 'Vlog', icon: '📹', color: 'from-pink-500 to-purple-500' },
  { id: 'tech', name: '기술', icon: '💻', color: 'from-gray-600 to-blue-600' },
  { id: 'fitness', name: '운동', icon: '💪', color: 'from-green-500 to-emerald-600' }
];

export const TONE_OPTIONS = [
  { value: 'friendly', label: '친근한' },
  { value: 'professional', label: '전문적인' },
  { value: 'humorous', label: '유머러스한' },
  { value: 'emotional', label: '감성적인' }
];

export const AGE_GROUP_OPTIONS = [
  { value: 'teens', label: '10대' },
  { value: '20s', label: '20대' },
  { value: '30s+', label: '30대 이상' }
];

export const ASPECT_RATIOS = [
  { label: '9:16 (쇼츠)', value: '9:16' },
  { label: '16:9 (와이드)', value: '16:9' },
  { label: '1:1 (정사각형)', value: '1:1' },
  { label: '4:3 (표준)', value: '4:3' },
  { label: '3:4 (포트레이트)', value: '3:4' }
];

export const IMAGE_STYLES = [
  "실사", "3D 애니메이션", "인상주의 (Impressionism)", "큐비즘 (Cubism)", 
  "리얼리즘 (Realism)", "초현실주의 (Surrealism)", "종이 (Paper)", 
  "표현주의 (Expressionism)", "미니멀리즘 (Minimalism)", 
  "풍경화와 자연화 (Landscape and Nature)", "픽셀 아트 (Pixel Art)", 
  "만화와 코믹스 (Cartoon and Comics)", "아르데코 (Art Deco)", 
  "기하학적 및 프랙탈 아트 (Geometric and Fractal Art)", "팝 아트 (Pop Art)", 
  "르네상스 (Renaissance)", "SF 및 판타지 (Sci-Fi and Fantasy)", "초상화 (Portrait)", 
  "플랫 디자인 (Flat Design)", "아이소메트릭 (Isometric)", "수채화 (Watercolor)", 
  "스케치 (Sketch)", "빈센트 반 고흐 스타일", "클로드 모네 스타일", 
  "파블로 피카소 스타일", "살바도르 달리 스타일", "프리다 칼로 스타일"
];

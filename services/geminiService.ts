
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Language, Duration, Tone, AgeGroup, GeneratedContent } from "../types";

// Helper to ensure we always use the latest process.env.API_KEY
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const recommendGenre = async (
  tone: Tone,
  ageGroup: AgeGroup,
  availableGenres: { id: string, name: string }[]
): Promise<{ genreId: string, reason: string }> => {
  const ai = getAI();
  const genreList = availableGenres.map(g => `${g.id} (${g.name})`).join(", ");
  
  const prompt = `Available Genres: [${genreList}]
  Tone: ${tone}
  Target: ${ageGroup}
  Recommend one genre from the list and explain why in 1 sentence.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: "당신은 유튜브 전략 전문가입니다. 반드시 모든 응답을 한국어로 작성하세요. JSON 형식을 엄격히 준수하세요.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          genreId: { type: Type.STRING },
          reason: { type: Type.STRING }
        },
        required: ["genreId", "reason"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("추천 장르 생성 실패");
  return JSON.parse(text);
};

export const generateContent = async (
  genreName: string,
  subject: string,
  language: Language,
  duration: Duration,
  tone: Tone,
  ageGroup: AgeGroup,
  scriptLength: number,
  visualStyle: string,
  imageCount: number
): Promise<Partial<GeneratedContent>> => {
  const ai = getAI();
  const durText = duration === Duration.LONG ? 'Long-form (10분 내외)' : 'Short-form (1분 미만)';
  
  const systemInstruction = `당신은 전문 유튜브 크리에이터 마스터입니다.
  반드시 지켜야 할 규칙:
  1. 모든 텍스트(대본, 제목, TTS용 대본)는 예외 없이 반드시 '한국어'로 작성하세요.
  2. 설정된 톤앤매너(${tone})와 타겟층(${ageGroup})을 완벽히 반영하세요.
  3. 시각적 스타일(${visualStyle})에 맞는 구체적인 이미지 생성 프롬프트를 영어로 작성하세요 (프롬프트만 영어).`;

  const prompt = `콘텐츠 기획 요청:
  - 장르: ${genreName}
  - 주제: ${subject || '최신 트렌드'}
  - 형식: ${durText}
  - 이미지 스타일: ${visualStyle}
  - 생성할 이미지 개수: ${imageCount}개

  결과물 구성:
  - 대본: 도입부, 전개, 결말이 포함된 전체 대본 (한국어)
  - 제목: 조회수를 유도하는 5개의 제목 (한국어)
  - 이미지 프롬프트: 각 장면을 묘사하는 ${imageCount}개의 상세 프롬프트 (영어)
  - TTS 대본: 구어체로 다듬어진 내레이션 원고 (한국어)`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          script: { type: Type.STRING, description: "전체 영상 대본 (한국어)" },
          titles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "5개의 추천 제목 (한국어)" },
          imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "장면별 이미지 생성 프롬프트 (영어)" },
          ttsScript: { type: Type.STRING, description: "내레이션용 대본 (한국어)" }
        },
        required: ["script", "titles", "imagePrompts", "ttsScript"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("콘텐츠 생성에 실패했습니다.");
  return JSON.parse(text);
};

export const generateImageFromPrompt = async (
  prompt: string, 
  aspectRatio: string = "16:9",
  base64Source?: string
): Promise<string> => {
  const ai = getAI();
  const parts: any[] = [];
  
  if (base64Source) {
    const data = base64Source.split(',')[1] || base64Source;
    parts.push({
      inlineData: {
        data: data,
        mimeType: 'image/png'
      }
    });
    parts.push({ text: `Modify this image to match the following description while keeping the same composition. Style: ${prompt}` });
  } else {
    parts.push({ text: `Cinematic YouTube masterpiece, highly detailed, 8k resolution: ${prompt}` });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("이미지 생성 실패");
};

export const generateVideo = async (
  imageB64: string, 
  prompt: string, 
  aspectRatio: string = "16:9",
  onStatusUpdate?: (status: string) => void
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const base64Data = imageB64.split(',')[1] || imageB64;
  
  onStatusUpdate?.("영상을 분석하고 렌더링을 준비합니다...");
  
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Motion animate this scene: ${prompt}`,
    image: {
      imageBytes: base64Data,
      mimeType: 'image/png'
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio as any
    }
  });

  while (!operation.done) {
    onStatusUpdate?.("VEO 엔진이 고화질 영상을 생성 중입니다 (약 30~60초)...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video link not found");
  
  onStatusUpdate?.("영상 데이터를 브라우저로 가져오는 중...");
  const fetchResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const videoBlob = await fetchResponse.blob();
  return URL.createObjectURL(videoBlob);
};

export const generateSpeech = async (text: string, language: Language): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this script naturally: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: language === Language.KOREAN ? 'Kore' : 'Zephyr' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Audio generation failed");
  return base64Audio;
};

export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

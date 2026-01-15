
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Language, Duration, Tone, AgeGroup, GeneratedContent } from "../types";

// Standard AI helper to obtain a new client instance
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const recommendGenre = async (
  tone: Tone,
  ageGroup: AgeGroup,
  availableGenres: { id: string, name: string }[]
): Promise<{ genreId: string, reason: string }> => {
  const ai = getAI();
  const genreList = availableGenres.map(g => `${g.id} (${g.name})`).join(", ");
  
  const prompt = `Based on a YouTube video with:
  - Tone: ${tone}
  - Target Audience: ${ageGroup}
  
  From this list of genres: [${genreList}], recommend the single best one that would likely go viral.
  Return only JSON with "genreId" and "reason" in Korean.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: "You are a specialized YouTube strategy consultant. Always respond in Korean.",
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
  if (!text) throw new Error("Recommendation failed");
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
  const langText = language === Language.KOREAN ? '한국어' : 'English';
  const durText = duration === Duration.LONG ? 'Long-form (10+ min)' : 'Short-form (under 1 min)';
  
  // Stronger instruction to prevent English output
  const systemInstruction = `You are a professional YouTube content master. 
  CRITICAL: Every single field in your response (script, titles, ttsScript) MUST be written in ${langText}. 
  Do not use any other language under any circumstances.`;

  const prompt = `Generate viral content for:
  - Genre: ${genreName}
  - Subject: ${subject || 'Trending content'}
  - Language: ${langText}
  - Format: ${durText}
  - Tone: ${tone}
  - Target Audience: ${ageGroup}
  - Script Verbosity: ${scriptLength}%
  - Visual Style: ${visualStyle}

  Include:
  1. A full script in ${langText}.
  2. 5 high-quality titles in ${langText}.
  3. Exactly ${imageCount} image prompts following the "${visualStyle}" style.
  4. A natural TTS version of the script in ${langText}.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          script: { type: Type.STRING },
          titles: { type: Type.ARRAY, items: { type: Type.STRING } },
          imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
          ttsScript: { type: Type.STRING }
        },
        required: ["script", "titles", "imagePrompts", "ttsScript"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text);
};

export const generateImageFromPrompt = async (prompt: string, aspectRatio: string = "16:9"): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `High quality cinematic YouTube visual, detailed, professional: ${prompt}` }]
    },
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
  throw new Error("Failed to generate image");
};

export const generateVideo = async (
  imageB64: string, 
  prompt: string, 
  aspectRatio: string = "16:9",
  onStatusUpdate?: (status: string) => void
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const base64Data = imageB64.split(',')[1] || imageB64;
  
  onStatusUpdate?.("영상 데이터 전송 중...");
  
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Animate this scene realistically: ${prompt}`,
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
    onStatusUpdate?.("AI가 영상을 렌더링하고 있습니다 (30~60초 소요)...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed");
  
  onStatusUpdate?.("영상 파일을 로드하고 있습니다...");
  const fetchResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!fetchResponse.ok) throw new Error("Failed to download video file");
  const videoBlob = await fetchResponse.blob();
  return URL.createObjectURL(videoBlob);
};

export const generateSpeech = async (text: string, language: Language): Promise<string> => {
  const ai = getAI();
  const langName = language === Language.KOREAN ? 'Korean' : 'English';
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this script naturally in ${langName}: ${text}` }] }],
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
  if (!base64Audio) throw new Error("Failed to generate audio");
  return base64Audio;
};

export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
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

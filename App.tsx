
import React, { useState, useEffect, useRef } from 'react';
import { 
  Film, Sparkles, Clock, Zap, FileText, Target, Image as ImageIcon, 
  Mic, Copy, Download, Play, Menu, X, CheckCircle, AlertCircle,
  ChevronRight, Wand2, Layers, RefreshCw, Loader2, Type, Video, 
  ExternalLink, Key, ShieldCheck, Lock, Server, AlertTriangle, Info, Upload,
  Trash2, ImagePlus, FileArchive, FileVideo, PlayCircle
} from 'lucide-react';
import JSZip from 'jszip';
import { GENRES, ASPECT_RATIOS, IMAGE_STYLES } from './constants';
import { 
  Language, Duration, Tone, AgeGroup, GeneratedContent, Message 
} from './types';
import * as gemini from './services/geminiService';

export default function App() {
  // Config States
  const [subject, setSubject] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [isGenreModalOpen, setIsGenreModalOpen] = useState(false);
  const [language] = useState<Language>(Language.KOREAN);
  const [duration, setDuration] = useState<Duration>(Duration.LONG);
  const [tone, setTone] = useState<Tone>(Tone.FRIENDLY);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(AgeGroup.TWENTIES);
  const [scriptLength, setScriptLength] = useState(70);

  // Visual States
  const [selectedRatio, setSelectedRatio] = useState('16:9');
  const [selectedStyle, setSelectedStyle] = useState('실사');
  const [customStyle, setCustomStyle] = useState('');
  const [globalReferenceImage, setGlobalReferenceImage] = useState<string | null>(null);

  // App Core States
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('script');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [history, setHistory] = useState<GeneratedContent[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [isAiStudio, setIsAiStudio] = useState(false);
  
  // Progress States
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isDownloadingVideos, setIsDownloadingVideos] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [userUploadedImages, setUserUploadedImages] = useState<Record<number, boolean>>({});
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<number | null>(null);
  const [videoStatus, setVideoStatus] = useState('');
  const [generatedVideos, setGeneratedVideos] = useState<Record<number, string>>({});
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const globalFileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadIndex, setCurrentUploadIndex] = useState<number | null>(null);

  // Detect Environment and Key Availability
  useEffect(() => {
    const checkKey = async () => {
      const aiStudioAvailable = !!(window as any).aistudio;
      setIsAiStudio(aiStudioAvailable);

      if (aiStudioAvailable) {
        try {
          const selected = await (window as any).aistudio.hasSelectedApiKey();
          setHasKey(selected);
        } catch (e) {
          setHasKey(false);
        }
      } else {
        const envKey = process.env.API_KEY;
        setHasKey(!!envKey && envKey.length > 10);
      }
    };

    checkKey();
    const timer = setInterval(checkKey, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleKeyInteraction = () => {
    if (isAiStudio) {
      (window as any).aistudio.openSelectKey();
    } else {
      showMsg('Vercel 대시보드에서 API_KEY 환경 변수를 설정해야 합니다.', 'info');
    }
  };

  const showMsg = (text: string, type: Message['type']) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleGenerate = async () => {
    if (!selectedGenre) {
      showMsg('장르를 먼저 선택해 주세요!', 'error');
      setIsGenreModalOpen(true);
      return;
    }
    if (!hasKey) {
      showMsg('API 키가 설정되지 않았습니다.', 'error');
      return;
    }

    setLoading(true);
    setGeneratedImages({});
    setUserUploadedImages({});
    setGeneratedVideos({});
    try {
      const genre = GENRES.find(g => g.id === selectedGenre)!;
      const finalImageCount = Math.max(2, Math.floor((scriptLength / 100) * 8));
      const finalStyle = customStyle || selectedStyle;

      const content = await gemini.generateContent(
        genre.name, subject, language, duration, tone, ageGroup, scriptLength, finalStyle, finalImageCount
      );

      const newContent: GeneratedContent = {
        id: Date.now().toString(),
        genre: genre.name,
        genreIcon: genre.icon,
        language,
        duration,
        tone,
        ageGroup,
        timestamp: new Date().toLocaleString(),
        favorite: false,
        script: content.script || '',
        titles: content.titles || [],
        imagePrompts: content.imagePrompts || [],
        ttsScript: content.ttsScript || '',
        visualStyle: finalStyle,
        aspectRatio: selectedRatio
      };

      setGeneratedContent(newContent);
      setHistory(prev => [newContent, ...prev]);
      showMsg('기획안 생성 완료!', 'success');
      setActiveTab('script');
    } catch (error) {
      console.error(error);
      showMsg('생성 오류 발생.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImageGen = async (prompt: string, index: number) => {
    if (!generatedContent || isGeneratingImage) return;
    setIsGeneratingImage(true);
    try {
      const sourceImage = userUploadedImages[index] ? generatedImages[index] : (globalReferenceImage || undefined);
      const imageUrl = await gemini.generateImageFromPrompt(prompt, generatedContent.aspectRatio || selectedRatio, sourceImage);
      
      setGeneratedImages(prev => ({ ...prev, [index]: imageUrl }));
      if (userUploadedImages[index]) {
        setUserUploadedImages(prev => ({ ...prev, [index]: false }));
      }
      showMsg('이미지가 성공적으로 생성되었습니다.', 'success');
    } catch (error) {
      showMsg('이미지 생성 실패', 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGlobalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGlobalReferenceImage(reader.result as string);
        showMsg('글로벌 참조 이미지가 설정되었습니다.', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUploadIndex !== null) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setGeneratedImages(prev => ({ ...prev, [currentUploadIndex]: base64String }));
        setUserUploadedImages(prev => ({ ...prev, [currentUploadIndex]: true }));
        showMsg(`Scene ${currentUploadIndex + 1}에 이미지가 업로드되었습니다.`, 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerUpload = (index: number) => {
    setCurrentUploadIndex(index);
    fileInputRef.current?.click();
  };

  const handleVideoGen = async (index: number) => {
    if (!generatedContent || isGeneratingVideo !== null) return;
    const imageB64 = generatedImages[index];
    if (!imageB64) {
      showMsg('먼저 이미지를 업로드하거나 생성해야 합니다.', 'info');
      return;
    }

    try {
      setIsGeneratingVideo(index);
      const videoUrl = await gemini.generateVideo(
        imageB64, 
        generatedContent.imagePrompts[index], 
        generatedContent.aspectRatio || selectedRatio,
        setVideoStatus
      );
      setGeneratedVideos(prev => ({ ...prev, [index]: videoUrl }));
      showMsg('VEO 영상 생성 완료! 🎬', 'success');
    } catch (error) {
      showMsg('영상 생성 실패.', 'error');
    } finally {
      setIsGeneratingVideo(null);
      setVideoStatus('');
    }
  };

  const handleBatchImageGen = async () => {
    if (!generatedContent || isGeneratingBatch || isGeneratingImage) return;
    setIsGeneratingBatch(true);
    setBatchProgress(0);
    const prompts = generatedContent.imagePrompts;
    try {
      for (let i = 0; i < prompts.length; i++) {
        if (!generatedImages[i]) {
          const sourceImage = globalReferenceImage || undefined;
          const url = await gemini.generateImageFromPrompt(prompts[i], generatedContent.aspectRatio || selectedRatio, sourceImage);
          setGeneratedImages(prev => ({ ...prev, [i]: url }));
        }
        setBatchProgress(Math.round(((i + 1) / prompts.length) * 100));
      }
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  const handleDownloadAllImages = async () => {
    const imageIndices = Object.keys(generatedImages);
    if (imageIndices.length === 0) {
      showMsg('다운로드할 이미지가 없습니다.', 'info');
      return;
    }

    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("images");
      if (!folder) throw new Error("Folder creation failed");

      imageIndices.forEach((key) => {
        const index = parseInt(key);
        const dataUrl = generatedImages[index];
        const base64Data = dataUrl.split(',')[1];
        folder.file(`scene_${index + 1}.png`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: "blob" });
      saveBlob(content, `images_${Date.now()}.zip`);
      showMsg('이미지 압축 및 다운로드 완료! 📂', 'success');
    } catch (error) {
      showMsg('이미지 다운로드 중 오류 발생', 'error');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleDownloadAllVideos = async () => {
    const videoIndices = Object.keys(generatedVideos);
    if (videoIndices.length === 0) {
      showMsg('다운로드할 영상이 없습니다.', 'info');
      return;
    }

    setIsDownloadingVideos(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("videos");
      if (!folder) throw new Error("Folder creation failed");

      for (const key of videoIndices) {
        const index = parseInt(key);
        const videoUrl = generatedVideos[index];
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        folder.file(`scene_${index + 1}.mp4`, blob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveBlob(content, `videos_${Date.now()}.zip`);
      showMsg('영상 압축 및 다운로드 완료! 🎬', 'success');
    } catch (error) {
      showMsg('영상 다운로드 중 오류 발생', 'error');
    } finally {
      setIsDownloadingVideos(false);
    }
  };

  const handleIndividualVideoDownload = async (index: number) => {
    const videoUrl = generatedVideos[index];
    if (!videoUrl) return;
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `scene_${index + 1}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAudioGen = async () => {
    if (!generatedContent || isGeneratingAudio) return;
    setIsGeneratingAudio(true);
    try {
      const audioData = await gemini.generateSpeech(generatedContent.ttsScript, language);
      setGeneratedContent(prev => prev ? ({ ...prev, audioData }) : null);
      showMsg('AI 보이스 생성 완료!', 'success');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const playAudio = async () => {
    if (!generatedContent?.audioData) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const buffer = await gemini.decodeAudioData(gemini.decode(generatedContent.audioData), ctx, 24000, 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showMsg('복사되었습니다! 📋', 'success');
  };

  const selectedGenreData = GENRES.find(g => g.id === selectedGenre);
  const generatedImageCount = Object.keys(generatedImages).length;
  const generatedVideoCount = Object.keys(generatedVideos).length;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 pb-12">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
      <input type="file" ref={globalFileInputRef} onChange={handleGlobalImageUpload} className="hidden" accept="image/*" />

      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-[#0a0f1e]/90 backdrop-blur-xl border-b border-[#1e293b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20 shrink-0">
                  <Film className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-white to-indigo-400 bg-clip-text text-transparent truncate">
                  AI 유튜브 마스터
                </h1>
              </div>

              {/* API Key Status Indicator */}
              <div className="hidden lg:flex items-center gap-4">
                <div className="h-8 w-[1px] bg-[#1e293b]"></div>
                <div 
                  onClick={handleKeyInteraction}
                  className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all cursor-pointer ${
                    hasKey ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}
                >
                  {isAiStudio ? <Key className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-wider opacity-60">
                      {isAiStudio ? 'AI Studio Mode' : 'Vercel Deployment'}
                    </span>
                    <span className="text-xs font-bold truncate max-w-[150px]">
                      {hasKey ? 'API 연결됨' : '연결 필요'}
                    </span>
                  </div>
                  {hasKey ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-slate-400 hover:text-white transition-all flex items-center gap-2"
            >
              <Clock className="w-5 h-5" />
              <span className="text-sm font-bold hidden sm:inline">작업 내역</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {message && (
          <div className={`fixed top-24 right-8 z-50 p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-right ${
            message.type === 'success' ? 'bg-[#064e3b] border-emerald-500 text-emerald-100' : 
            message.type === 'error' ? 'bg-[#451a1a] border-rose-500 text-rose-100' : 
            'bg-[#1e293b] border-sky-500 text-sky-100'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
            <span className="font-medium text-sm">{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-[#151c2e] rounded-3xl border border-[#1e293b] p-6 shadow-xl space-y-4">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Type className="w-4 h-4 text-indigo-400" /> 프로젝트 주제
              </h2>
              <input 
                type="text"
                placeholder="한국어 대본이 생성됩니다..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-[#0a0f1e] border border-[#1e293b] rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white"
              />
              <button onClick={() => setIsGenreModalOpen(true)} className="w-full flex items-center justify-between p-4 bg-[#1e293b] rounded-2xl text-sm font-bold border border-[#334155] hover:bg-[#2d3748] transition-all">
                <div className="flex items-center gap-3">
                  {selectedGenreData ? <span>{selectedGenreData.icon} {selectedGenreData.name}</span> : <span className="text-slate-500">장르 선택</span>}
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            </section>

            <section className="bg-[#151c2e] rounded-3xl border border-[#1e293b] p-6 shadow-xl space-y-6">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" /> 스타일 및 레이아웃
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">이미지 스타일</label>
                  <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)} className="w-full bg-[#0a0f1e] border border-[#1e293b] rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    {IMAGE_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">화면 비율</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ASPECT_RATIOS.map(r => (
                      <button key={r.value} onClick={() => setSelectedRatio(r.value)} className={`py-3 rounded-xl text-[10px] font-black border transition-all ${selectedRatio === r.value ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-[#0a0f1e] border-[#1e293b] text-slate-500'}`}>{r.label}</button>
                    ))}
                  </div>
                </div>

                {/* Global Reference Image Upload */}
                <div className="space-y-2 pt-2 border-t border-[#1e293b]">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">참조 이미지 (선택 사항)</label>
                  {!globalReferenceImage ? (
                    <button 
                      onClick={() => globalFileInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center p-6 bg-[#0a0f1e] border border-dashed border-[#334155] rounded-2xl hover:border-indigo-500 hover:bg-indigo-500/5 transition-all group"
                    >
                      <ImagePlus className="w-8 h-8 text-slate-600 group-hover:text-indigo-400 mb-2" />
                      <span className="text-[11px] font-bold text-slate-500">이미지 업로드</span>
                    </button>
                  ) : (
                    <div className="relative group">
                      <img src={globalReferenceImage} className="w-full h-32 object-cover rounded-2xl border border-indigo-500/30" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-2xl">
                        <button onClick={() => globalFileInputRef.current?.click()} className="p-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-500 transition-colors">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button onClick={() => setGlobalReferenceImage(null)} className="p-2 bg-rose-600 rounded-lg text-white hover:bg-rose-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600 text-[8px] font-black text-white rounded uppercase">Global Ref</div>
                    </div>
                  )}
                  <p className="text-[9px] text-slate-600 leading-tight px-1">업로드한 이미지는 모든 장면의 비주얼 스타일 생성 시 참조됩니다.</p>
                </div>
              </div>
            </section>

            <button 
              onClick={handleGenerate} 
              disabled={loading || !hasKey} 
              className="group w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black flex items-center justify-center gap-3 shadow-2xl disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6 fill-current" />}
              {loading ? 'AI 기획안 생성 중...' : '마스터 프로젝트 시작'}
            </button>
          </div>

          {/* Main Area */}
          <div className="lg:col-span-8">
            {!generatedContent && !loading && (
              <div className="h-[600px] border-2 border-dashed border-[#1e293b] rounded-[3rem] flex flex-col items-center justify-center text-slate-600 text-center p-8 bg-[#151c2e]/20">
                <div className="p-8 bg-[#151c2e] rounded-full mb-6 border border-[#1e293b] shadow-2xl">
                  <Sparkles className="w-16 h-16 text-indigo-500/20" />
                </div>
                <h3 className="text-xl font-black text-slate-400 mb-2">한국어 기획안 생성을 대기 중입니다</h3>
                <p className="text-sm font-medium">장르와 주제를 설정하고 시작 버튼을 눌러주세요.</p>
              </div>
            )}

            {loading && !generatedContent && (
              <div className="h-[600px] flex flex-col items-center justify-center space-y-6">
                <div className="w-20 h-20 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-white font-black text-2xl">기획안 구성 중...</p>
              </div>
            )}

            {generatedContent && (
              <div className="bg-[#151c2e] rounded-[3rem] border border-[#1e293b] overflow-hidden shadow-2xl animate-in fade-in duration-500">
                <div className="p-8 border-b border-[#1e293b] flex items-center justify-between bg-indigo-900/5">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-[#0a0f1e] rounded-2xl flex items-center justify-center text-4xl shadow-inner border border-[#1e293b]">{generatedContent.genreIcon}</div>
                    <div>
                      <h3 className="font-black text-xl text-white truncate max-w-[300px]">{subject || generatedContent.genre}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[9px] font-black uppercase tracking-widest">{generatedContent.visualStyle}</span>
                        <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">{generatedContent.aspectRatio}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyToClipboard(generatedContent.script)} className="p-4 bg-[#0a0f1e] rounded-2xl hover:bg-slate-800 transition-all border border-[#1e293b] group" title="대본 복사">
                      <Copy className="w-6 h-6 text-slate-400 group-hover:text-white" />
                    </button>
                  </div>
                </div>

                <div className="flex border-b border-[#1e293b] overflow-x-auto bg-[#0a0f1e]/20 px-4">
                  {[
                    { id: 'script', label: '한국어 대본', icon: FileText },
                    { id: 'images', label: '스토리보드', icon: Layers },
                    { id: 'tts', label: '음성 합성', icon: Mic },
                    { id: 'titles', label: '바이럴 제목', icon: Target }
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-8 py-5 text-xs font-black transition-all border-b-2 uppercase tracking-[0.2em] whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500'}`}>
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-8 min-h-[500px]">
                  {activeTab === 'script' && (
                    <div className="bg-[#0a0f1e] p-8 rounded-[2rem] text-slate-300 leading-loose text-base whitespace-pre-wrap border border-[#1e293b] shadow-inner">
                      {generatedContent.script}
                    </div>
                  )}

                  {activeTab === 'images' && (
                    <div className="space-y-8">
                      {/* Batch Controls Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Image Batch Control */}
                        <div className="flex flex-col bg-[#0a0f1e] p-6 rounded-[2.5rem] border border-[#1e293b] shadow-xl">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-indigo-600/10 rounded-2xl">
                              <Layers className="w-6 h-6 text-indigo-500" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-white">이미지 마스터링</h4>
                              <p className="text-[10px] text-slate-500">일괄 생성 및 ZIP 다운로드</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <button 
                              onClick={handleBatchImageGen} 
                              disabled={isGeneratingBatch} 
                              className="flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-black transition-all disabled:opacity-50"
                            >
                              {isGeneratingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                              전체 생성 {isGeneratingBatch && `(${batchProgress}%)`}
                            </button>
                            <button 
                              onClick={handleDownloadAllImages} 
                              disabled={isDownloadingAll || generatedImageCount === 0} 
                              className="flex items-center justify-center gap-2 py-3 bg-[#1e293b] hover:bg-slate-800 text-slate-300 rounded-xl text-[11px] font-black border border-[#334155] transition-all disabled:opacity-30"
                            >
                              {isDownloadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4 text-emerald-500" />}
                              ZIP 다운로드
                            </button>
                          </div>
                        </div>

                        {/* Video Batch Control */}
                        <div className="flex flex-col bg-[#0a0f1e] p-6 rounded-[2.5rem] border border-[#1e293b] shadow-xl">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-rose-600/10 rounded-2xl">
                              <FileVideo className="w-6 h-6 text-rose-500" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-white">비디오 마스터링</h4>
                              <p className="text-[10px] text-slate-500">모든 장면 일괄 처리 및 저장</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            <button 
                              onClick={handleDownloadAllVideos} 
                              disabled={isDownloadingVideos || generatedVideoCount === 0} 
                              className="flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[11px] font-black shadow-lg shadow-rose-900/20 transition-all disabled:opacity-30"
                            >
                              {isDownloadingVideos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                              전체 비디오 ZIP 다운로드 ({generatedVideoCount})
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Storyboard Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {generatedContent.imagePrompts.map((p, i) => (
                          <div key={i} className="bg-[#0a0f1e] rounded-[1.5rem] overflow-hidden border border-[#1e293b] group/card">
                            <div className="relative aspect-video bg-slate-900 flex items-center justify-center group/img">
                              {generatedVideos[i] ? (
                                <video src={generatedVideos[i]} controls autoPlay muted playsInline className="w-full h-full object-cover" />
                              ) : generatedImages[i] ? (
                                <img src={generatedImages[i]} className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex flex-col items-center gap-4 opacity-40">
                                  <ImageIcon className="w-12 h-12 text-slate-800" />
                                  <p className="text-[10px] font-bold text-slate-500">이미지를 업로드하거나 생성하세요</p>
                                </div>
                              )}
                              
                              {/* Overlay for actions */}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 z-30">
                                <button onClick={() => triggerUpload(i)} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white border border-white/20 transition-all flex flex-col items-center gap-1" title="사진 업로드">
                                  <Upload className="w-4 h-4" />
                                  <span className="text-[8px] font-black uppercase">Upload</span>
                                </button>
                                {generatedImages[i] && !generatedVideos[i] && (
                                   <button onClick={() => handleVideoGen(i)} className="p-3 bg-rose-600 hover:bg-rose-500 rounded-xl text-white border border-rose-400 transition-all flex flex-col items-center gap-1" title="비디오 생성">
                                    <Video className="w-4 h-4" />
                                    <span className="text-[8px] font-black uppercase">Video</span>
                                  </button>
                                )}
                                {generatedVideos[i] && (
                                  <button onClick={() => handleIndividualVideoDownload(i)} className="p-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white border border-emerald-400 transition-all flex flex-col items-center gap-1" title="비디오 다운로드">
                                    <Download className="w-4 h-4" />
                                    <span className="text-[8px] font-black uppercase">Download</span>
                                  </button>
                                )}
                                <button onClick={() => handleImageGen(p, i)} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white border border-white/20 transition-all flex flex-col items-center gap-1" title="이미지 다시 생성">
                                  <RefreshCw className="w-4 h-4" />
                                  <span className="text-[8px] font-black uppercase">{userUploadedImages[i] ? 'AI Edit' : 'AI Gen'}</span>
                                </button>
                              </div>

                              {(userUploadedImages[i] || (!generatedImages[i] && globalReferenceImage)) && (
                                <div className="absolute top-3 left-3 px-2 py-1 bg-amber-500/80 backdrop-blur-sm rounded text-[8px] font-black text-white uppercase tracking-widest z-20">
                                  {userUploadedImages[i] ? 'Scene Specific' : 'Global Ref Ready'}
                                </div>
                              )}

                              {isGeneratingVideo === i && (
                                <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-40">
                                  <div className="w-8 h-8 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mb-4" />
                                  <p className="text-[10px] text-white font-black uppercase tracking-widest">{videoStatus}</p>
                                </div>
                              )}
                            </div>
                            <div className="p-4 bg-slate-900/50 flex items-start justify-between gap-4">
                              <p className="text-[10px] text-slate-500 italic line-clamp-2">"{p}"</p>
                              <div className="flex flex-col items-end shrink-0">
                                <span className="text-[10px] font-black text-slate-700">SCENE {i + 1}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'tts' && (
                    <div className="flex flex-col items-center justify-center h-[400px] space-y-8 bg-[#0a0f1e]/50 rounded-[3rem] border border-[#1e293b]">
                      <Mic className="w-16 h-16 text-indigo-500" />
                      {!generatedContent.audioData ? (
                        <button onClick={handleAudioGen} disabled={isGeneratingAudio} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center gap-3 shadow-2xl">
                          {isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current" />}
                          AI 음성 마스터링 시작
                        </button>
                      ) : (
                        <button onClick={playAudio} className="px-12 py-5 bg-white text-indigo-950 rounded-2xl font-black flex items-center gap-4 hover:scale-105 transition-all shadow-2xl">
                          <Play className="w-8 h-8 fill-current" /> 재생하기
                        </button>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'titles' && (
                    <div className="space-y-4">
                      {generatedContent.titles.map((t, i) => (
                        <div key={i} onClick={() => copyToClipboard(t)} className="flex items-center justify-between p-6 bg-[#0a0f1e] border border-[#1e293b] rounded-[1.5rem] hover:border-indigo-500 transition-all cursor-pointer group">
                          <span className="text-base font-bold text-slate-200">
                            <span className="text-indigo-500 font-black mr-4 text-xl">{i+1}</span>
                            {t}
                          </span>
                          <Copy className="w-5 h-5 text-slate-700 group-hover:text-indigo-400" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Genre Modal */}
      {isGenreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#151c2e] rounded-[3rem] w-full max-w-3xl border border-[#1e293b] overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-[#1e293b] flex items-center justify-between bg-indigo-900/10">
              <h3 className="font-black text-xl text-white">콘텐츠 장르 라이브러리</h3>
              <button onClick={() => setIsGenreModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full"><X className="w-8 h-8 text-slate-500" /></button>
            </div>
            <div className="p-8 grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto">
              {GENRES.map((g) => (
                <button 
                  key={g.id} 
                  onClick={() => { setSelectedGenre(g.id); setIsGenreModalOpen(false); }}
                  className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all ${
                    selectedGenre === g.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-transparent bg-[#0a0f1e] hover:bg-[#1e293b]'
                  }`}
                >
                  <span className="text-4xl">{g.icon}</span>
                  <span className="font-black text-xs">{g.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

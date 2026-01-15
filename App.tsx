
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Film, Sparkles, Globe, Clock, Zap, FileText, Target, Image as ImageIcon, 
  Mic, Copy, Download, Star, Trash2, Play, Settings, Menu, X, CheckCircle, AlertCircle,
  ChevronRight, Wand2, Search, Layers, RefreshCw, Loader2, Type, Maximize2, Video, 
  ExternalLink, CreditCard, Key, ShieldCheck, Lock, Terminal, Info, Server, AlertTriangle
} from 'lucide-react';
import { GENRES, TONE_OPTIONS, AGE_GROUP_OPTIONS, ASPECT_RATIOS, IMAGE_STYLES } from './constants';
import { 
  Language, Duration, Tone, AgeGroup, GeneratedContent, Message 
} from './types';
import * as gemini from './services/geminiService';

export default function App() {
  // Basic Config
  const [subject, setSubject] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [isGenreModalOpen, setIsGenreModalOpen] = useState(false);
  const [language, setLanguage] = useState<Language>(Language.KOREAN);
  const [duration, setDuration] = useState<Duration>(Duration.LONG);
  const [tone, setTone] = useState<Tone>(Tone.FRIENDLY);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(AgeGroup.TWENTIES);
  const [scriptLength, setScriptLength] = useState(70);

  // Visual/Storyboard Config
  const [isAutoImageCount, setIsAutoImageCount] = useState(true);
  const [manualImageCount, setManualImageCount] = useState(5);
  const [selectedRatio, setSelectedRatio] = useState('16:9');
  const [selectedStyle, setSelectedStyle] = useState('실사');
  const [customStyle, setCustomStyle] = useState('');

  // App States
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('script');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [history, setHistory] = useState<GeneratedContent[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [isAiStudio, setIsAiStudio] = useState(false);
  
  // Image/Video Generation States
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<number | null>(null);
  const [videoStatus, setVideoStatus] = useState('');
  const [generatedVideos, setGeneratedVideos] = useState<Record<number, string>>({});
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  // Sync key status and detect environment
  useEffect(() => {
    const checkKey = async () => {
      const aiStudioAvailable = !!(window as any).aistudio;
      setIsAiStudio(aiStudioAvailable);

      if (aiStudioAvailable) {
        try {
          const selected = await (window as any).aistudio.hasSelectedApiKey();
          setHasKey(selected);
        } catch (e) {
          console.error("AI Studio Key check failed", e);
        }
      } else {
        // External environment (Vercel)
        const envKey = process.env.API_KEY;
        setHasKey(!!envKey && envKey.length > 5);
      }
    };

    checkKey();
    const timer = setInterval(checkKey, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleKeyClick = () => {
    if (isAiStudio) {
      (window as any).aistudio.openSelectKey();
    } else {
      showMsg('Vercel 대시보드 환경변수에서 API_KEY를 설정해야 합니다.', 'info');
    }
  };

  const showMsg = (text: string, type: Message['type']) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleGenerate = async () => {
    if (!selectedGenre) {
      showMsg('먼저 장르를 선택해 주세요!', 'error');
      setIsGenreModalOpen(true);
      return;
    }

    setLoading(true);
    setGeneratedImages({});
    setGeneratedVideos({});
    try {
      const genre = GENRES.find(g => g.id === selectedGenre)!;
      const finalImageCount = isAutoImageCount 
        ? Math.max(2, Math.floor((scriptLength / 100) * 8)) 
        : manualImageCount;
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
      showMsg('콘텐츠 생성 완료! ✨', 'success');
      setActiveTab('script');
    } catch (error) {
      console.error(error);
      showMsg('생성 중 오류 발생. API 키 설정을 확인하세요.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImageGen = async (prompt: string, index: number) => {
    if (!generatedContent || isGeneratingImage) return;
    setIsGeneratingImage(true);
    try {
      const imageUrl = await gemini.generateImageFromPrompt(prompt, generatedContent.aspectRatio || selectedRatio);
      const updatedImages = { ...generatedImages, [index]: imageUrl };
      setGeneratedImages(updatedImages);
      setGeneratedContent(prev => prev ? ({ ...prev, generatedImages: updatedImages }) : null);
    } catch (error) {
      showMsg('이미지 생성 실패', 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleVideoGen = async (index: number) => {
    if (!generatedContent || isGeneratingVideo !== null) return;
    const imageB64 = generatedImages[index];
    if (!imageB64) {
      showMsg('이미지가 필요합니다.', 'error');
      return;
    }

    try {
      if (isAiStudio) {
        const hasSelected = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasSelected) {
          await (window as any).aistudio.openSelectKey();
          return;
        }
      } else if (!hasKey) {
        showMsg('Vercel 대시보드에서 API_KEY 환경변수를 설정해야 합니다.', 'error');
        return;
      }

      setIsGeneratingVideo(index);
      setVideoStatus('동영상 생성 요청 중...');
      const videoUrl = await gemini.generateVideo(
        imageB64, 
        generatedContent.imagePrompts[index], 
        generatedContent.aspectRatio || selectedRatio,
        setVideoStatus
      );
      
      const updatedVideos = { ...generatedVideos, [index]: videoUrl };
      setGeneratedVideos(updatedVideos);
      setGeneratedContent(prev => prev ? ({ ...prev, generatedVideos: updatedVideos }) : null);
      showMsg('동영상이 생성되었습니다! 🎬', 'success');
    } catch (error: any) {
      showMsg('동영상 생성 실패. API 프로젝트 권한을 확인하세요.', 'error');
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
    const results: Record<number, string> = { ...generatedImages };
    try {
      for (let i = 0; i < prompts.length; i++) {
        if (!results[i]) {
          results[i] = await gemini.generateImageFromPrompt(prompts[i], generatedContent.aspectRatio || selectedRatio);
          setGeneratedImages({ ...results });
        }
        setBatchProgress(Math.round(((i + 1) / prompts.length) * 100));
      }
      setGeneratedContent(prev => prev ? ({ ...prev, generatedImages: results }) : null);
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  const handleAudioGen = async () => {
    if (!generatedContent || isGeneratingAudio) return;
    setIsGeneratingAudio(true);
    try {
      const audioData = await gemini.generateSpeech(generatedContent.ttsScript, language);
      setGeneratedContent(prev => prev ? ({ ...prev, audioData }) : null);
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

  const downloadText = () => {
    if (!generatedContent) return;
    const blob = new Blob([JSON.stringify(generatedContent, null, 2)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `project_${generatedContent.id}.txt`;
    a.click();
  };

  const selectedGenreData = GENRES.find(g => g.id === selectedGenre);

  useEffect(() => {
    if (generatedContent) {
      setGeneratedImages(generatedContent.generatedImages || {});
      setGeneratedVideos(generatedContent.generatedVideos || {});
    }
  }, [generatedContent?.id]);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 pb-12">
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

              {/* Key UI - Adjusted for Vercel Detection */}
              <div className="hidden lg:flex items-center gap-4">
                <div className="h-8 w-[1px] bg-[#1e293b]"></div>
                <div className="flex flex-col">
                  <div 
                    onClick={handleKeyClick}
                    className={`relative flex items-center bg-[#0d1117] border rounded-xl px-4 py-3 cursor-pointer transition-all hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/10 min-w-[420px] shadow-inner ${
                      hasKey ? 'border-emerald-500/40' : 'border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                      {isAiStudio ? (
                        <Key className={`w-4 h-4 shrink-0 ${hasKey ? 'text-emerald-400' : 'text-slate-500'}`} />
                      ) : (
                        <Server className={`w-4 h-4 shrink-0 ${hasKey ? 'text-emerald-400' : 'text-slate-500'}`} />
                      )}
                      <div className="flex flex-col truncate">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-0.5">
                          {isAiStudio ? 'AI Studio Mode' : 'Vercel Deployment'}
                        </span>
                        <div className="font-mono text-sm truncate">
                          {hasKey ? (
                            <span className="text-emerald-400">••••••••••••••••••••••••••••••••</span>
                          ) : (
                            <span className="text-slate-500 italic">
                              {isAiStudio ? 'API 키를 연동하세요...' : 'Dashboard에서 API_KEY를 추가하세요'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className={`ml-4 px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 ${
                      hasKey ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {hasKey ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      <span className="text-[11px] font-black uppercase">{hasKey ? 'Active' : 'Setup'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all flex items-center gap-2"
              >
                <Clock className="w-5 h-5" />
                <span className="text-sm font-bold hidden sm:inline">작업 내역</span>
              </button>
            </div>
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

        {/* Improved Guidance for Vercel Users */}
        {!hasKey && !isAiStudio && (
          <div className="mb-8 p-8 bg-amber-500/10 border border-amber-500/20 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 shadow-2xl">
            <div className="p-5 bg-amber-500 rounded-[1.5rem] shadow-xl shadow-amber-500/20">
              <AlertTriangle className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-black text-white mb-2">Vercel 배포판 API 키 설정이 필요합니다</h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
                Vercel 환경에서는 보안상 팝업 입력이 지원되지 않습니다. <br/>
                Vercel 프로젝트 페이지의 <strong>Settings &rarr; Environment Variables</strong> 메뉴에서 
                <code className="mx-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">API_KEY</code> 변수를 추가한 뒤 
                Redeploy를 진행해 주세요.
              </p>
            </div>
            <a href="https://vercel.com/dashboard" target="_blank" className="px-8 py-4 bg-white text-amber-950 rounded-2xl font-black text-sm hover:scale-105 transition-all shadow-xl shadow-white/5 flex items-center gap-2">
              Vercel 대시보드 열기 <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Original AI Studio Guidance */}
        {!hasKey && isAiStudio && (
          <div className="mb-8 p-6 bg-indigo-900/10 border border-indigo-500/20 rounded-[2rem] flex flex-col md:flex-row items-center gap-6 shadow-2xl">
            <div className="p-4 bg-indigo-600 rounded-[1.5rem] shadow-xl shadow-indigo-600/20">
              <Key className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-black text-white mb-1">Gemini API 키를 연동해 주세요</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                비디오 생성(Veo)과 고품질 이미지 생성을 위해 결제가 활성화된 API 키가 필요합니다.<br/>
                팝업창에서 <span className="text-indigo-400 font-bold">'Create a new key'</span>를 누르면 보유하신 키를 바로 사용할 수 있습니다.
              </p>
            </div>
            <button onClick={() => (window as any).aistudio.openSelectKey()} className="px-6 py-3 bg-white text-indigo-900 rounded-xl font-black text-sm hover:scale-105 transition-transform active:scale-95 shadow-xl shadow-white/5">지금 키 연동하기</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Config */}
          <div className={`lg:col-span-4 space-y-6 ${showHistory ? 'hidden lg:block' : ''}`}>
            <section className="bg-[#151c2e] rounded-3xl border border-[#1e293b] p-6 shadow-xl space-y-4">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Type className="w-4 h-4 text-indigo-400" /> 프로젝트 주제
              </h2>
              <input 
                type="text"
                placeholder="어떤 영상을 만들까요?"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-[#0a0f1e] border border-[#1e293b] rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white placeholder:text-slate-700"
              />
              <button onClick={() => setIsGenreModalOpen(true)} className="w-full flex items-center justify-between p-4 bg-[#1e293b] rounded-2xl text-sm font-bold border border-[#334155] hover:bg-[#2d3748] transition-all">
                <div className="flex items-center gap-3">{selectedGenreData ? <span className="text-lg">{selectedGenreData.icon} {selectedGenreData.name}</span> : <span className="text-slate-500">콘텐츠 장르 선택</span>}</div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </section>

            <section className="bg-[#151c2e] rounded-3xl border border-[#1e293b] p-6 shadow-xl space-y-6">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" /> 연출 파라미터
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">아트 스타일</label>
                  <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)} className="w-full bg-[#0a0f1e] border border-[#1e293b] rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    {IMAGE_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">화면 비율</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ASPECT_RATIOS.map(r => (
                      <button key={r.value} onClick={() => setSelectedRatio(r.value)} className={`py-3 rounded-xl text-[10px] font-black border transition-all ${selectedRatio === r.value ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/20' : 'bg-[#0a0f1e] border-[#1e293b] text-slate-500 hover:border-slate-700'}`}>{r.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <button 
              onClick={handleGenerate} 
              disabled={loading} 
              className="group w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black flex items-center justify-center gap-3 shadow-2xl shadow-indigo-600/30 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6 fill-current group-hover:animate-bounce" />}
              {loading ? 'AI 크리에이티브 생성 중...' : '마스터 프로젝트 생성'}
            </button>
          </div>

          {/* Main Display Area */}
          <div className={`${showHistory ? 'lg:col-span-5' : 'lg:col-span-8'}`}>
            {!generatedContent && !loading && (
              <div className="h-[600px] border-2 border-dashed border-[#1e293b] rounded-[3rem] flex flex-col items-center justify-center text-slate-600 text-center p-8 bg-[#151c2e]/20">
                <div className="p-8 bg-[#151c2e] rounded-full mb-6 border border-[#1e293b] shadow-2xl">
                  <Sparkles className="w-16 h-16 text-indigo-500/20" />
                </div>
                <h3 className="text-xl font-black text-slate-400 mb-2">당신의 아이디어를 기다리고 있습니다</h3>
                <p className="text-sm font-medium leading-relaxed">주제와 장르를 설정하고 버튼을 클릭하면<br/>대본부터 영상 소스까지 한 번에 생성됩니다.</p>
              </div>
            )}

            {loading && !generatedContent && (
              <div className="h-[600px] flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Wand2 className="w-8 h-8 text-indigo-400 animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-white font-black text-2xl">기획안 구성 중</p>
                  <p className="text-slate-500 text-sm">최적의 유튜브 바이럴 요소를 분석하고 있습니다...</p>
                </div>
              </div>
            )}

            {generatedContent && (
              <div className="bg-[#151c2e] rounded-[3rem] border border-[#1e293b] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-500">
                <div className="p-8 border-b border-[#1e293b] flex items-center justify-between bg-indigo-900/5">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-[#0a0f1e] rounded-2xl flex items-center justify-center text-4xl shadow-inner border border-[#1e293b]">{generatedContent.genreIcon}</div>
                    <div>
                      <h3 className="font-black text-xl text-white">{subject || generatedContent.genre}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[9px] font-black uppercase tracking-widest border border-indigo-500/20">{generatedContent.visualStyle}</span>
                        <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">{generatedContent.aspectRatio}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={downloadText} className="p-4 bg-[#0a0f1e] rounded-2xl hover:bg-slate-800 transition-all border border-[#1e293b] group">
                    <Download className="w-6 h-6 text-slate-400 group-hover:text-white group-hover:scale-110 transition-all" />
                  </button>
                </div>

                <div className="flex border-b border-[#1e293b] overflow-x-auto bg-[#0a0f1e]/20 px-4">
                  {[
                    { id: 'script', label: '최종 대본', icon: FileText },
                    { id: 'titles', label: '추천 제목', icon: Target },
                    { id: 'images', label: '스토리보드', icon: Layers },
                    { id: 'tts', label: 'AI 보이스', icon: Mic }
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-8 py-5 text-xs font-black transition-all border-b-2 uppercase tracking-[0.2em] whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-8 min-h-[500px]">
                  {activeTab === 'script' && (
                    <div className="space-y-6">
                      <div className="flex justify-end"><button onClick={() => copyToClipboard(generatedContent.script)} className="text-[10px] font-black text-indigo-400 flex items-center gap-1.5 hover:text-indigo-300 transition-colors bg-indigo-500/5 px-3 py-1.5 rounded-lg border border-indigo-500/10"><Copy className="w-3.5 h-3.5" /> 복사하기</button></div>
                      <div className="bg-[#0a0f1e] p-8 rounded-[2rem] text-slate-300 leading-loose text-base whitespace-pre-wrap border border-[#1e293b] shadow-inner font-light">{generatedContent.script}</div>
                    </div>
                  )}

                  {activeTab === 'images' && (
                    <div className="space-y-8">
                      <div className="flex flex-col sm:flex-row items-center justify-between bg-indigo-600/5 p-6 rounded-[2rem] border border-indigo-500/20 gap-4">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-600/20"><Layers className="w-6 h-6" /></div>
                          <div>
                            <p className="text-sm font-black text-white">비주얼 스토리보드 마스터링</p>
                            <p className="text-[10px] text-indigo-300 font-bold opacity-70">모든 장면의 이미지를 AI가 한 번에 생성합니다.</p>
                          </div>
                        </div>
                        <button onClick={handleBatchImageGen} disabled={isGeneratingBatch} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 transition-all disabled:opacity-50">
                          {isGeneratingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          전체 생성 {isGeneratingBatch && `(${batchProgress}%)`}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {generatedContent.imagePrompts.map((p, i) => (
                          <div key={i} className="bg-[#0a0f1e] rounded-[1.5rem] overflow-hidden border border-[#1e293b] group hover:border-indigo-500/30 transition-all">
                            <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                              {generatedVideos[i] ? (
                                <video 
                                  src={generatedVideos[i]} 
                                  controls 
                                  autoPlay 
                                  muted 
                                  playsInline 
                                  className="w-full h-full object-cover animate-in fade-in duration-700" 
                                />
                              ) : generatedImages[i] ? (
                                <img src={generatedImages[i]} className="w-full h-full object-cover animate-in fade-in duration-700" />
                              ) : (
                                <ImageIcon className="w-12 h-12 text-slate-800 opacity-20" />
                              )}
                              
                              {isGeneratingVideo === i && (
                                <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
                                  <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mb-4" />
                                  <p className="text-xs text-white font-black tracking-widest">{videoStatus}</p>
                                </div>
                              )}

                              <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-black text-white border border-white/10 uppercase tracking-widest z-10">Scene {i+1}</div>
                              
                              {!generatedVideos[i] && generatedImages[i] && isGeneratingVideo === null && (
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-10 backdrop-blur-[2px]">
                                  <button onClick={() => handleVideoGen(i)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-2xl hover:scale-110 transition-transform"><Video className="w-4 h-4" /> Video 생성</button>
                                  <button onClick={() => handleImageGen(p, i)} className="p-3 bg-white/10 text-white border border-white/20 rounded-xl hover:bg-white/20 hover:scale-110 transition-transform"><RefreshCw className="w-4 h-4" /></button>
                                </div>
                              )}
                            </div>
                            <div className="p-5">
                              <p className="text-xs text-slate-500 italic leading-relaxed line-clamp-2">"{p}"</p>
                              {!generatedImages[i] && !isGeneratingBatch && (
                                <button onClick={() => handleImageGen(p, i)} className="mt-4 w-full py-3 bg-slate-800/50 hover:bg-indigo-600 hover:text-white border border-slate-700 rounded-xl text-[11px] font-black transition-all">이미지 생성</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'tts' && (
                    <div className="flex flex-col items-center justify-center h-[400px] space-y-8 bg-[#0a0f1e]/50 rounded-[3rem] border border-[#1e293b] shadow-inner">
                      <div className="relative">
                        <div className="w-24 h-24 bg-indigo-600/10 rounded-full flex items-center justify-center border border-indigo-500/20">
                          <Mic className="w-12 h-12 text-indigo-500" />
                        </div>
                        {isGeneratingAudio && (
                          <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
                      {!generatedContent.audioData ? (
                        <div className="text-center space-y-6">
                          <div>
                            <p className="text-xl font-black text-white">뉴럴 AI 음성 합성</p>
                            <p className="text-sm text-slate-500 mt-1">대본에 감정을 입혀 전문 성우의 목소리로 변환합니다.</p>
                          </div>
                          <button onClick={handleAudioGen} disabled={isGeneratingAudio} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-600/30 flex items-center gap-3">
                            {isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current" />}
                            AI 음성 마스터링 시작
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                          <button onClick={playAudio} className="px-12 py-5 bg-white text-indigo-950 rounded-2xl font-black flex items-center gap-4 hover:scale-105 transition-all shadow-2xl shadow-white/10 active:scale-95">
                            <Play className="w-8 h-8 fill-current" /> 재생하기
                          </button>
                          <button onClick={handleAudioGen} className="text-xs font-black text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-widest">다시 생성하기</button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'titles' && (
                    <div className="space-y-4">
                      {generatedContent.titles.map((t, i) => (
                        <div key={i} onClick={() => copyToClipboard(t)} className="flex items-center justify-between p-6 bg-[#0a0f1e] border border-[#1e293b] rounded-[1.5rem] hover:border-indigo-500 transition-all cursor-pointer group hover:bg-indigo-500/5">
                          <span className="text-base font-bold text-slate-200">
                            <span className="text-indigo-500 font-black mr-4 text-xl">{i+1}</span>
                            {t}
                          </span>
                          <Copy className="w-5 h-5 text-slate-700 group-hover:text-indigo-400 transition-colors" />
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

      {/* Genre Library Modal */}
      {isGenreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#151c2e] rounded-[3rem] w-full max-w-3xl border border-[#1e293b] overflow-hidden shadow-[0_0_100px_rgba(79,70,229,0.2)] animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-[#1e293b] flex items-center justify-between bg-indigo-900/10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-600/20"><Menu className="w-6 h-6" /></div>
                <div>
                  <h3 className="font-black text-xl text-white">콘텐츠 장르 라이브러리</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">바이럴 최적화를 위한 기초 설계</p>
                </div>
              </div>
              <button onClick={() => setIsGenreModalOpen(false)} className="p-3 hover:bg-slate-800 rounded-full transition-colors border border-transparent hover:border-slate-700"><X className="w-8 h-8 text-slate-500" /></button>
            </div>
            <div className="p-8 max-h-[70vh] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {GENRES.map((g) => (
                <button 
                  key={g.id} 
                  onClick={() => { setSelectedGenre(g.id); setIsGenreModalOpen(false); }}
                  className={`flex flex-col items-center gap-4 p-8 rounded-[2rem] border-2 transition-all group active:scale-95 ${
                    selectedGenre === g.id ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10' : 'border-transparent bg-[#0a0f1e] hover:border-slate-700 hover:bg-[#151c2e]'
                  }`}
                >
                  <span className="text-5xl group-hover:scale-125 transition-transform duration-500">{g.icon}</span>
                  <span className="font-black text-sm tracking-tight">{g.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

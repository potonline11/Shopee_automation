import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  SkipForward, 
  SkipBack, 
  RotateCcw, 
  Sparkles, 
  Subtitles, 
  Volume1
} from "lucide-react";
import { Script, Scene } from "../types";

interface ShortsPlayerProps {
  script: Script;
  characterName?: string;
  productName?: string;
}

export default function ShortsPlayer({ script, characterName, productName }: ShortsPlayerProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<any>(null);
  
  const scenes = script.scenes || [];
  const currentScene = scenes[currentIdx];

  // Stop playback when script changes
  useEffect(() => {
    setCurrentIdx(0);
    setIsPlaying(false);
    setAudioProgress(0);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [script.id]);

  // Handle playing audio or fallback timer
  useEffect(() => {
    if (!currentScene) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const hasRealAudio = currentScene.audioUrl && 
                         currentScene.audioUrl !== "generating" && 
                         !currentScene.audioUrl.includes("placeholder");

    // Initialize audio element
    const audio = new Audio(currentScene.audioUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
    audio.muted = isMuted;
    audioRef.current = audio;

    const durationSeconds = currentScene.duration || 6;
    let elapsedMs = 0;
    setAudioProgress(0);

    const handleAudioEnded = () => {
      advanceScene();
    };

    const handleTimeUpdate = () => {
      if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100;
        setAudioProgress(percent);
      }
    };

    if (hasRealAudio) {
      audio.addEventListener("ended", handleAudioEnded);
      audio.addEventListener("timeupdate", handleTimeUpdate);
      if (isPlaying) {
        audio.play().catch(e => console.warn("Audio play prevented:", e));
      }
    } else {
      // Fallback timer simulation
      if (isPlaying) {
        const intervalMs = 100;
        const totalMs = durationSeconds * 1000;
        
        progressIntervalRef.current = setInterval(() => {
          elapsedMs += intervalMs;
          const percent = Math.min((elapsedMs / totalMs) * 100, 100);
          setAudioProgress(percent);

          if (elapsedMs >= totalMs) {
            clearInterval(progressIntervalRef.current);
            advanceScene();
          }
        }, intervalMs);
      }
    }

    return () => {
      audio.removeEventListener("ended", handleAudioEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.pause();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [currentIdx, isPlaying, script.id]);

  // Sync mute state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const advanceScene = () => {
    if (currentIdx < scenes.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setAudioProgress(0);
    } else {
      // Finished all scenes! Stop and reset
      setIsPlaying(false);
      setCurrentIdx(0);
      setAudioProgress(0);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
      setAudioProgress(0);
    } else {
      setCurrentIdx(scenes.length - 1);
      setAudioProgress(0);
    }
  };

  const handleNext = () => {
    if (currentIdx < scenes.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setAudioProgress(0);
    } else {
      setCurrentIdx(0);
      setAudioProgress(0);
    }
  };

  const togglePlay = () => {
    setIsPlaying(prev => !prev);
  };

  if (scenes.length === 0) {
    return null;
  }

  return (
    <div id="shorts_theater_player" className="relative bg-slate-950 rounded-2xl border border-slate-800/80 p-6 flex flex-col items-center justify-center overflow-hidden w-full max-w-4xl mx-auto shadow-2xl">
      {/* Heavy blurred background backing */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-[0.08] blur-2xl scale-110 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${currentScene?.imageUrl || ""})` }}
      />

      <div className="relative z-10 w-full flex flex-col md:flex-row items-center gap-8">
        
        {/* Smartphone Frame (9:16 Video Stage) */}
        <div className="relative w-72 h-[480px] bg-black rounded-[36px] border-[6px] border-slate-800 shadow-2xl overflow-hidden shrink-0">
          
          {/* Top Speaker/Camera notch design */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 rounded-b-xl z-50 flex items-center justify-center">
            <div className="w-10 h-1 bg-slate-900 rounded-full"></div>
          </div>

          {/* 4 Instagram/Shorts style progress segments at top */}
          <div className="absolute top-5 left-3 right-3 flex gap-1 z-40">
            {scenes.map((_, idx) => {
              let widthVal = "0%";
              if (idx < currentIdx) widthVal = "100%";
              else if (idx === currentIdx) widthVal = `${audioProgress}%`;

              return (
                <div key={idx} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 rounded-full transition-all duration-75"
                    style={{ width: widthVal }}
                  />
                </div>
              );
            })}
          </div>

          {/* Active Scene Content */}
          <div className="relative w-full h-full bg-slate-950 overflow-hidden flex items-center justify-center">
            
            {/* Image layer with smooth Ken Burns panning/zooming effect */}
            {currentScene?.imageUrl === "generating" ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-orange-400 p-4 space-y-3">
                <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-slate-400 font-mono text-center">กำลังวาดภาพฉาก...</span>
              </div>
            ) : currentScene?.imageUrl ? (
              <img 
                src={currentScene.imageUrl} 
                alt={`Scene ${currentScene.sceneNumber}`}
                referrerPolicy="no-referrer"
                className={`w-full h-full object-cover transition-transform duration-[12000ms] ease-out ${
                  isPlaying ? "scale-115 translate-y-1" : "scale-100"
                }`}
              />
            ) : (
              <div className="text-slate-600 text-xs">ไม่มีรูปภาพ</div>
            )}

            {/* Dark overlay gradients for high-contrast subtitles */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"></div>
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none"></div>

            {/* Top Indicator Flags */}
            <div className="absolute top-8 left-3 z-30 flex flex-col gap-1.5 items-start">
              <span className="bg-orange-500 text-white font-mono font-bold text-[9px] px-2 py-0.5 rounded-full shadow-lg border border-orange-400/20">
                ฉาก {currentScene?.sceneNumber} / 4
              </span>
              {currentScene?.soundEffect && (
                <span className="bg-black/70 backdrop-blur-sm text-sky-400 font-mono text-[8px] px-2 py-0.5 rounded border border-sky-400/10 max-w-[180px] truncate">
                  🔊 {currentScene.soundEffect}
                </span>
              )}
            </div>

            {/* Play Overlay Button (only shown when paused) */}
            {!isPlaying && (
              <button 
                onClick={togglePlay}
                className="absolute inset-0 m-auto w-14 h-14 bg-orange-500/90 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 hover:bg-orange-500 transition-all z-30 border border-orange-400/30"
              >
                <Play className="w-6 h-6 fill-current translate-x-0.5" />
              </button>
            )}

            {/* Bold White Subtitles Overlay - Bottom Center */}
            <div className="absolute bottom-12 left-3 right-3 z-30 flex flex-col items-center justify-end text-center">
              <div className="bg-black/75 backdrop-blur-md rounded-xl p-3 border border-white/10 shadow-2xl w-full">
                <p className="text-[9px] text-amber-400 font-bold tracking-wider uppercase flex items-center justify-center gap-1 mb-1 font-mono">
                  <Subtitles className="w-3.5 h-3.5" /> พากย์ไทย & ซับไตเติล
                </p>
                <p className="text-xs font-bold text-white leading-relaxed font-sans select-none tracking-wide">
                  {currentScene?.subtitle}
                </p>
              </div>
            </div>

            {/* YouTube Shorts sidebar mock elements for high fidelity */}
            <div className="absolute right-2.5 bottom-28 z-30 flex flex-col items-center gap-3.5 text-white pointer-events-none opacity-85">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-[10px]">❤️</div>
                <span className="text-[9px] font-mono mt-0.5">9.4K</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-[10px]">💬</div>
                <span className="text-[9px] font-mono mt-0.5">512</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-[10px]">🔗</div>
                <span className="text-[8px] font-mono mt-0.5">แชร์</span>
              </div>
            </div>

          </div>
        </div>

        {/* Right Panel: Active Scene Playback Description */}
        <div className="flex-1 space-y-5 w-full text-left">
          <div className="space-y-1.5">
            <span className="text-[10px] text-orange-400 uppercase font-mono font-bold tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
              SHORTS THEATER (ห้องจำลองเสียงและภาพเคลื่อนไหวจริง)
            </span>
            <h3 className="text-white font-bold text-xl leading-snug">
              {script.title}
            </h3>
            <p className="text-slate-400 text-xs">
              ตัวละครป้ายยา: <strong className="text-slate-200">{characterName || "ระบุตัวตนไม่ได้"}</strong> • ผลิตภัณฑ์แนะนำ: <strong className="text-slate-200">{productName || "สินค้าโปรโมต"}</strong>
            </p>
          </div>

          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 space-y-3.5">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-mono block">เนื้อเรื่อง & จุดหักมุมย่อ (Twist Narrative)</span>
              <p className="text-xs text-amber-300 font-medium leading-relaxed font-sans mt-1">
                {script.twistDescription}
              </p>
            </div>

            <div className="border-t border-slate-800/60 pt-3">
              <span className="text-[10px] text-slate-500 uppercase font-mono block">สคริปต์พูดจริงในฉากที่ {currentScene?.sceneNumber}</span>
              <p className="text-xs text-slate-200 leading-relaxed font-sans mt-1">
                "{currentScene?.voiceover}"
              </p>
            </div>

            {currentScene?.audioUrl && currentScene.audioUrl !== "generating" && (
              <div className="border-t border-slate-800/60 pt-3 flex items-center gap-2">
                <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono uppercase font-bold">
                  {currentScene.audioUrl.includes("soundhelix") ? "Demo Audio Mode" : "Real Synthesized Thai Voice"}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  {currentScene.audioUrl.includes("soundhelix") ? "กำลังแสดงดนตรีคลอ" : "ระบบถอดเสียงสมจริงด้วย ElevenLabs/Gemini"}
                </span>
              </div>
            )}
          </div>

          {/* Media Player Control Deck */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800/50">
            
            {/* Play/Pause Button */}
            <button 
              onClick={togglePlay}
              className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all text-white ${
                isPlaying ? "bg-amber-600 hover:bg-amber-500" : "bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/15"
              }`}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
            </button>

            {/* Prev Scene */}
            <button 
              onClick={handlePrev}
              className="w-10 h-10 bg-slate-900 border border-slate-800 text-slate-300 rounded-full flex items-center justify-center hover:bg-slate-800 active:scale-90 transition-all"
              title="Previous Scene"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Next Scene */}
            <button 
              onClick={handleNext}
              className="w-10 h-10 bg-slate-900 border border-slate-800 text-slate-300 rounded-full flex items-center justify-center hover:bg-slate-800 active:scale-90 transition-all"
              title="Next Scene"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>

            {/* Mute/Unmute */}
            <button 
              onClick={() => setIsMuted(prev => !prev)}
              className={`w-10 h-10 rounded-full border flex items-center justify-center active:scale-90 transition-all ${
                isMuted 
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20" 
                  : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <span className="text-[10px] text-slate-500 font-mono ml-auto">
              คุมกำกับความคมชัดสูง • ไร้สัตว์เจือปน
            </span>

          </div>

        </div>

      </div>
    </div>
  );
}

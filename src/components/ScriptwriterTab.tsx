import React, { useState } from "react";
import { 
  Sparkles, 
  User, 
  ShoppingBag, 
  ChevronRight, 
  Copy, 
  Check, 
  Clapperboard, 
  Volume2, 
  Subtitles, 
  Music, 
  Clock, 
  Send, 
  AlertTriangle 
} from "lucide-react";
import { Character, ShopeeProduct, Script, Scene, AppConfig } from "../types";
import { getSafePublicOrigin, getSafeRecommendedVideoUrl } from "../utils";
import ShortsPlayer from "./ShortsPlayer";

interface ScriptwriterTabProps {
  characters: Character[];
  products: ShopeeProduct[];
  selectedCharacterId?: string;
  selectedProductId?: string;
  onSelectCharacter: (id: string) => void;
  onSelectProduct: (id: string) => void;
  onAddScript: (script: Script) => void;
  scripts: Script[];
  onTriggerMockPipelineWithScript: (script: Script, videoUrl?: string) => void;
  config: AppConfig;
}

export default function ScriptwriterTab({
  characters,
  products,
  selectedCharacterId,
  selectedProductId,
  onSelectCharacter,
  onSelectProduct,
  onAddScript,
  scripts,
  onTriggerMockPipelineWithScript,
  config
}: ScriptwriterTabProps) {
  const [tone, setTone] = useState("ตลกคอมเมดี้หักมุมสะใจ");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [activeScript, setActiveScript] = useState<Script | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Dynamic video recommendation engine for viral products
  const getRecommendedVideoUrl = (productName: string, category: string = ""): string => {
    return getSafeRecommendedVideoUrl(productName, category, config);
  };

  const getPublicOrigin = () => {
    return getSafePublicOrigin(config);
  };

  const [customVideoUrl, setCustomVideoUrl] = useState(getPublicOrigin() + "/videos/default.mp4");

  const selectedChar = characters.find(c => c.id === selectedCharacterId);
  const selectedProd = products.find(p => p.id === selectedProductId);

  // Automatically update the recommended video URL whenever the selected product changes!
  React.useEffect(() => {
    if (selectedProd) {
      const recommendedUrl = getRecommendedVideoUrl(selectedProd.name, selectedProd.category);
      setCustomVideoUrl(recommendedUrl);
    }
  }, [selectedProductId, products]);

  const loadingMessages = [
    "กำลังวิเคราะห์คุณสมบัติสินค้าและตัวละคร...",
    "กำลังปรึกษาผู้กำกับอัจฉริยะ Gemini 3.5 Flash...",
    "กำลังเขียนบทบรรยายไทยแบบดึงอารมณ์ร่วมสูงสุด...",
    "กำลังคิดพล็อตเรื่องหักมุมสุดพีคสำหรับช่วงวินาทีที่ 25...",
    "กำลังคำนวณคำสั่ง Midjourney Prompt และผูกชุดพารามิเตอร์ --cref อัตโนมัติ...",
    "ประกอบร่างผลงาน เขียนแคปชัน และประมวลแฮชแท็ก YouTube Shorts..."
  ];

  const handleGenerateScript = async () => {
    if (!selectedChar || !selectedProd) return;

    setIsLoading(true);
    setLoadingStep(0);

    // Interval to simulate different loading stages
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
    }, 2500);

    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: {
            name: selectedProd.name,
            category: selectedProd.category,
            price: selectedProd.price,
            description: selectedProd.name
          },
          character: {
            name: selectedChar.name,
            age: selectedChar.age,
            gender: selectedChar.gender,
            attire: selectedChar.attire,
            description: selectedChar.description
          },
          tone: tone
        })
      });

      const data = await response.json();
      
      // Inject "generating" image placeholders so that we fetch real matching images in the background
      const updatedScenes = data.scenes.map((scene: Scene) => {
        return {
          ...scene,
          id: "scene_" + Date.now() + "_" + scene.sceneNumber,
          imageUrl: "generating"
        };
      });

      const newScript: Script = {
        id: "script_" + Date.now(),
        title: data.title || "บทหักมุม: " + selectedProd.name,
        productId: selectedProd.id,
        characterId: selectedChar.id,
        twistDescription: data.twistDescription || "ความหักมุมตอนท้ายเรื่อง",
        scenes: updatedScenes,
        captions: data.captions || "",
        tags: data.tags || ["#shopee", "#affiliate"]
      };

      setActiveScript(newScript);
      onAddScript(newScript);

      // Async fetch matching scene images and voiceovers one by one!
      newScript.scenes.forEach(async (scene: Scene) => {
        // 1. Fetch image
        try {
          const imgResponse = await fetch("/api/generate-scene-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: scene.stableImagePrompt,
              productName: selectedProd.name
            })
          });
          const imgData = await imgResponse.json();
          const finalUrl = imgData.imageUrl;
          
          if (finalUrl) {
            setActiveScript((current: Script | null) => {
              if (!current || current.id !== newScript.id) return current;
              const updated = current.scenes.map(s => 
                s.sceneNumber === scene.sceneNumber ? { ...s, imageUrl: finalUrl } : s
              );
              const updatedScript = { ...current, scenes: updated };
              onAddScript(updatedScript); // Save back to main state!
              return updatedScript;
            });
          }
        } catch (err) {
          console.error(`Error generating image for Scene ${scene.sceneNumber}:`, err);
          const fallbackSeed = Math.floor(Math.random() * 100);
          const fallbackUrl = `https://images.unsplash.com/photo-1542744173-8e0856011213?w=500&auto=format&fit=crop&q=80&sig=${fallbackSeed}`;
          
          setActiveScript((current: Script | null) => {
            if (!current || current.id !== newScript.id) return current;
            const updated = current.scenes.map(s => 
              s.sceneNumber === scene.sceneNumber ? { ...s, imageUrl: fallbackUrl } : s
            );
            const updatedScript = { ...current, scenes: updated };
            onAddScript(updatedScript); // Save back to main state!
            return updatedScript;
          });
        }

        // 2. Fetch voiceover
        try {
          const voiceResponse = await fetch("/api/synthesize-voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: scene.voiceover
            })
          });
          const voiceData = await voiceResponse.json();
          const finalAudioUrl = voiceData.audioUrl;

          if (finalAudioUrl) {
            setActiveScript((current: Script | null) => {
              if (!current || current.id !== newScript.id) return current;
              const updated = current.scenes.map(s => 
                s.sceneNumber === scene.sceneNumber ? { ...s, audioUrl: finalAudioUrl } : s
              );
              const updatedScript = { ...current, scenes: updated };
              onAddScript(updatedScript); // Save back to main state!
              return updatedScript;
            });
          }
        } catch (err) {
          console.error(`Error synthesizing voice for Scene ${scene.sceneNumber}:`, err);
        }
      });
    } catch (err) {
      console.error("Error generating script:", err);
    } finally {
      clearInterval(stepInterval);
      setIsLoading(false);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Selector Deck */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Clapperboard className="w-5 h-5 text-orange-500" />
          สเตจการจับคู่และสร้างบทวีดีโอ
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Select Character */}
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">1. เลือกนักแสดงนำ (ตัวละคร)</label>
            {characters.length === 0 ? (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-sm text-slate-500">
                ไม่มีตัวละครหลัก กรุณาเพิ่มที่หน้า Character Hub ➔
              </div>
            ) : (
              <select
                value={selectedCharacterId || ""}
                onChange={(e) => onSelectCharacter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">-- เลือกตัวละครหลัก --</option>
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.gender})</option>
                ))}
              </select>
            )}
            {selectedChar && (
              <div className="flex gap-2.5 mt-3 items-center p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/40">
                <img 
                  src={selectedChar.referenceImageUrl} 
                  alt={selectedChar.name} 
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-lg object-cover"
                />
                <div className="text-xs">
                  <p className="text-white font-bold">{selectedChar.name}</p>
                  <p className="text-slate-400 truncate max-w-[150px]">{selectedChar.attire}</p>
                </div>
              </div>
            )}
          </div>

          {/* Select Product */}
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">2. เลือกสินค้าที่ต้องการโปรโมท</label>
            {products.length === 0 ? (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-sm text-slate-500">
                ไม่มีสินค้าในคลัง กรุณาแปลงลิงก์ที่ Shopee Converter ➔
              </div>
            ) : (
              <select
                value={selectedProductId || ""}
                onChange={(e) => onSelectProduct(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">-- เลือกสินค้าในระบบ --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name.slice(0, 35)}... ({p.price})</option>
                ))}
              </select>
            )}
            {selectedProd && (
              <div className="flex gap-2.5 mt-3 items-center p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/40">
                <img 
                  src={selectedProd.imageUrl} 
                  alt={selectedProd.name} 
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-lg object-cover"
                />
                <div className="text-xs">
                  <p className="text-white font-bold line-clamp-1">{selectedProd.name}</p>
                  <p className="text-emerald-400 font-bold">{selectedProd.price}</p>
                </div>
              </div>
            )}
          </div>

          {/* Tone & Trigger */}
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">3. สไตล์ภาพและมู้ดโทนวิดีโอ</label>
            <div className="flex gap-2">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-white outline-none"
              >
                <option value="ตลกคอมเมดี้หักมุมสะใจ">ตลกคอมเมดี้ หักมุมขำขันสะใจ</option>
                <option value="ดราม่าเข้มข้น หักมุมร้องไห้กุมขมับ">ดราม่าเข้มข้น หักมุมบีบคั้นอารมณ์</option>
                <option value="สยองขวัญมืดหม่นแต่หักมุมกลายเป็นตลก">สยองขวัญลึกลับ หักมุมกลายเป็นเรื่องเปิ่นๆ</option>
                <option value="ไซไฟ อนาคตล้ำๆ และหักมุมแบบล้ำลึก">แนวคิดล้ำสมัย ไซไฟไฮเทค และหักมุมเฉียบคม</option>
              </select>

              <button
                disabled={isLoading || !selectedChar || !selectedProd}
                onClick={handleGenerateScript}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold px-5 rounded-xl flex items-center justify-center transition-all shadow-md shadow-orange-500/15"
              >
                เขียนบทด่วน
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Screen */}
      {isLoading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-6 max-w-xl mx-auto animate-fade-in">
          <div className="relative w-16 h-16 mx-auto">
            <span className="absolute flex h-full w-full rounded-full bg-orange-500 opacity-25 animate-ping"></span>
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="space-y-2">
            <h4 className="text-white font-bold text-lg">AI กำลังรังสรรค์พล็อตวิดีโอ...</h4>
            <p className="text-slate-400 font-mono text-xs">{loadingMessages[loadingStep]}</p>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-orange-500 h-full rounded-full transition-all duration-1000" 
              style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Script & Storyboard Output */}
      {activeScript && !isLoading && (
        <div className="space-y-8 animate-fade-in">
          {/* Header Script Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative">
            <div className="absolute right-4 top-4 bg-orange-500/10 text-orange-400 font-mono text-xs font-bold px-3 py-1.5 rounded-full border border-orange-500/20">
              Gemini 3.5 Generated Script
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white max-w-[80%]">{activeScript.title}</h2>
              <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                <span className="text-orange-400 font-bold">พล็อตหักมุม (Twist):</span> {activeScript.twistDescription}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-800/80">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60">
                <p className="text-xs text-slate-500 uppercase font-mono mb-2">แคปชันโพสต์แชร์ YouTube (Captions)</p>
                <div className="text-sm text-slate-300 whitespace-pre-line bg-slate-900/60 p-3 rounded-lg font-sans border border-slate-800/40 select-all relative">
                  {activeScript.captions}
                  {` \n\nพิกัดตามปักหมุดในคอมเมนต์ครับ 📌`}
                  <button 
                    onClick={() => handleCopyText(activeScript.captions, "captions")}
                    className="absolute top-2 right-2 p-1 text-slate-500 hover:text-white bg-slate-950 rounded hover:scale-110 transition-all"
                  >
                    {copiedId === "captions" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-mono mb-2">แฮชแท็กพรีเซ็ตแนะนำ (Viral Tags)</p>
                  <div className="flex flex-wrap gap-2">
                    {activeScript.tags.map((tag, i) => (
                      <span key={i} className="text-xs bg-slate-900 border border-slate-800 text-sky-400 px-2.5 py-1 rounded-full font-mono font-medium">
                        {tag.startsWith("#") ? tag : `#${tag}`}
                      </span>
                    ))}
                    <span className="text-xs bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2.5 py-1 rounded-full font-mono font-bold">
                      #shopeeaffiliate
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-3 pt-4 border-t border-slate-800/60">
                  <div>
                    <label className="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1">
                      ลิงก์วิดีโอ MP4 สำหรับส่งขึ้น YouTube (เปลี่ยนเป็นลิงก์วิดีโอของคุณได้)
                    </label>
                    <input
                      type="url"
                      placeholder="เช่น https://example.com/my-video.mp4"
                      value={customVideoUrl}
                      onChange={(e) => setCustomVideoUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none transition-all font-mono"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-slate-500">คลิกเปลี่ยนวิดีโอสต็อกแนวตั้งตามธีมบท:</span>
                      <button
                        type="button"
                        onClick={() => setCustomVideoUrl(getPublicOrigin() + "/videos/fan.mp4")}
                        className="text-[9px] bg-slate-900 hover:bg-slate-800 text-orange-400 border border-slate-800 px-2 py-0.5 rounded transition-all font-medium"
                      >
                        🌬️ พัดลม/ร้อนแดด
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomVideoUrl(getPublicOrigin() + "/videos/laundry.mp4")}
                        className="text-[9px] bg-slate-900 hover:bg-slate-800 text-pink-400 border border-slate-800 px-2 py-0.5 rounded transition-all font-medium"
                      >
                        🧺 พับผ้า/เสื้อผ้า
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomVideoUrl(getPublicOrigin() + "/videos/beauty.mp4")}
                        className="text-[9px] bg-slate-900 hover:bg-slate-800 text-violet-400 border border-slate-800 px-2 py-0.5 rounded transition-all font-medium"
                      >
                        💄 บิวตี้/หน้าใส
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomVideoUrl(getPublicOrigin() + "/videos/phone.mp4")}
                        className="text-[9px] bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-800 px-2 py-0.5 rounded transition-all font-medium"
                      >
                        📱 มือถือ/โซเชียล
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomVideoUrl(getPublicOrigin() + "/videos/pet.mp4")}
                        className="text-[9px] bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 px-2 py-0.5 rounded transition-all font-medium"
                      >
                        🐱 สัตว์เลี้ยง
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => onTriggerMockPipelineWithScript(activeScript, customVideoUrl)}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.98] text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-500/15"
                  >
                    <Send className="w-3.5 h-3.5 fill-current" />
                    ส่งบทเข้าคิวเรนเดอร์และสร้างวิดีโอ (Pipeline)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Active Shorts Theater Player */}
          <div className="my-6">
            <ShortsPlayer 
              script={activeScript} 
              characterName={selectedChar?.name} 
              productName={selectedProd?.name} 
            />
          </div>

          {/* 4-Scene Storyboard Grid */}
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg flex items-center gap-1.5">
              <Clapperboard className="w-5 h-5 text-sky-400" />
              โครงเรื่องทีละฉาก (Interactive Storyboard 4-Scenes)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {activeScript.scenes.map((scene) => (
                <div key={scene.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-sky-500/30 transition-all">
                  {/* Visual Mock Card header with 9:16 portrait design */}
                  <div className="relative h-60 bg-slate-950 overflow-hidden group">
                    {scene.imageUrl === "generating" ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-sky-400 p-4 space-y-3">
                        <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] text-slate-400 font-mono text-center">กำลังประมวลภาพ AI...</span>
                      </div>
                    ) : scene.imageUrl ? (
                      <img 
                        src={scene.imageUrl} 
                        alt={`Scene ${scene.sceneNumber}`} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-700">No Image</div>
                    )}
                    <span className="absolute top-3 left-3 bg-black/80 border border-orange-500/30 text-orange-400 font-mono font-bold text-xs px-2.5 py-1 rounded-full">
                      ฉาก {scene.sceneNumber} ({scene.duration} วินาที)
                    </span>

                    {/* Subtitle overlay mock */}
                    <div className="absolute bottom-3 left-3 right-3 bg-black/75 rounded-lg p-2 text-center border border-slate-800/80">
                      <p className="text-[10px] text-amber-400 font-bold flex items-center justify-center gap-1">
                        <Subtitles className="w-3 h-3 text-amber-400" /> ซับไตเติลบนคลิป
                      </p>
                      <p className="text-xs text-white line-clamp-2 mt-0.5 font-medium leading-relaxed font-sans">{scene.subtitle}</p>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-3.5">
                      {/* Audio voiceover */}
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/50">
                        <p className="text-[10px] text-slate-500 uppercase font-mono font-bold flex items-center gap-1 mb-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-sky-400" /> เสียงพากย์ AI (Thai Voice)
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed font-sans">{scene.voiceover}</p>
                      </div>

                      {/* Video description */}
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-mono mb-1">รายละเอียดกล้อง & ภาพ (Cinematic Action)</p>
                        <p className="text-xs text-slate-400 leading-relaxed font-sans line-clamp-3">{scene.visualDescription}</p>
                      </div>

                      {/* Sound effects */}
                      <div className="flex gap-2 text-[11px] text-slate-400 font-mono bg-slate-950/40 p-2 rounded border border-slate-800/20">
                        <span className="text-sky-400 font-bold">SFX:</span>
                        <span className="truncate">{scene.soundEffect}</span>
                      </div>
                    </div>

                    {/* Reference Prompt copy card */}
                    <div className="mt-4 pt-3 border-t border-slate-800/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 uppercase font-mono">Stable Generation Prompt:</span>
                        <button 
                          onClick={() => handleCopyText(scene.stableImagePrompt, scene.id)}
                          className="text-[10px] text-sky-400 hover:text-white font-mono flex items-center gap-1"
                        >
                          {copiedId === scene.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          Copy Prompt
                        </button>
                      </div>
                      <div className="bg-slate-950 p-2 rounded text-[9px] font-mono text-slate-500 leading-relaxed max-h-20 overflow-y-auto border border-slate-800/60 break-all select-all">
                        {scene.stableImagePrompt}
                        {selectedChar && ` --cref ${selectedChar.referenceImageUrl} --cw 100`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Guide if empty */}
      {!activeScript && !isLoading && (
        <div className="text-center py-24 bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl mx-auto space-y-4">
          <Clapperboard className="w-16 h-16 text-slate-700 mx-auto" />
          <h3 className="text-white font-bold text-lg">เริ่มต้นสร้างสรรค์บทโทรทัศน์หักมุมอัจฉริยะ</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            เลือกนักแสดงในฝันและสินค้าพันธมิตร Shopee ของคุณจากแท็บตัวเลือกด้านบน 
            แล้วกดปุ่ม <strong className="text-orange-400">"เขียนบทด่วน"</strong> เพื่อส่งความต้องการให้สมองกล Gemini 3.5 รังสรรค์พล็อตวิดีโอ Shorts ขนาด 4 ตอนจบพร้อมจุดหักมุมดึงดูดใจทันที!
          </p>
          {characters.length === 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs py-2 px-4 rounded-xl max-w-sm mx-auto flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>ตรวจพบว่ายังไม่มีตัวละครในคลัง กรุณาเพิ่มก่อนนะครับ</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

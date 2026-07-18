import React, { useState } from "react";
import { 
  User, 
  Sparkles, 
  UserCheck, 
  RefreshCw, 
  Check, 
  Plus, 
  HelpCircle, 
  Lock 
} from "lucide-react";
import { Character } from "../types";

interface CharacterHubTabProps {
  characters: Character[];
  onAddCharacter: (character: Character) => void;
  onSelectCharacter: (character: Character) => void;
  selectedCharacterId?: string;
}

const PRESET_CHARACTERS: Omit<Character, "id">[] = [
  {
    name: "สมชาย (Somchai)",
    age: "32 ปี",
    gender: "ชาย (Male)",
    description: "หนุ่มออฟฟิศจอมซุ่มซ่าม ขี้ตกใจ หน้าตาตลกแต่จริงใจ มีปัญหาสารพัดเรื่องในชีวิตประจำวัน",
    attire: "เสื้อโปโลสีเหลืองสดใส กางเกงสแล็กสีดำ",
    referencePrompt: "A close-up high-quality portrait of Somchai, a 32-year-old Thai salaryman with expressive comically worried face, tidy black hair, wearing a vibrant yellow polo shirt, studio cinematic light, hyper-stable facial features, 1:1 aspect ratio.",
    referenceImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=60"
  },
  {
    name: "พลอย (Ploy)",
    age: "26 ปี",
    gender: "หญิง (Female)",
    description: "บิวตี้บล็อกเกอร์สาวสายหรูหรา รักความเป๊ะ ทนเห็นอะไรสกปรกหรือมีขุยไม่ได้แม้แต่นิดเดียว",
    attire: "เสื้อคาร์ดิแกนถักสีชมพูพาสเทล ต่างหูมุกหรู",
    referencePrompt: "A close-up premium portrait of Ploy, a 26-year-old stylish Thai woman with sleek long black hair, perfect makeup, carrying an elegant annoyed expression, wearing a pastel pink cardigan, soft professional studio lighting, 1:1 aspect ratio.",
    referenceImageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=60"
  },
  {
    name: "ป้าแดง (Auntie Daeng)",
    age: "55 ปี",
    gender: "หญิง (Female)",
    description: "แม่ค้าขายแกงหัวหน้าสมาคมแม่บ้านประจำซอย ผู้รู้ลึกรู้จริงทุกข่าวลือ แต่อุปกรณ์ทำครัวขัดใจตลอด",
    attire: "ผ้ากันเปื้อนสีเขียวสด คาดทับเสื้อยืดลายดอกไม้",
    referencePrompt: "A vibrant portrait of Auntie Daeng, a 55-year-old Thai local merchant woman with big expressive laughing eyes, short wavy perm hair, wearing a green kitchen apron, bright kitchen background, cinematic daylight, 1:1 aspect ratio.",
    referenceImageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=60"
  }
];

export default function CharacterHubTab({ 
  characters, 
  onAddCharacter, 
  onSelectCharacter, 
  selectedCharacterId 
}: CharacterHubTabProps) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("28 ปี");
  const [gender, setGender] = useState("ชาย (Male)");
  const [description, setDescription] = useState("");
  const [attire, setAttire] = useState("");
  
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleGenerateFace = async () => {
    if (!name || !description) {
      alert("กรุณากรอกชื่อและประวัติย่อเพื่อใช้กำหนดลักษณะใบหน้าของ AI");
      return;
    }

    setIsGeneratingImage(true);
    try {
      const response = await fetch("/api/generate-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description,
          gender: gender,
          age: age,
          attire: attire || "เสื้อผ้าสีสุภาพ"
        })
      });
      const data = await response.json();
      setPreviewImage(data.imageUrl);
    } catch (err) {
      console.error("Error generating face:", err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSaveCharacter = () => {
    if (!name || !description) return;

    const refPrompt = `A high-quality 1:1 portrait of ${name}, a ${age} old ${gender}, defined as: ${description}, wearing ${attire || "casual attire"}. Highly consistent features, cinematic studio lightning, hyperrealistic photo.`;

    const newChar: Character = {
      id: "char_" + Date.now(),
      name,
      age,
      gender,
      description,
      attire: attire || "ชุดลำลองทั่วไป",
      referencePrompt: refPrompt,
      referenceImageUrl: previewImage || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=60"
    };

    onAddCharacter(newChar);
    
    // Reset Form
    setName("");
    setDescription("");
    setAttire("");
    setPreviewImage(null);
  };

  const handleAddPreset = (preset: Omit<Character, "id">) => {
    const newChar: Character = {
      ...preset,
      id: "char_preset_" + Date.now() + Math.random().toString(36).substr(2, 4)
    };
    onAddCharacter(newChar);
  };

  return (
    <div className="space-y-8">
      {/* Intro Guide for Reference Images */}
      <div className="bg-gradient-to-r from-sky-500/10 via-purple-500/5 to-slate-950 p-6 rounded-2xl border border-sky-500/20">
        <div className="flex items-start gap-4">
          <div className="bg-sky-500 text-white p-3 rounded-xl">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">ระบบล็อกใบหน้าและชุดตัวละครอัจฉริยะ (Reference Image Lock)</h2>
            <p className="text-slate-300 text-sm mt-1 leading-relaxed">
              จุดท้าทายที่สุดของ AI สร้างวิดีโอคือใบหน้าตัวละครที่เปลี่ยนแปลงไปในแต่ละฉาก 
              ระบบของเราแก้ปัญหานี้โดยการเจน **ภาพใบหน้าหลัก** ไว้ล่วงหน้า และเขียนโครงสร้างคำสั่งป้อนเข้าสู่ AI สร้างวิดีโอ 
              (เช่น Runway Gen-3 หรือ Midjourney) โดยการผูกแท็กพารามิเตอร์ <code className="bg-slate-950/80 text-orange-400 px-1.5 py-0.5 rounded font-mono font-semibold">--cref [URL ภาพต้นแบบ]</code> ร่วมด้วยเพื่อล็อกโครงสร้างใบหน้า เสื้อผ้า และโทนแสงให้ตรงกัน 100% ตลอดทั้งตอน!
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form: Create New Character */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-sky-400" />
              เพิ่มตัวละครหลักใหม่
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">ชื่อตัวละคร (เช่น สมชาย, พลอย)</label>
                <input 
                  type="text" 
                  placeholder="เช่น พี่กิตติ สายโมโห"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">อายุ</label>
                  <input 
                    type="text" 
                    placeholder="เช่น 30 ปี"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">เพศ</label>
                  <select 
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                  >
                    <option value="ชาย (Male)">ชาย (Male)</option>
                    <option value="หญิง (Female)">หญิง (Female)</option>
                    <option value="ไม่ระบุเพศ (Non-binary)">ไม่ระบุเพศ (Non-binary)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">เสื้อผ้า / เครื่องแต่งกายดั้งเดิม (สำคัญมากเพื่อรักษาสีเสื้อ)</label>
                <input 
                  type="text" 
                  placeholder="เช่น สวมเสื้อยืดสีแดงขอบขาว ใส่แว่นสายตากลมสีทอง"
                  value={attire}
                  onChange={(e) => setAttire(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">บุคลิกและลักษณะนิสัยของตัวละคร</label>
                <textarea 
                  rows={2}
                  placeholder="เช่น เป็นคนขี้ร้อน เหงื่อออกเยอะมากตลอดเวลา หงุดหงิดง่ายพกอารมณ์บูดพกกระดาษทิชชู่เพียบ"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none resize-none transition-all"
                />
              </div>

              {/* AI Avatar generation preview */}
              {previewImage && (
                <div className="relative w-32 h-32 mx-auto border-2 border-sky-500/40 rounded-xl overflow-hidden bg-slate-950">
                  <img 
                    src={previewImage} 
                    alt="AI Face Preview" 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <button 
                    onClick={() => setPreviewImage(null)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-black/90 text-white rounded-full p-1 text-[10px] transition-all"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <button 
                  type="button"
                  disabled={isGeneratingImage || !name || !description}
                  onClick={handleGenerateFace}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-medium text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  {isGeneratingImage ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-sky-400" />
                  )}
                  เจนใบหน้าตัวละคร (AI Face)
                </button>

                <button 
                  type="button"
                  disabled={!name || !description}
                  onClick={handleSaveCharacter}
                  className="bg-sky-500 hover:bg-sky-600 disabled:bg-sky-800 text-white font-medium text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1 transition-all"
                >
                  บันทึกลงคลัง
                </button>
              </div>
            </div>
          </div>

          {/* Quick Preset Characters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-white font-bold text-base mb-3 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-sky-400" />
              ตัวละครพรีเซ็ตยอดนิยม (Ready Characters)
            </h3>
            <div className="space-y-3">
              {PRESET_CHARACTERS.map((preset, idx) => {
                const isAdded = characters.some(c => c.name.split(" ")[0] === preset.name.split(" ")[0]);
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800/60 justify-between">
                    <div className="flex items-center gap-3">
                      <img 
                        src={preset.referenceImageUrl} 
                        alt={preset.name} 
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover border border-slate-800"
                      />
                      <div>
                        <h4 className="text-xs font-semibold text-white">{preset.name}</h4>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{preset.description}</p>
                      </div>
                    </div>
                    <button
                      disabled={isAdded}
                      onClick={() => handleAddPreset(preset)}
                      className={`p-1.5 rounded-lg transition-all ${
                        isAdded 
                          ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                          : "bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-white"
                      }`}
                    >
                      {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right List: Saved Characters and Reference Prompt cards */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center justify-between">
              <span>คลังหน้าตัวละครหลักที่ล็อคไว้ ({characters.length} ตัวละคร)</span>
            </h3>

            {characters.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                <User className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-300 font-medium">ยังไม่มีตัวละครในคลัง</p>
                <p className="text-slate-500 text-xs mt-1">กรอกฟอร์มเพิ่มหรือเพิ่มจากพรีเซ็ต เพื่อเริ่มล็อกหน้าตัวละคร</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {characters.map((char) => {
                  const isSelected = selectedCharacterId === char.id;
                  return (
                    <div 
                      key={char.id} 
                      onClick={() => onSelectCharacter(char)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? "bg-sky-950/30 border-sky-500/80 shadow-lg shadow-sky-500/5" 
                          : "bg-slate-950 border-slate-800 hover:border-sky-500/30"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <img 
                            src={char.referenceImageUrl} 
                            alt={char.name} 
                            referrerPolicy="no-referrer"
                            className="w-14 h-14 rounded-xl object-cover border border-slate-800"
                          />
                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                              {char.name}
                              {isSelected && <span className="text-[10px] bg-sky-500 text-white px-1.5 py-0.25 rounded">กำลังเลือก</span>}
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">{char.gender} • อายุ {char.age}</p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-slate-300"><span className="text-slate-500 font-medium">แต่งตัว:</span> {char.attire}</p>
                          <p className="text-xs text-slate-300 line-clamp-2"><span className="text-slate-500 font-medium">นิสัย:</span> {char.description}</p>
                        </div>
                      </div>

                      {/* Display Cref recipe */}
                      <div className="mt-4 pt-3 border-t border-slate-900/80">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5">
                          <span className="font-mono text-sky-400/80">Character Reference Command:</span>
                        </div>
                        <div className="bg-slate-900/80 border border-slate-800/40 rounded p-2 text-[10px] font-mono text-slate-400 select-all break-all leading-tight">
                          --cref {char.referenceImageUrl.slice(0, 45)}...
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

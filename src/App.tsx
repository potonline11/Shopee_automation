import React, { useState, useEffect, useRef } from "react";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  FileText, 
  Play, 
  Settings, 
  Activity, 
  CloudLightning, 
  Tv 
} from "lucide-react";
import { ShopeeProduct, Character, Script, PipelineTask, AppConfig, PipelineLog } from "./types";
import { getSafeRecommendedVideoUrl, getSafePublicOrigin } from "./utils";
import DashboardTab from "./components/DashboardTab";
import ShopeeConverterTab from "./components/ShopeeConverterTab";
import CharacterHubTab from "./components/CharacterHubTab";
import ScriptwriterTab from "./components/ScriptwriterTab";
import AutomationTab from "./components/AutomationTab";
import SettingsTab from "./components/SettingsTab";

const INITIAL_PRODUCTS: ShopeeProduct[] = [
  {
    id: "p1",
    name: "พัดลมพกพามินิ เทอร์โบชาร์จ ลมแรงสะใจ 100 ระดับ",
    originalUrl: "https://shopee.co.th/product/12345/987654",
    affiliateUrl: "https://shope.ee/route?url=https%3A%2F%2Fshopee.co.th%2Fproduct%2F12345%2F987654&partner=15324930078",
    price: "฿299",
    category: "เครื่องใช้ไฟฟ้าขนาดเล็ก",
    imageUrl: "https://images.unsplash.com/photo-1618944847023-38aa001275ff?w=400&auto=format&fit=crop&q=60",
    rating: 4.9
  },
  {
    id: "p2",
    name: "เครื่องตัดขุยผ้าไฟฟ้าอัจฉริยะ คืนชีพเสื้อตัวโปรดใน 3 วินาที",
    originalUrl: "https://shopee.co.th/product/43210/111222",
    affiliateUrl: "https://shope.ee/route?url=https%3A%2F%2Fshopee.co.th%2Fproduct%2F43210%2F111222&partner=15324930078",
    price: "฿189",
    category: "ของใช้ในบ้าน",
    imageUrl: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400&auto=format&fit=crop&q=60",
    rating: 4.8
  }
];

const INITIAL_CHARACTERS: Character[] = [
  {
    id: "char_1",
    name: "สมชาย (Somchai)",
    age: "32 ปี",
    gender: "ชาย (Male)",
    description: "หนุ่มออฟฟิศจอมซุ่มซ่าม ขี้ตกใจ หน้าตาตลกแต่จริงใจ มีปัญหาสารพัดเรื่องในชีวิตประจำวัน",
    attire: "เสื้อโปโลสีเหลืองสดใส กางเกงสแล็กสีดำ",
    referencePrompt: "A close-up high-quality portrait of Somchai, a 32-year-old Thai salaryman with expressive comically worried face, tidy black hair, wearing a vibrant yellow polo shirt, studio cinematic light, hyper-stable facial features, 1:1 aspect ratio.",
    referenceImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "char_2",
    name: "พลอย (Ploy)",
    age: "26 ปี",
    gender: "หญิง (Female)",
    description: "บิวตี้บล็อกเกอร์สาวสายหรูหรา รักความเป๊ะ ทนเห็นอะไรสกปรกหรือมีขุยไม่ได้แม้แต่นิดเดียว",
    attire: "เสื้อคาร์ดิแกนถักสีชมพูพาสเทล ต่างหูมุกหรู",
    referencePrompt: "A close-up premium portrait of Ploy, a 26-year-old stylish Thai woman with sleek long black hair, perfect makeup, carrying an elegant annoyed expression, wearing a pastel pink cardigan, soft professional studio lighting, 1:1 aspect ratio.",
    referenceImageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=60"
  }
];

const INITIAL_CONFIG: AppConfig = {
  shopeePartnerId: "15324930078",
  openaiKey: "",
  leonardoKey: "",
  runwayKey: "",
  elevenlabsKey: "",
  makeWebhookUrl: "https://hook.us1.make.com/abcdefg12345",
  makeWebhookApiKey: "",
  autoPilotEnabled: true,
  frequencyHours: 6
};

const getUpdatedAffiliateUrl = (product: ShopeeProduct, partnerId: string): string => {
  if (!product) return "";
  const pid = partnerId || "15324930078";
  
  // If originalUrl is already a short link like shope.ee or s.shopee.co.th, route it using redirect helper
  if (product.originalUrl.includes("shope.ee") || product.originalUrl.includes("s.shopee") || !product.originalUrl.includes("shopee.co.th")) {
    return `https://shope.ee/route?url=${encodeURIComponent(product.originalUrl)}&partner=${pid}`;
  }

  try {
    const urlObj = new URL(product.originalUrl);
    urlObj.searchParams.set("utm_campaign", "shopee_ai_automation");
    urlObj.searchParams.set("utm_medium", "affiliates");
    urlObj.searchParams.set("utm_source", `an_id_${pid}`);
    urlObj.searchParams.set("af_siteid", pid);
    return urlObj.toString();
  } catch (e) {
    return `https://shope.ee/route?url=${encodeURIComponent(product.originalUrl)}&partner=${pid}`;
  }
};

const getRecommendedVideoUrl = (productName: string, category: string = ""): string => {
  return getSafeRecommendedVideoUrl(productName, category);
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [lastAutoRunTime, setLastAutoRunTime] = useState<string | undefined>(undefined);
  const [products, setProducts] = useState<ShopeeProduct[]>(() => {
    try {
      const saved = localStorage.getItem("shopee_ai_products");
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch (e) {
      return INITIAL_PRODUCTS;
    }
  });
  const [characters, setCharacters] = useState<Character[]>(() => {
    try {
      const saved = localStorage.getItem("shopee_ai_characters");
      return saved ? JSON.parse(saved) : INITIAL_CHARACTERS;
    } catch (e) {
      return INITIAL_CHARACTERS;
    }
  });
  const [scripts, setScripts] = useState<Script[]>(() => {
    try {
      const saved = localStorage.getItem("shopee_ai_scripts");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [tasks, setTasks] = useState<PipelineTask[]>(() => {
    try {
      const saved = localStorage.getItem("shopee_ai_tasks");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem("shopee_ai_config");
      return saved ? JSON.parse(saved) : INITIAL_CONFIG;
    } catch (e) {
      return INITIAL_CONFIG;
    }
  });

  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(() => products[0]?.id);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | undefined>(() => characters[0]?.id);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastSyncedStateRef = useRef<string>("");

  // 1. Load state from backend on mount
  useEffect(() => {
    fetch("/api/get-state")
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.products && data.products.length > 0) setProducts(data.products);
          if (data.characters && data.characters.length > 0) setCharacters(data.characters);
          if (data.scripts && data.scripts.length > 0) setScripts(data.scripts);
          if (data.tasks && data.tasks.length > 0) setTasks(data.tasks);
          if (data.config) setConfig(data.config);
          if (data.lastAutoRunTime) setLastAutoRunTime(data.lastAutoRunTime);

          // Seed reference string to prevent instant duplicate save-state write back on load
          lastSyncedStateRef.current = JSON.stringify({
            products: data.products || [],
            characters: data.characters || [],
            scripts: data.scripts || [],
            tasks: data.tasks || [],
            config: data.config || INITIAL_CONFIG
          });
        }
        setIsLoaded(true);
      })
      .catch(err => {
        console.error("Error loading state from server:", err);
        setIsLoaded(true);
      });
  }, []);

  // 2. Periodically poll state from backend to synchronize offline background postings
  useEffect(() => {
    const hasActiveTask = tasks.some(t => t.status === "processing");
    const intervalTime = hasActiveTask ? 3000 : 15000;

    const interval = setInterval(() => {
      fetch("/api/get-state")
        .then(res => res.json())
        .then(data => {
          if (data) {
            if (data.tasks) setTasks(data.tasks);
            if (data.products && data.products.length > 0) setProducts(data.products);
            if (data.characters && data.characters.length > 0) setCharacters(data.characters);
            if (data.lastAutoRunTime) setLastAutoRunTime(data.lastAutoRunTime);
            if (data.config) setConfig(data.config);

            // Seed reference state so that the upcoming save-state useEffect realizes there is no actual user modification
            lastSyncedStateRef.current = JSON.stringify({
              products: data.products || products,
              characters: data.characters || characters,
              scripts: data.scripts || scripts,
              tasks: data.tasks || tasks,
              config: data.config || config
            });
          }
        })
        .catch(err => console.error("Error polling state from server:", err));
    }, intervalTime);

    return () => clearInterval(interval);
  }, [products, characters, scripts, tasks, config]);

  // Unified synchronized state saving with debounce and collision control
  useEffect(() => {
    // Write local storage immediately (cheap & client-safe)
    localStorage.setItem("shopee_ai_products", JSON.stringify(products));
    localStorage.setItem("shopee_ai_characters", JSON.stringify(characters));
    localStorage.setItem("shopee_ai_scripts", JSON.stringify(scripts));
    localStorage.setItem("shopee_ai_tasks", JSON.stringify(tasks));
    localStorage.setItem("shopee_ai_config", JSON.stringify(config));

    if (!isLoaded) return;

    const currentPayload = { products, characters, scripts, tasks, config };
    const currentSerialized = JSON.stringify(currentPayload);

    // Skip redundant network transmission if the client state is unchanged from server representation
    if (currentSerialized === lastSyncedStateRef.current) {
      return;
    }

    const handler = setTimeout(() => {
      // Optimistically update reference before executing fetch to lock concurrent keystrokes
      lastSyncedStateRef.current = currentSerialized;

      fetch("/api/save-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: currentSerialized
      })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          console.warn("Failed to sync state to server:", data);
        }
      })
      .catch(err => {
        console.error("Error syncing state to server:", err);
      });
    }, 1000); // 1-second debounce buffer to pack quick changes

    return () => clearTimeout(handler);
  }, [products, characters, scripts, tasks, config, isLoaded]);

  const handleAddProduct = (newProduct: ShopeeProduct) => {
    setProducts(prev => {
      if (prev.some(p => p.id === newProduct.id)) {
        return prev.map(p => p.id === newProduct.id ? newProduct : p);
      }
      return [newProduct, ...prev];
    });
    setSelectedProductId(newProduct.id);
  };

  const handleSelectProductFromConverter = (product: ShopeeProduct) => {
    setSelectedProductId(product.id);
    setActiveTab("scriptwriter");
  };

  const handleAddCharacter = (newCharacter: Character) => {
    setCharacters(prev => {
      if (prev.some(c => c.id === newCharacter.id)) {
        return prev.map(c => c.id === newCharacter.id ? newCharacter : c);
      }
      return [newCharacter, ...prev];
    });
    setSelectedCharacterId(newCharacter.id);
  };

  const handleSelectCharacterFromHub = (character: Character) => {
    setSelectedCharacterId(character.id);
    setActiveTab("scriptwriter");
  };

  const handleAddScript = (newScript: Script) => {
    setScripts(prev => {
      if (prev.some(s => s.id === newScript.id)) {
        return prev.map(s => s.id === newScript.id ? newScript : s);
      }
      return [newScript, ...prev];
    });
  };

  const triggerPipelineSimulate = (specificScript: Script | null, customVideoUrl?: string) => {
    // 1. Resolve product, character and script
    let scriptToUse: Script | null = specificScript;
    if (!scriptToUse && scripts.length > 0) {
      scriptToUse = scripts[0];
    }
    
    const linkedProduct = products.find(p => p.id === (scriptToUse?.productId || "")) || products[0];
    const linkedChar = characters.find(c => c.id === (scriptToUse?.characterId || "")) || characters[0];

    if (!linkedProduct || !linkedChar) {
      console.warn("No active product or character to run pipeline.");
      return;
    }

    // Call the progressive multi-stage backend pipeline!
    fetch("/api/trigger-pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: linkedProduct.id,
        characterId: linkedChar.id,
        scriptId: scriptToUse?.id || null,
        script: scriptToUse
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Optimistically trigger an immediate fetch to retrieve the newly created processing task and show it!
        fetch("/api/get-state")
          .then(res => res.json())
          .then(serverData => {
            if (serverData.tasks) {
              setTasks(serverData.tasks);
            }
          });
      } else {
        console.error("Failed to trigger progressive pipeline:", data.error);
      }
    })
    .catch(err => {
      console.error("Network error triggering progressive pipeline:", err);
    });

    setActiveTab("pipeline");
  };

  const handleClearHistory = () => {
    setTasks([]);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-100 overflow-hidden">
      {/* 1. Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between select-none">
        <div>
          {/* Logo Brand Header */}
          <div className="p-6 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="bg-orange-500 text-white p-2 rounded-xl shadow-lg shadow-orange-500/15">
                <CloudLightning className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-wide">Shopee Automator</h1>
                <p className="text-[10px] text-orange-400 font-semibold font-mono">PARTNER 24H PIPELINE</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "dashboard" 
                  ? "bg-slate-800 text-white shadow-inner" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>แดชบอร์ดสรุปงาน</span>
            </button>

            <button
              onClick={() => setActiveTab("converter")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "converter" 
                  ? "bg-slate-800 text-white shadow-inner" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Shopee Converter</span>
            </button>

            <button
              onClick={() => setActiveTab("characters")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "characters" 
                  ? "bg-slate-800 text-white shadow-inner" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>คลังภาพและล็อกหน้า</span>
            </button>

            <button
              onClick={() => setActiveTab("scriptwriter")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "scriptwriter" 
                  ? "bg-slate-800 text-white shadow-inner" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>เขียนบทวิดีโอ (Gemini)</span>
            </button>

            <button
              onClick={() => setActiveTab("pipeline")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "pipeline" 
                  ? "bg-slate-800 text-white shadow-inner" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>ท่อระบบอัตโนมัติ</span>
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "settings" 
                  ? "bg-slate-800 text-white shadow-inner" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>ตั้งค่าระบบ API</span>
            </button>
          </nav>
        </div>

        {/* Footer Status Panel */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/20">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/40">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">ระบบรันปกติ (24H)</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">โมดูลเชื่อมต่อ: Make.com Active</p>
            <p className="text-[10px] text-slate-500">ID แทร็กกิ้ง: {config.shopeePartnerId}</p>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Frame */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header toolbar */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 select-none">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-300 uppercase font-mono tracking-wider">
              {activeTab === "dashboard" && "Dashboard Overview"}
              {activeTab === "converter" && "Shopee Affiliate Converter"}
              {activeTab === "characters" && "AI Characters & Reference Lock"}
              {activeTab === "scriptwriter" && "AI Scriptwriter Storyboard"}
              {activeTab === "pipeline" && "AI Automation Pipeline Log"}
              {activeTab === "settings" && "System Settings Panel"}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs bg-slate-800 border border-slate-700/60 px-3 py-1 rounded-full text-slate-400 font-mono">
              UTC Local Time Tracker
            </span>
          </div>
        </header>

        {/* Scrollable workspace */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-950/40">
          {activeTab === "dashboard" && (
            <DashboardTab 
              tasks={tasks} 
              onTriggerPipeline={() => triggerPipelineSimulate(null)}
              onNavigateToTab={setActiveTab}
            />
          )}

          {activeTab === "converter" && (
            <ShopeeConverterTab 
              products={products}
              shopeePartnerId={config.shopeePartnerId}
              onAddProduct={handleAddProduct}
              onSelectProduct={handleSelectProductFromConverter}
            />
          )}

          {activeTab === "characters" && (
            <CharacterHubTab 
              characters={characters}
              onAddCharacter={handleAddCharacter}
              onSelectCharacter={handleSelectCharacterFromHub}
              selectedCharacterId={selectedCharacterId}
            />
          )}

          {activeTab === "scriptwriter" && (
            <ScriptwriterTab 
              characters={characters}
              products={products}
              selectedCharacterId={selectedCharacterId}
              selectedProductId={selectedProductId}
              onSelectCharacter={setSelectedCharacterId}
              onSelectProduct={setSelectedProductId}
              onAddScript={handleAddScript}
              scripts={scripts}
              onTriggerMockPipelineWithScript={(script, videoUrl) => triggerPipelineSimulate(script, videoUrl)}
              config={config}
            />
          )}

          {activeTab === "pipeline" && (
            <AutomationTab 
              tasks={tasks}
              onTriggerPipeline={() => triggerPipelineSimulate(null)}
              onClearTasks={handleClearHistory}
              onDeleteTask={handleDeleteTask}
              config={config}
              lastAutoRunTime={lastAutoRunTime}
            />
          )}

          {activeTab === "settings" && (
            <SettingsTab 
              config={config}
              onSaveConfig={setConfig}
            />
          )}
        </div>
      </main>
    </div>
  );
}

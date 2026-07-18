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
    const interval = setInterval(() => {
      fetch("/api/get-state")
        .then(res => res.json())
        .then(data => {
          if (data) {
            if (data.tasks && data.tasks.length > 0) setTasks(data.tasks);
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
    }, 15000); // Poll every 15 seconds

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
    setProducts(prev => [newProduct, ...prev]);
    setSelectedProductId(newProduct.id);
  };

  const handleAddCharacter = (newChar: Character) => {
    setCharacters(prev => [newChar, ...prev]);
    setSelectedCharacterId(newChar.id);
  };

  const handleAddScript = (newScript: Script) => {
    setScripts(prev => [newScript, ...prev]);
  };

  const handleSelectProductFromConverter = (product: ShopeeProduct) => {
    setSelectedProductId(product.id);
    setActiveTab("scriptwriter");
  };

  const handleSelectCharacterFromHub = (char: Character) => {
    setSelectedCharacterId(char.id);
  };

  const triggerPipelineSimulate = (specificScript: Script | null, customVideoUrl?: string) => {
    // 1. Choose/create a script for reference
    let scriptToUse: Script;
    if (specificScript) {
      scriptToUse = specificScript;
    } else if (scripts.length > 0) {
      scriptToUse = scripts[0];
    } else {
      // Create a default mock script if none exists
      scriptToUse = {
        id: "script_def",
        title: "บทหักมุม: พัดลมพกพามาร่ายมนตร์สะกดใจ",
        productId: products[0]?.id || "p1",
        characterId: characters[0]?.id || "char_1",
        twistDescription: "สมชายคิดว่าผีสิงรถยนต์จนแอร์เสีย แต่จริงๆ รถไม่ได้แอร์เสีย แค่เขาลืมเปิดสวิตช์แอร์ แต่รอดด้วยพัดลมมินิ!",
        scenes: [],
        captions: "เรื่องราวของสมชายหนุ่มออฟฟิศขี้ร้อน...",
        tags: ["#shopee", "#shopeeaffiliate"]
      };
    }

    const linkedProduct = products.find(p => p.id === scriptToUse.productId) || products[0];
    const linkedChar = characters.find(c => c.id === scriptToUse.characterId) || characters[0];

    const dynamicAffiliateUrl = getUpdatedAffiliateUrl(linkedProduct, config.shopeePartnerId);
    const formattedDescription = `${scriptToUse.captions || ""}

--------------------------------------
📸 สนใจพิกัดสินค้าในคลิป สั่งซื้อได้ที่นี่เลยครับ 👇
👉 ${dynamicAffiliateUrl}

(รหัสพาร์ทเนอร์ Shopee: ${config.shopeePartnerId})
--------------------------------------

Tags: ${scriptToUse.tags?.map(t => t.startsWith("#") ? t : `#${t}`).join(" ") || ""}`;

    const rawTitle = scriptToUse?.title || "คลิปแนะนำสินค้าพาร์ทเนอร์ Shopee";
    // Guarantee a real non-empty title string is always set
    const finalTitle = (typeof rawTitle === "string" && rawTitle.trim().length > 0) 
      ? rawTitle 
      : "คลิปแนะนำสินค้าพาร์ทเนอร์ Shopee";
    const safeTitle = finalTitle.length > 90 ? finalTitle.substring(0, 87) + "..." : finalTitle;

    const taskId = "task_" + Date.now();
    
    const newTask: PipelineTask = {
      id: taskId,
      scriptTitle: safeTitle,
      productName: linkedProduct.name,
      status: "processing",
      progress: 5,
      currentStep: "กำลังเริ่มรวบรวมข้อมูลสินค้าพันธมิตร",
      logs: [
        {
          id: "log_1",
          timestamp: new Date().toLocaleTimeString(),
          step: "Trigger",
          message: `เริ่มต้นรันระบบอัตโนมัติ 24 ชม. ด้วยพาร์ทเนอร์ไอดี ${config.shopeePartnerId}`,
          type: "info"
        }
      ]
    };

    setTasks(prev => [newTask, ...prev]);
    setActiveTab("pipeline");

    // Ping the real Webhook API route!
    const videoUrlValue = customVideoUrl || getSafeRecommendedVideoUrl(linkedProduct.name, linkedProduct.category, config);
    
    const scenes = scriptToUse?.scenes || [];
    const s1 = (scenes[0] || {}) as any;
    const s2 = (scenes[1] || {}) as any;
    const s3 = (scenes[2] || {}) as any;
    const s4 = (scenes[3] || {}) as any;

    const flatScenesData = {
      scene1Url: s1.imageUrl || "",
      scene1_url: s1.imageUrl || "",
      scene1URL: s1.imageUrl || "",
      scene1_URL: s1.imageUrl || "",
      scene1ImageUrl: s1.imageUrl || "",
      scene1_image_url: s1.imageUrl || "",
      scene1ImageURL: s1.imageUrl || "",
      scene1_image_URL: s1.imageUrl || "",
      scene1Voiceover: s1.voiceover || "",
      scene1_voiceover: s1.voiceover || "",
      scene1Subtitle: s1.subtitle || "",
      scene1_subtitle: s1.subtitle || "",
      scene1Visual: s1.visualDescription || "",
      scene1_visual: s1.visualDescription || "",
      scene1VisualDescription: s1.visualDescription || "",
      scene1_visual_description: s1.visualDescription || "",
      scene1Prompt: s1.stableImagePrompt || "",
      scene1_prompt: s1.stableImagePrompt || "",
      scene1StableImagePrompt: s1.stableImagePrompt || "",
      scene1_stable_image_prompt: s1.stableImagePrompt || "",
      scene1Sound: s1.soundEffect || "",
      scene1_sound: s1.soundEffect || "",
      scene1SoundEffect: s1.soundEffect || "",
      scene1_sound_effect: s1.soundEffect || "",
      
      scene2Url: s2.imageUrl || "",
      scene2_url: s2.imageUrl || "",
      scene2URL: s2.imageUrl || "",
      scene2_URL: s2.imageUrl || "",
      scene2ImageUrl: s2.imageUrl || "",
      scene2_image_url: s2.imageUrl || "",
      scene2ImageURL: s2.imageUrl || "",
      scene2_image_URL: s2.imageUrl || "",
      scene2Voiceover: s2.voiceover || "",
      scene2_voiceover: s2.voiceover || "",
      scene2Subtitle: s2.subtitle || "",
      scene2_subtitle: s2.subtitle || "",
      scene2Visual: s2.visualDescription || "",
      scene2_visual: s2.visualDescription || "",
      scene2VisualDescription: s2.visualDescription || "",
      scene2_visual_description: s2.visualDescription || "",
      scene2Prompt: s2.stableImagePrompt || "",
      scene2_prompt: s2.stableImagePrompt || "",
      scene2StableImagePrompt: s2.stableImagePrompt || "",
      scene2_stable_image_prompt: s2.stableImagePrompt || "",
      scene2Sound: s2.soundEffect || "",
      scene2_sound: s2.soundEffect || "",
      scene2SoundEffect: s2.soundEffect || "",
      scene2_sound_effect: s2.soundEffect || "",
      
      scene3Url: s3.imageUrl || "",
      scene3_url: s3.imageUrl || "",
      scene3URL: s3.imageUrl || "",
      scene3_URL: s3.imageUrl || "",
      scene3ImageUrl: s3.imageUrl || "",
      scene3_image_url: s3.imageUrl || "",
      scene3ImageURL: s3.imageUrl || "",
      scene3_image_URL: s3.imageUrl || "",
      scene3Voiceover: s3.voiceover || "",
      scene3_voiceover: s3.voiceover || "",
      scene3Subtitle: s3.subtitle || "",
      scene3_subtitle: s3.subtitle || "",
      scene3Visual: s3.visualDescription || "",
      scene3_visual: s3.visualDescription || "",
      scene3VisualDescription: s3.visualDescription || "",
      scene3_visual_description: s3.visualDescription || "",
      scene3Prompt: s3.stableImagePrompt || "",
      scene3_prompt: s3.stableImagePrompt || "",
      scene3StableImagePrompt: s3.stableImagePrompt || "",
      scene3_stable_image_prompt: s3.stableImagePrompt || "",
      scene3Sound: s3.soundEffect || "",
      scene3_sound: s3.soundEffect || "",
      scene3SoundEffect: s3.soundEffect || "",
      scene3_sound_effect: s3.soundEffect || "",
      
      scene4Url: s4.imageUrl || "",
      scene4_url: s4.imageUrl || "",
      scene4URL: s4.imageUrl || "",
      scene4_URL: s4.imageUrl || "",
      scene4ImageUrl: s4.imageUrl || "",
      scene4_image_url: s4.imageUrl || "",
      scene4ImageURL: s4.imageUrl || "",
      scene4_image_URL: s4.imageUrl || "",
      scene4Voiceover: s4.voiceover || "",
      scene4_voiceover: s4.voiceover || "",
      scene4Subtitle: s4.subtitle || "",
      scene4_subtitle: s4.subtitle || "",
      scene4Visual: s4.visualDescription || "",
      scene4_visual: s4.visualDescription || "",
      scene4VisualDescription: s4.visualDescription || "",
      scene4_visual_description: s4.visualDescription || "",
      scene4Prompt: s4.stableImagePrompt || "",
      scene4_prompt: s4.stableImagePrompt || "",
      scene4StableImagePrompt: s4.stableImagePrompt || "",
      scene4_stable_image_prompt: s4.stableImagePrompt || "",
      scene4Sound: s4.soundEffect || "",
      scene4_sound: s4.soundEffect || "",
      scene4SoundEffect: s4.soundEffect || "",
      scene4_sound_effect: s4.soundEffect || "",
    };

    const flatProductCharacterData = {
      productId: linkedProduct.id,
      productName: linkedProduct.name,
      product_name: linkedProduct.name,
      productPrice: linkedProduct.price,
      product_price: linkedProduct.price,
      productUrl: linkedProduct.originalUrl,
      productURL: linkedProduct.originalUrl,
      product_url: linkedProduct.originalUrl,
      product_URL: linkedProduct.originalUrl,
      productOriginalUrl: linkedProduct.originalUrl,
      product_original_url: linkedProduct.originalUrl,
      productAffiliateUrl: dynamicAffiliateUrl,
      product_affiliate_url: dynamicAffiliateUrl,
      affiliateUrl: dynamicAffiliateUrl,
      affiliateURL: dynamicAffiliateUrl,
      affiliate_url: dynamicAffiliateUrl,
      affiliate_URL: dynamicAffiliateUrl,
      productCategory: linkedProduct.category,
      product_category: linkedProduct.category,

      characterId: linkedChar.id,
      characterName: linkedChar.name,
      character_name: linkedChar.name,
      actorName: linkedChar.name,
      actor_name: linkedChar.name,
      characterAge: linkedChar.age,
      character_age: linkedChar.age,
      characterGender: linkedChar.gender,
      character_gender: linkedChar.gender,
      characterDescription: linkedChar.description,
      character_description: linkedChar.description,
      characterAttire: linkedChar.attire,
      character_attire: linkedChar.attire,
      characterImageUrl: linkedChar.referenceImageUrl || "",
      character_image_url: linkedChar.referenceImageUrl || "",
      characterImageURL: linkedChar.referenceImageUrl || "",
      character_image_URL: linkedChar.referenceImageUrl || "",
      referenceImageUrl: linkedChar.referenceImageUrl || "",
      reference_image_url: linkedChar.referenceImageUrl || "",
      referenceImageURL: linkedChar.referenceImageUrl || "",
      reference_image_URL: linkedChar.referenceImageUrl || "",
    };

    const flatVideoUrls = {
      videoUrl: videoUrlValue,
      videoURL: videoUrlValue,
      video_url: videoUrlValue,
      video_URL: videoUrlValue,
      url: videoUrlValue,
      URL: videoUrlValue,
      video: videoUrlValue,
      mediaUrl: videoUrlValue,
      mediaURL: videoUrlValue,
      media_url: videoUrlValue,
      media_URL: videoUrlValue,
      downloadUrl: videoUrlValue,
      downloadURL: videoUrlValue,
      download_url: videoUrlValue,
      download_URL: videoUrlValue,
      fileUrl: videoUrlValue,
      fileURL: videoUrlValue,
      file_url: videoUrlValue,
      file_URL: videoUrlValue,
    };

    const payload = {
      timestamp: new Date().toISOString(),
      partnerId: config.shopeePartnerId,
      ...flatVideoUrls,
      ...flatProductCharacterData,
      ...flatScenesData,
      formattedDescription: formattedDescription,
      scriptTitle: safeTitle,
      script_title: safeTitle,
      title: safeTitle, // Top-level key to maximize mapping compatibility
      scriptCaptions: scriptToUse?.captions || "",
      script_captions: scriptToUse?.captions || "",
      scriptTags: scriptToUse?.tags?.map(t => t.startsWith("#") ? t : `#${t}`).join(" ") || "",
      script_tags: scriptToUse?.tags?.map(t => t.startsWith("#") ? t : `#${t}`).join(" ") || "",
      product: {
        id: linkedProduct.id,
        name: linkedProduct.name,
        price: linkedProduct.price,
        originalUrl: linkedProduct.originalUrl,
        affiliateUrl: dynamicAffiliateUrl,
        category: linkedProduct.category,
      },
      character: {
        id: linkedChar.id,
        name: linkedChar.name,
        description: linkedChar.description,
        attire: linkedChar.attire,
        referenceImageUrl: linkedChar.referenceImageUrl || "",
        reference_image_url: linkedChar.referenceImageUrl || "",
        imageUrl: linkedChar.referenceImageUrl || "",
        image_url: linkedChar.referenceImageUrl || "",
      },
      script: {
        title: safeTitle,
        scriptTitle: safeTitle,
        script_title: safeTitle,
        twistDescription: scriptToUse?.twistDescription || "",
        scenes: scriptToUse?.scenes || [],
        captions: scriptToUse?.captions || "",
        formattedDescription: formattedDescription,
        tags: scriptToUse?.tags || [],
      },
      // Nested payload block for backward/forward compatibility
      payload: {
        ...flatVideoUrls,
        ...flatProductCharacterData,
        ...flatScenesData,
        formattedDescription: formattedDescription,
        scriptTitle: safeTitle,
        script_title: safeTitle,
        title: safeTitle,
      }
    };

    const isDirectUpload = config.uploadChannel === "youtube_direct";
    const apiEndpoint = isDirectUpload ? "/api/youtube/upload-manual" : "/api/trigger-webhook";
    const requestBody = isDirectUpload ? {
      videoUrl: videoUrlValue,
      title: safeTitle,
      description: formattedDescription,
      tags: scriptToUse?.tags || []
    } : {
      webhookUrl: config.makeWebhookUrl,
      webhookApiKey: config.makeWebhookApiKey,
      payload
    };

    fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    })
    .then(r => r.json())
    .then(data => {
      setTasks(currentTasks => {
        return currentTasks.map(task => {
          if (task.id === taskId) {
            let message = "";
            let logType: "success" | "warning" | "error" = "success";
            let taskStatus: "completed" | "failed" | "processing" = "completed";
            
            if (isDirectUpload) {
              if (data.success) {
                message = `✅ อัปโหลดวิดีโอ Shorts ตรงเข้า YouTube สำเร็จ! (รหัสวิดีโอ: ${data.data?.id || "N/A"}) - วีดีโอพร้อมแคปชันและลิงก์พาร์ทเนอร์ถูกเผยแพร่ไปเรียบร้อยแล้ว`;
                logType = "success";
                taskStatus = "completed";
              } else {
                message = `❌ อัปโหลดตรงเข้า YouTube ล้มเหลว: ${data.error || "เกิดข้อผิดพลาดในการเรียกใช้ Google YouTube API"}`;
                logType = "error";
                taskStatus = "failed";
              }
            } else {
              const isSimulated = data.simulated;
              const isSuccess = data.success !== false;
              
              if (!isSuccess) {
                let errorMsg = data.message || "เซิร์ฟเวอร์ปฏิเสธการร้องขอ";
                if (errorMsg.includes("401") || data.statusCode === 401) {
                  errorMsg += " (💡 คำแนะนำ: รหัส 401 หมายถึงไม่ได้รับอนุญาต เนื่องจากบน Make.com มีการตั้งค่า 'API keys' บังคับไว้ - วิธีแก้: ให้กรอกค่า API Key ของคุณในแท็บ 'ตั้งค่าระบบ API' ของเรา หรือลบ API Key 1 ออกในหน้าตั้งค่า Webhook บนเว็บ Make.com เพื่ออนุญาตการเชื่อมต่อ)";
                }
                message = `❌ เชื่อมต่อ Webhook ล้มเหลว: ${errorMsg}`;
                logType = "error";
                taskStatus = "failed";
              } else if (isSimulated) {
                message = "⚠️ ใช้ Webhook จำลอง (Simulation) - ระบบจะไม่ส่งข้อมูลขึ้น Make.com จริงจนกว่าจะกรอกลิงก์ Webhook ในหน้าตั้งค่า";
                logType = "warning";
                taskStatus = "completed";
              } else {
                message = `✅ ส่งข้อมูลเข้า Webhook สำเร็จ! (สถานะ ${data.statusCode || 200}) - ส่งชุดข้อมูลบทละครและพาร์ทเนอร์ไอดีไปรัน Scenario บน Make.com แล้ว`;
                logType = "success";
                taskStatus = "completed";
              }
            }

            const newLog: PipelineLog = {
              id: "log_webhook_" + Date.now() + Math.random(),
              timestamp: new Date().toLocaleTimeString(),
              step: isDirectUpload ? "YouTube Direct API" : "Make.com Webhook",
              message: message,
              type: logType
            };

            const publishingLog: PipelineLog = {
              id: "log_pub_" + Date.now() + Math.random(),
              timestamp: new Date().toLocaleTimeString(),
              step: "Publishing",
              message: taskStatus === "completed"
                ? (isDirectUpload ? "อัปโหลดไฟล์ Shorts เข้าสู่ช่อง YouTube สำเร็จ! ใส่แคปชัน และแปะลิงก์พันธมิตรเรียบร้อย" : "ส่งข้อมูลแคมเปญสคริปต์และลิงก์พาร์ทเนอร์เรียบร้อย")
                : "⚠️ การอัปโหลดเผยแพร่ล้มเหลว กรุณาตรวจสอบรายละเอียดจากล็อกการทำงาน",
              type: logType
            };

            return {
              ...task,
              progress: taskStatus === "completed" ? 100 : task.progress,
              status: taskStatus,
              currentStep: message,
              logs: [...task.logs, newLog, publishingLog]
            };
          }
          return task;
        });
      });
    })
    .catch(err => {
      setTasks(currentTasks => {
        return currentTasks.map(task => {
          if (task.id === taskId) {
            const errMessage = isDirectUpload 
              ? `❌ ล้มเหลวขณะเชื่อมต่อไปยัง YouTube API: ${err.message || err}`
              : `❌ ล้มเหลวขณะพยายามเชื่อมต่อไปยัง Webhook URL: ${err.message || err}`;
              
            const newLog: PipelineLog = {
              id: "log_webhook_err_" + Date.now() + Math.random(),
              timestamp: new Date().toLocaleTimeString(),
              step: isDirectUpload ? "YouTube Upload Error" : "Webhook Trigger Error",
              message: errMessage,
              type: "error"
            };
            return {
              ...task,
              status: "failed",
              currentStep: errMessage,
              logs: [...task.logs, newLog]
            };
          }
          return task;
        });
      });
    });

    // Sequence of steps to simulate real pipeline execution with visual logs
    // Excluding the final 100% "Publishing" step so it is set strictly by the actual API response outcome!
    const steps = [
      {
        progress: 15,
        step: "Affiliate Linker",
        message: `แปลงลิงก์สำเร็จ: ${linkedProduct.affiliateUrl}`,
        type: "success" as const,
        delay: 2000
      },
      {
        progress: 30,
        step: "AI Scriptwriter",
        message: `ส่งบทพูดภาษาไทยเข้าโมดูลคิดพล็อตหักมุม: "${scriptToUse.title}"`,
        type: "info" as const,
        delay: 4500
      },
      {
        progress: 45,
        step: "Character Lock",
        message: `ล็อกใบหน้าตัวละคร ${linkedChar.name} ผ่านตัวแปรอ้างอิง --cref [URL ภาพต้นแบบ] สำเร็จ`,
        type: "success" as const,
        delay: 7000
      },
      {
        progress: 60,
        step: "Video Generation",
        message: `ส่งภาพนิ่งเข้า Runway Gen-3 API สังเคราะห์อนิเมชั่นคลิปฉาก 1-4 สำเร็จเรียบร้อย`,
        type: "info" as const,
        delay: 10000
      },
      {
        progress: 75,
        step: "Audio Synthesis",
        message: `ส่งเสียงพากย์เข้า ElevenLabs API บันทึกไฟล์พากย์ไทยด้วยน้ำเสียงตื่นเต้นดึงอารมณ์สำเร็จ`,
        type: "success" as const,
        delay: 13000
      },
      {
        progress: 90,
        step: "Video Compositing",
        message: `รวมวิดีโอ, เสียงพากย์, เพลงประกอบ พร้อมเจาะสัดส่วน 9:16 และฝังซับไตเติลบนคลิปด้วย Shotstack CJS`,
        type: "info" as const,
        delay: 16000
      }
    ];

    steps.forEach((s) => {
      setTimeout(() => {
        setTasks(currentTasks => {
          return currentTasks.map(task => {
            if (task.id === taskId) {
              // If the actual API request finished early with a final state (completed or failed), DO NOT overwrite it with a lower-progress simulated step!
              if (task.status === "completed" || task.status === "failed") {
                return task;
              }
              const newLog: PipelineLog = {
                id: "log_" + Date.now() + Math.random(),
                timestamp: new Date().toLocaleTimeString(),
                step: s.step,
                message: s.message,
                type: s.type
              };
              return {
                ...task,
                progress: s.progress,
                currentStep: s.message,
                logs: [...task.logs, newLog]
              };
            }
            return task;
          });
        });
      }, s.delay);
    });
  };

  const handleClearHistory = () => {
    setTasks([]);
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

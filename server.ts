import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "50mb" }));

// Mount local static videos serving
app.use("/videos", express.static(path.join(process.cwd(), "public/videos")));

// Helper to update last known app url dynamically
function updateLastKnownUrl(req: express.Request) {
  try {
    let host = (req.headers["x-forwarded-host"] as string) || req.get("host");
    if (host) {
      // Skip local/development/invalid addresses to avoid breaking public webhook access
      if (
        host.includes("localhost") || 
        host.includes("127.0.0.1") || 
        host.includes("0.0.0.0") ||
        host.includes("null") ||
        host.includes("undefined")
      ) {
        return;
      }

      // Force HTTPS for all production/pre-release URLs as Make.com HTTP module requires secure https:// links
      const protocol = "https";
      let appUrl = `${protocol}://${host}`;
      
      // Keep the actual appUrl host (dev or pre-release) instead of forcing replacement to pre-release,
      // ensuring real-time testing and troubleshooting in Make.com works flawlessly on the active container.

      const state = loadServerState();
      if (!state.config) state.config = {};
      
      if (state.config.lastKnownAppUrl !== appUrl) {
        state.config.lastKnownAppUrl = appUrl;
        saveServerState(state);
        console.log(`[App URL Sync] Updated last known App URL to: ${appUrl}`);
      }
    }
  } catch (e) {
    console.error("Failed to update last known url:", e);
  }
}

// Ensure local sample video assets exist (fully self-contained local render stability)
async function ensureDefaultVideos() {
  const videosDir = path.join(process.cwd(), "public", "videos");
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }

  // Force one-time cleanup/redownload to replace old cartoon/animal/pig templates with real people
  const markerFile = path.join(videosDir, "real_people_videos_v4.txt");
  const forceOverwrite = !fs.existsSync(markerFile);

  if (forceOverwrite) {
    console.log("[Video Downloader] Cleaning up old video cache to make way for premium real-person templates...");
    const files = ["fan.mp4", "laundry.mp4", "phone.mp4", "beauty.mp4", "kitchen.mp4", "pet.mp4", "travel.mp4", "default.mp4"];
    for (const f of files) {
      const p = path.join(videosDir, f);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (e) {}
      }
    }
    try {
      fs.writeFileSync(markerFile, "v4_real_people_only", "utf-8");
    } catch (e) {}
  }

  const videoMappings = [
    { name: "fan.mp4", url: "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/one-by-one-person-detection.mp4" },
    { name: "laundry.mp4", url: "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/people-detection.mp4" },
    { name: "phone.mp4", url: "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/driver-action-recognition.mp4" },
    { name: "beauty.mp4", url: "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/head-pose-face-detection-female.mp4" },
    { name: "kitchen.mp4", url: "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/store-aisle-detection.mp4" },
    { name: "pet.mp4", url: "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/lost_and_found.mp4" },
    { name: "travel.mp4", url: "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/people-detection.mp4" },
    { name: "default.mp4", url: "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/one-by-one-person-detection.mp4" }
  ];

  for (const item of videoMappings) {
    const filePath = path.join(videosDir, item.name);
    if (!fs.existsSync(filePath)) {
      console.log(`[Video Downloader] Syncing real-person ${item.name} into local container storage...`);
      try {
        const res = await fetch(item.url);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
          console.log(`[Video Downloader] Successfully cached real-person ${item.name} locally.`);
        } else {
          console.error(`[Video Downloader] Failed download for ${item.name}: ${res.statusText}`);
        }
      } catch (err) {
        console.error(`[Video Downloader] Error fetching ${item.name}:`, err);
      }
    }
  }
}

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// 1. Convert link endpoint
app.post("/api/convert-link", (req, res) => {
  const { url, partnerId } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }
  const pid = partnerId || "15324930078";
  
  // Custom logic to convert to Shopee Affiliate URL
  // Real Shopee affiliate URLs follow patterns like: https://s.shopee.co.th/s/... or https://shope.ee/...
  // Here we do a deterministic simulation or try to build an affiliate routing format
  let affiliateUrl = url;
  try {
    const urlObj = new URL(url);
    // Append partner tracking parameter
    urlObj.searchParams.set("utm_campaign", "shopee_ai_automation");
    urlObj.searchParams.set("utm_medium", "affiliates");
    urlObj.searchParams.set("utm_source", `an_id_${pid}`);
    urlObj.searchParams.set("af_siteid", pid);
    affiliateUrl = urlObj.toString();
  } catch (e) {
    // If invalid URL, build a fallback
    affiliateUrl = `https://shope.ee/route?url=${encodeURIComponent(url)}&partner=${pid}`;
  }

  res.json({
    originalUrl: url,
    affiliateUrl: affiliateUrl,
    partnerId: pid,
    generatedAt: new Date().toISOString(),
  });
});

// 2. Generate script with twist plot endpoint using Gemini
app.post("/api/generate-script", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ 
      error: "Gemini API client is not initialized. Please ensure GEMINI_API_KEY is configured in Secrets." 
    });
  }

  const { product, character, tone, language = "Thai" } = req.body;

  if (!product || !character) {
    return res.status(400).json({ error: "Product and Character details are required" });
  }

  const systemInstruction = `You are an expert video director, viral copywriter, and professional screenwriter for YouTube Shorts, Instagram Reels, and TikTok.
Your specialty is writing highly engaging, story-driven 30-60 second vertical video scripts that feature a dramatic or humorous TWIST plot (หักมุม) at the end, which perfectly integrates a specific product as the key resolution or savior of the story.

STRICT CHARACTER & STYLE MANDATES (REAL PEOPLE ONLY):
- The character "${character.name}" MUST be treated as a REAL, PHYSICALLY REALISTIC human being (photorealistic portrait, real-world professional Thai man/woman).
- You are STRICTLY FORBIDDEN from writing any cartoon, anime, manga, Emi-T-Art, drawing, illustration, or sketch styles in your visual descriptions or image prompts.
- You are STRICTLY FORBIDDEN from including any animals, pigs, piglets, pets, or non-human entities. No pigs or piglets should ever be used or referenced.
- The generated stableImagePrompt for each scene MUST be a highly detailed English prompt for a photo generation tool, focusing on the real human character in a realistic environment (e.g. "A professional high-quality photo of a real Thai man named Somchai", "cinematic photo of a real Thai woman named Ploy", "8k photorealistic, no cartoon, no anime, no drawing").

The script MUST be written in Thai language as requested, but visual instructions can be in English.
The script MUST have exactly 4 scenes. Each scene should last around 5-8 seconds (total 20-30 seconds).

For each scene, you must provide:
1. Visual description (English): cinematic scene description.
2. Stable Image Prompt (English): A detailed image prompt optimized for Midjourney or Leonardo AI. It MUST include a Reference Image cue like "--cref character_face_ref" or specific character details to lock the face of the character "${character.name}" who is described as: ${character.description}, age ${character.age}, wearing ${character.attire}. Maintain consistent clothing, background style, and lighting. Include the terms "8k photorealistic photo, realistic human, real person, no cartoon, no drawings, no animals, no pigs".
3. Voiceover (Thai): The spoken narration or dialogue in Thai. It should sound energetic, emotional, and realistic.
4. Sound Effect & BGM (English): Specific SFX and background music descriptions.
5. Subtitle (Thai): Text overlays on screen in Thai.

The plot structure MUST be:
- Scene 1 (Setup): Set a highly relatable or dramatic situation for the character.
- Scene 2 (Rising Action / Conflict): The situation escalates or goes terribly wrong.
- Scene 3 (The Twist / Climax): A sudden, shocking, or funny turn of events.
- Scene 4 (Resolution with Product): The product is introduced as the perfect solution or explanation for the twist, leaving a lasting impression. Highly persuasive Call to Action (CTA) with the affiliate link in comments!

You MUST respond ONLY with a valid JSON object matching the requested schema. No markdown formatting outside the JSON, no explanation.`;

  const prompt = `Write a dramatic vertical video script with a twist plot for the following product and character:

PRODUCT:
- Name: ${product.name}
- Category: ${product.category}
- Price: ${product.price}
- Highlight Features: ${product.description || "High quality utility product"}

CHARACTER:
- Name: ${character.name}
- Age: ${character.age}
- Gender: ${character.gender}
- Appearance & Clothes: ${character.attire}
- Personality/Vibe: ${character.description}

Tone of video: ${tone || "Dramatic, comedic twist, fast-paced"}
Language of voiceover & subtitles: ${language}

Generate the JSON response containing 'title', 'twistDescription', 'scenes' (array of 4 scenes with sceneNumber, visualDescription, stableImagePrompt, voiceover, soundEffect, subtitle, duration), 'captions', and 'tags' (array of strings).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "twistDescription", "scenes", "captions", "tags"],
          properties: {
            title: { type: Type.STRING },
            twistDescription: { type: Type.STRING },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["sceneNumber", "visualDescription", "stableImagePrompt", "voiceover", "soundEffect", "subtitle", "duration"],
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  visualDescription: { type: Type.STRING },
                  stableImagePrompt: { type: Type.STRING },
                  voiceover: { type: Type.STRING },
                  soundEffect: { type: Type.STRING },
                  subtitle: { type: Type.STRING },
                  duration: { type: Type.INTEGER },
                },
              },
            },
            captions: { type: Type.STRING },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
    });

    const text = response.text || "{}";
    const scriptData = JSON.parse(text.trim());
    res.json(scriptData);
  } catch (error: any) {
    console.warn("[API] Gemini generateContent failed. Falling back to robust dynamic script generation:", error.message);
    const pName = product?.name || "สินค้าอัจฉริยะ";
    const cName = character?.name || "สมชาย";
    const fallbackScript = {
      title: `เรื่องราวหักมุมแบบคาดไม่ถึงของ ${cName} กับ ${pName}`,
      twistDescription: `${cName} คิดว่าเกือบแย่แล้วในสถานการณ์สุดบีบคั้น แต่กลับมาคลี่คลายด้วยของใช้แนะนำพาร์ทเนอร์อย่าง ${pName}`,
      scenes: [
        {
          sceneNumber: 1,
          visualDescription: `A photorealistic photo of a real Thai person named ${cName} facing a tough day.`,
          stableImagePrompt: `8k photorealistic photo, real Thai person named ${cName}, looking dramatic, vertical 9:16 --cref character_face_ref`,
          voiceover: `ชีวิตของ ${cName} กำลังวุ่นวายสุดๆ แอร์รถเสีย ร้อนก็ร้อน งานก็เข้าถมเถจนหัวจะปวด!`,
          soundEffect: "Heavy dramatic sigh, traffic noise background",
          subtitle: `ชีวิตของ ${cName} กำลังวุ่นวายจนหัวจะปวด...`,
          duration: 6
        },
        {
          sceneNumber: 2,
          visualDescription: `A high quality dramatic photo of ${cName} experiencing a funny escalation.`,
          stableImagePrompt: `8k photorealistic photo, real Thai person named ${cName} in a humorous daily life crisis, vertical 9:16 --cref character_face_ref`,
          voiceover: `แถมน้ำดื่มก็หมด ลืมหยิบกระเป๋าสตางค์มาอีก วันนี้มันวันโลกแตกชัดๆ!`,
          soundEffect: "Funny record scratch, slide whistle sound",
          subtitle: `แถมน้ำหมดลืมกระเป๋าสตางค์ วันโลกแตกชัดๆ!`,
          duration: 7
        },
        {
          sceneNumber: 3,
          visualDescription: `A close up photo of ${cName} with a look of sudden realization.`,
          stableImagePrompt: `8k photorealistic photo, real Thai person named ${cName} with wide eyes of surprise, vertical 9:16 --cref character_face_ref`,
          voiceover: `แต่ทว่า... พอค้นใต้เบาะรถกลับเจอสุดยอดอุปกรณ์ผู้ช่วยชีวิตกู้ภัยพิบัติร้อนจัด!`,
          soundEffect: "Suspense roll, angels singing chord BGM",
          subtitle: `แต่พอค้นใต้เบาะกลับเจอสุดยอดผู้ช่วยชีวิต!`,
          duration: 6
        },
        {
          sceneNumber: 4,
          visualDescription: `A beautiful photo of ${cName} smiling happily while using ${pName}.`,
          stableImagePrompt: `8k photorealistic photo, real Thai person named ${cName} holding and using ${pName} happily, warm cozy room, vertical 9:16 --cref character_face_ref`,
          voiceover: `มันคือ ${pName} พกพาตัวนี้นี่เอง! ลมแรงเย็นสะใจหายเหนื่อยเป็นปลิดทิ้ง พิกัดสั่งซื้ออยู่ในคอมเมนต์นะครับ กดเลย!`,
          soundEffect: "Upbeat cheerful synth pop music ending, notification pop",
          subtitle: `เย็นสะใจด้วย ${pName}! พิกัดช้อปปิ้งอยู่ใต้คอมเมนต์เลย 👇`,
          duration: 8
        }
      ],
      captions: `เมื่อชีวิตของ ${cName} ถึงจุดสุดทน! แต่รอดตายแบบพลิกโผด้วยอุปกรณ์สุดคุ้มชิ้นนี้... ${pName} ยอดนิยมในราคาแสนพิเศษ กดลิงก์พาร์ทเนอร์ในเม้นเลยคราบบบ 🌟`,
      tags: ["shopee", "shopeeaffiliate", "รีวิวสินค้า", "ใช้ดีบอกต่อ", "ของมันต้องมี"]
    };
    res.json(fallbackScript);
  }
});

// 3. Generate AI character face base64 image endpoint using Gemini
app.post("/api/generate-face", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ 
      error: "Gemini API client is not initialized. Please configure GEMINI_API_KEY in Secrets." 
    });
  }

  const { description, gender, age, attire } = req.body;
  
  const prompt = `A highly detailed professional portrait photograph of a ${gender || "Thai person"}, age ${age || "25"}, looking directly into the camera. Appearance: ${description || "natural smile"}. Wearing: ${attire || "casual shirt"}. Photorealistic, cinematic lighting, studio background, shallow depth of field, high-end commercial style, extremely stable features, 1:1 aspect ratio.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    let base64Image = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (base64Image) {
      res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
    } else {
      throw new Error("No image data returned from Gemini");
    }
  } catch (error: any) {
    console.warn("Gemini image generation failed or requires paid tier. Falling back to styled placeholder.", error.message);
    
    // Premium custom real-person photo fallback based on attributes (Absolutely no animals or pigs)
    const seed = Math.floor(Math.random() * 1000);
    const genderTerm = (gender || "person").toLowerCase();
    const isFemale = genderTerm.includes("female") || genderTerm.includes("หญิง") || genderTerm.includes("ผู้หญิง");
    
    // Curated high-quality professional human portraits (matching Plooy/Somchai/Auntie Daeng style)
    const femalePortraits = [
      "photo-1534528741775-53994a69daeb", // Ploy (working woman portrait)
      "photo-1573496359142-b8d87734a5a2", // working woman
      "photo-1580489944761-15a19d654956", // smiling professional woman
      "photo-1544005313-94ddf0286df2"  // Auntie Daeng style portrait
    ];
    const malePortraits = [
      "photo-1507003211169-0a1dd7228f2d", // Somchai (salaryman portrait)
      "photo-1500648767791-00dcc994a43e", // smiling man
      "photo-1519085360753-af0119f7cbe7", // corporate gentleman
      "photo-1506794778202-cad84cf45f1d"  // classic portrait
    ];

    const portraitList = isFemale ? femalePortraits : malePortraits;
    const chosenId = portraitList[seed % portraitList.length];
    const fallbackUrl = `https://images.unsplash.com/${chosenId}?w=500&auto=format&fit=crop&q=80&sig=${seed}`;

    res.json({ 
      imageUrl: fallbackUrl,
      isFallback: true,
      message: "Generated fallback high-quality portrait due to API quota or configuration."
    });
  }
});

// 3.5. Generate AI Scene Image based on Stable Image Prompt
app.post("/api/generate-scene-image", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ 
      error: "Gemini API client is not initialized. Please configure GEMINI_API_KEY in Secrets." 
    });
  }

  const { prompt, productName } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  // Ensure prompt emphasizes real person (absolutely no cartoons, no pigs)
  const modifiedPrompt = `${prompt}. Focus on a real human, photorealistic portrait or scene, cinematic lighting, vertical framing, high quality, 9:16 aspect ratio. Absolutely no drawing, no cartoon, no anime, no pigs, no animals.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: {
        parts: [
          {
            text: modifiedPrompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "9:16",
        },
      },
    });

    let base64Image = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (base64Image) {
      res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
    } else {
      throw new Error("No image data returned from Gemini");
    }
  } catch (error: any) {
    console.warn("Scene image generation failed or requires paid tier. Falling back to styled placeholder.", error.message);

    // Curated high-quality, product-matched fallback based on keywords
    const cleanPrompt = prompt.toLowerCase();
    const cleanProduct = (productName || "").toLowerCase();
    
    let keywords = "office,people";
    const seed = Math.floor(Math.random() * 1000);
    
    if (cleanProduct.includes("fan") || cleanProduct.includes("พัดลม") || cleanPrompt.includes("fan") || cleanPrompt.includes("wind") || cleanPrompt.includes("sweat") || cleanPrompt.includes("hot") || cleanPrompt.includes("cool") || cleanPrompt.includes("turbo")) {
      keywords = "sweaty,person,hot,electric fan";
    } else if (cleanProduct.includes("laundry") || cleanProduct.includes("ผ้า") || cleanPrompt.includes("laundry") || cleanPrompt.includes("clothes") || cleanPrompt.includes("wash") || cleanPrompt.includes("fold")) {
      keywords = "housework,laundry,washing machine";
    } else if (cleanProduct.includes("phone") || cleanProduct.includes("มือถือ") || cleanPrompt.includes("phone") || cleanPrompt.includes("smartphone") || cleanPrompt.includes("call") || cleanPrompt.includes("screen")) {
      keywords = "holding phone,typing smartphone";
    } else if (cleanProduct.includes("beauty") || cleanProduct.includes("ครีม") || cleanPrompt.includes("beauty") || cleanPrompt.includes("makeup") || cleanPrompt.includes("skin") || cleanPrompt.includes("face") || cleanPrompt.includes("cosmetics")) {
      keywords = "woman,skincare,makeup";
    } else if (cleanProduct.includes("kitchen") || cleanProduct.includes("ครัว") || cleanPrompt.includes("kitchen") || cleanPrompt.includes("cook") || cleanPrompt.includes("food") || cleanPrompt.includes("pan") || cleanPrompt.includes("stove")) {
      keywords = "cooking kitchen,baking chef";
    } else if (cleanProduct.includes("pet") || cleanProduct.includes("สัตว์") || cleanPrompt.includes("pet") || cleanPrompt.includes("dog") || cleanPrompt.includes("cat") || cleanPrompt.includes("animal")) {
      keywords = "playing dog,happy pet";
    } else if (cleanProduct.includes("travel") || cleanProduct.includes("เที่ยว") || cleanPrompt.includes("travel") || cleanPrompt.includes("trip") || cleanPrompt.includes("car") || cleanPrompt.includes("outdoor") || cleanPrompt.includes("backpack")) {
      keywords = "traveler,hiking outdoors";
    } else {
      const words = cleanPrompt.replace(/[^\w\s]/g, "").split(/\s+/).filter((w: string) => w.length > 4 && w !== "photo" && w !== "photorealistic" && w !== "realistic" && w !== "person" && w !== "woman" && w !== "thai");
      if (words.length > 0) {
        keywords = words.slice(0, 3).join(",");
      }
    }

    // Build nice 9:16 fallback Unsplash URL
    const fallbackUrl = `https://images.unsplash.com/featured/540x960/?${encodeURIComponent(keywords)}&sig=${seed}`;

    res.json({ 
      imageUrl: fallbackUrl,
      isFallback: true,
      message: "Generated fallback high-quality scene image matching your story details."
    });
  }
});

// --- DIRECT YOUTUBE SHORTS UPLOAD AND OAUTH HANDLERS ---

async function getVideoBuffer(videoUrl: string): Promise<Buffer> {
  // Try local resolution first if the URL has a filename in /videos/ to avoid network overhead/loopback issues
  const videosMatch = videoUrl.match(/\/videos\/([a-zA-Z0-9_\-\.]+)/);
  if (videosMatch) {
    const videoName = videosMatch[1];
    const filePath = path.join(process.cwd(), "public", "videos", videoName);
    if (fs.existsSync(filePath)) {
      console.log(`[YouTube API] Bypassed HTTP fetch. Loading local video file directly: ${filePath}`);
      return fs.readFileSync(filePath);
    }
  }

  if (videoUrl.startsWith("http")) {
    console.log(`[YouTube API] Fetching video from remote URL: ${videoUrl}`);
    const res = await fetch(videoUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch video from URL: ${videoUrl}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    console.log(`[YouTube API] Fetched video from URL. Size: ${buf.length} bytes.`);
    return buf;
  } else {
    let cleanPath = videoUrl;
    if (cleanPath.startsWith("/")) {
      cleanPath = cleanPath.slice(1);
    }
    if (cleanPath.startsWith("public/")) {
      cleanPath = cleanPath.substring(7);
    }
    if (cleanPath.startsWith("videos/")) {
      cleanPath = cleanPath.substring(7);
    }
    const filePath = path.join(process.cwd(), "public", "videos", cleanPath);
    if (fs.existsSync(filePath)) {
      console.log(`[YouTube API] Loading local video file: ${filePath}`);
      return fs.readFileSync(filePath);
    } else {
      const defaultPath = path.join(process.cwd(), "public", "videos", "default.mp4");
      if (fs.existsSync(defaultPath)) {
        console.log(`[YouTube API] Video not found. Falling back to local default video: ${defaultPath}`);
        return fs.readFileSync(defaultPath);
      }
      throw new Error(`Local video file not found: ${filePath}`);
    }
  }
}

async function refreshYouTubeAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Client ID, Client Secret, or Refresh Token");
  }

  console.log("[YouTube OAuth] Attempting to refresh access token...");
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[YouTube OAuth] Token refresh failed:", errorText);
    throw new Error(`Failed to refresh Google OAuth token: ${errorText}`);
  }

  const data = await response.json();
  const newAccessToken = data.access_token;
  if (!newAccessToken) {
    throw new Error("No access token returned in refresh response");
  }

  const state = loadServerState();
  if (state.config) {
    state.config.youtubeAccessToken = newAccessToken;
    saveServerState(state);
    console.log("[YouTube OAuth] Successfully refreshed and saved new access token.");
  }

  return newAccessToken;
}

async function performYouTubeUpload(
  accessToken: string,
  videoBuffer: Buffer,
  title: string,
  description: string,
  tags: string[],
  privacyStatus: string
): Promise<any> {
  const boundary = "youtube_upload_boundary_multipart_" + Date.now();
  
  let cleanTitle = title || "Shopee AI Shorts";
  if (cleanTitle.length > 95) {
    cleanTitle = cleanTitle.substring(0, 92) + "...";
  }

  const metadata = {
    snippet: {
      title: cleanTitle,
      description: description || "Automated Shorts by Shopee AI Video Creator",
      tags: tags || [],
      categoryId: "22"
    },
    status: {
      privacyStatus: privacyStatus || "unlisted",
      selfDeclaredMadeForKids: false
    }
  };

  const part1Header = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`;
  const part1Body = JSON.stringify(metadata) + "\r\n";
  const part2Header = `--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`;
  const endBoundary = `\r\n--${boundary}--`;

  const payloadBuffer = Buffer.concat([
    Buffer.from(part1Header),
    Buffer.from(part1Body),
    Buffer.from(part2Header),
    videoBuffer,
    Buffer.from(endBoundary)
  ]);

  console.log(`[YouTube API] Uploading video to YouTube... Size: ${videoBuffer.length} bytes. Title: "${cleanTitle}"`);
  
  const response = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": payloadBuffer.length.toString()
    },
    body: payloadBuffer
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[YouTube API Error] Upload request failed with status: ${response.status}. Response:`, errorText);
    return {
      success: false,
      status: response.status,
      error: errorText
    };
  }

  const data = await response.json();
  console.log("[YouTube API Success] Video uploaded successfully. Video details:", JSON.stringify(data));
  return {
    success: true,
    data: data
  };
}

async function uploadToYouTubeDirect(
  videoUrl: string,
  title: string,
  description: string,
  tags: string[]
): Promise<any> {
  const state = loadServerState();
  const config = state.config || {};

  let accessToken = config.youtubeAccessToken;
  const refreshToken = config.youtubeRefreshToken;
  const clientId = config.youtubeClientId;
  const clientSecret = config.youtubeClientSecret;
  const privacyStatus = config.youtubeUploadPrivacy || "unlisted";

  if (!accessToken) {
    throw new Error("กรุณาเชื่อมต่อบัญชี YouTube (Google Login) ในหน้าตั้งค่าก่อนใช้งาน");
  }

  const videoBuffer = await getVideoBuffer(videoUrl);

  let result = await performYouTubeUpload(accessToken, videoBuffer, title, description, tags, privacyStatus);

  if (!result.success && result.status === 401 && refreshToken && clientId && clientSecret) {
    console.log("[YouTube Upload] Access token expired (401). Retrying with refreshed token...");
    try {
      const refreshedAccessToken = await refreshYouTubeAccessToken(clientId, clientSecret, refreshToken);
      result = await performYouTubeUpload(refreshedAccessToken, videoBuffer, title, description, tags, privacyStatus);
    } catch (refreshError: any) {
      console.error("[YouTube Upload] Token refresh retry failed:", refreshError);
      throw new Error(`การเชื่อมต่อ Google API หมดอายุ และรีเฟรชโทเค็นไม่สำเร็จ: ${refreshError.message}`);
    }
  }

  if (!result.success) {
    throw new Error(`Google API ตอบกลับด้วยข้อผิดพลาด (รหัส ${result.status}): ${result.error}`);
  }

  return result.data;
}

// OAuth Client URLs & Callback Routes
app.get("/api/youtube/auth-url", (req, res) => {
  const serverState = loadServerState();
  const config = serverState.config || {};

  const clientId = config.youtubeClientId;
  if (!clientId) {
    return res.status(400).json({ error: "กรุณากรอก Google Client ID ในหน้าการตั้งค่าและกดบันทึกก่อน" });
  }

  let host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
    access_type: "offline",
    prompt: "consent"
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url: authUrl });
});

app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
  const { code } = req.query;
  const serverState = loadServerState();
  const config = serverState.config || {};

  const clientId = config.youtubeClientId;
  const clientSecret = config.youtubeClientSecret;

  if (!clientId || !clientSecret) {
    return res.send(`
      <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; background: #111827; color: #f3f4f6; }
            .card { background: #1f2937; padding: 40px; border-radius: 12px; border: 1px solid #374151; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); }
            h2 { color: #f87171; }
            button { background: #e11d48; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 20px; }
            button:hover { background: #be123c; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>การตั้งค่าไม่สมบูรณ์</h2>
            <p>ไม่พบ Google Client ID หรือ Client Secret ในหน้าการตั้งค่า กรุณากรอกข้อมูลและบันทึกก่อนเชื่อมต่อ</p>
            <button onclick="window.close()">ปิดหน้าต่างนี้</button>
          </div>
        </body>
      </html>
    `);
  }

  try {
    let host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    const redirectUri = `${protocol}://${host}/auth/callback`;

    const params = new URLSearchParams({
      code: code as string,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      throw new Error(`Failed to exchange authorization code: ${errorText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    if (!accessToken) {
      throw new Error("No access token returned by Google OAuth");
    }

    const channelRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });

    let channelName = "เชื่อมต่อช่องแล้ว";
    if (channelRes.ok) {
      const channelData = await channelRes.json();
      if (channelData.items?.[0]?.snippet?.title) {
        channelName = channelData.items[0].snippet.title;
      }
    }

    config.youtubeAccessToken = accessToken;
    if (refreshToken) {
      config.youtubeRefreshToken = refreshToken;
    }
    config.youtubeChannelName = channelName;
    serverState.config = config;
    saveServerState(serverState);

    console.log(`[YouTube Direct] Connected successfully to channel: ${channelName}`);

    res.send(`
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #f8fafc; }
            .card { background: #1e293b; padding: 40px; border-radius: 12px; border: 1px solid #334155; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); }
            h2 { color: #10b981; }
            .channel { font-size: 1.25rem; font-weight: bold; margin: 20px 0; color: #38bdf8; background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #1e293b; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>เชื่อมต่อบัญชี YouTube สำเร็จ!</h2>
            <p>ยินดีด้วย! แอปเชื่อมต่อกับช่อง YouTube ของคุณเรียบร้อยแล้ว:</p>
            <div class="channel">📺 ${channelName}</div>
            <p>หน้าต่างนี้จะปิดลงโดยอัตโนมัติ...</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', channelName: '${channelName}' }, '*');
                setTimeout(() => window.close(), 1500);
              } else {
                setTimeout(() => { window.location.href = '/'; }, 1500);
              }
            </script>
          </div>
        </body>
      </html>
    `);

  } catch (error: any) {
    console.error("[YouTube OAuth Error]", error);
    res.send(`
      <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #f8fafc; }
            .card { background: #1e293b; padding: 40px; border-radius: 12px; border: 1px solid #dc2626; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); }
            h2 { color: #f87171; }
            pre { text-align: left; background: #0f172a; padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; border: 1px solid #334155; color: #cbd5e1; }
            button { background: #374151; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>เกิดข้อผิดพลาดในการเชื่อมต่อ</h2>
            <p>ไม่สามารถแลกเปลี่ยนโค้ดเพื่อรับ Access Token ได้:</p>
            <pre>${error.message || error}</pre>
            <button onclick="window.close()">ปิดหน้าต่างนี้เพื่อลองใหม่</button>
          </div>
        </body>
      </html>
    `);
  }
});

app.post("/api/youtube/upload-manual", async (req, res) => {
  const { videoUrl, title, description, tags } = req.body;
  if (!videoUrl) {
    return res.status(400).json({ error: "Video URL is required" });
  }

  try {
    const uploadResult = await uploadToYouTubeDirect(videoUrl, title, description, tags || []);
    res.json({
      success: true,
      message: "อัปโหลดวิดีโอ Shorts ไปที่ช่อง YouTube โดยตรงสำเร็จเรียบร้อยแล้ว!",
      data: uploadResult
    });
  } catch (err: any) {
    console.error("[YouTube Manual Upload Error]", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to upload video to YouTube"
    });
  }
});

// 4. Trigger Real Make.com or Zapier Webhook
app.post("/api/trigger-webhook", async (req, res) => {
  updateLastKnownUrl(req);
  const { webhookUrl, webhookApiKey, payload } = req.body;
  if (!webhookUrl) {
    return res.status(400).json({ error: "Webhook URL is required" });
  }

  console.log(`[Webhook Trigger] Sending to: ${webhookUrl}`);
  console.log(`[Webhook Trigger] Payload:`, JSON.stringify(payload, null, 2));

  // Check if it is a placeholder/mock URL
  if (webhookUrl.includes("abcdefg12345") || webhookUrl.includes("example.com")) {
    return res.json({
      success: true,
      simulated: true,
      message: "Detected demo webhook URL. Running in simulation mode."
    });
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (webhookApiKey) {
      headers["x-make-apikey"] = webhookApiKey;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      res.json({
        success: true,
        simulated: false,
        statusCode: response.status,
        message: "Successfully triggered real webhook scenario!"
      });
    } else {
      res.status(400).json({
        success: false,
        statusCode: response.status,
        message: `Webhook server responded with code ${response.status}`
      });
    }
  } catch (error: any) {
    console.error("Error sending webhook to Make.com:", error);
    res.status(500).json({
      success: false,
      message: `Failed to connect to Webhook URL: ${error.message || "Unknown connection error"}`
    });
  }
});

// --- FULL-STACK BACKGROUND AUTOPILOT SCHEDULER & STATE PERSISTENCE ---

// State file path for background persistence
const STATE_FILE = path.join(process.cwd(), "server_state.json");

interface ServerState {
  products: any[];
  characters: any[];
  scripts: any[];
  tasks: any[];
  config: any;
  lastAutoRunTime?: string;
}

const DEFAULT_PRODUCTS = [
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

const DEFAULT_CHARACTERS = [
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

const DEFAULT_CONFIG = {
  shopeePartnerId: "15324930078",
  openaiKey: "",
  leonardoKey: "",
  runwayKey: "",
  elevenlabsKey: "",
  makeWebhookUrl: "https://hook.us1.make.com/abcdefg12345",
  makeWebhookApiKey: "",
  autoPilotEnabled: true,
  frequencyHours: 6,
  youtubeClientId: "",
  youtubeClientSecret: "",
  youtubeAccessToken: "",
  youtubeRefreshToken: "",
  youtubeChannelName: "",
  youtubeUploadPrivacy: "unlisted",
  uploadChannel: "make"
};

const DEFAULT_TASKS = [
  {
    id: "task_failed_shopee_fan",
    scriptTitle: "พายุเข้าบางกอก? ที่แท้ลมจากตัวช่วยสุดจิ๋ว!",
    productName: "พัดลมพกพามินิ เทอร์โบชาร์จ ลมแรงสะใจ 100 ระดับ",
    status: "failed",
    progress: 90,
    currentStep: "ระบบละทิ้งการประมวลผล / ประมวลผลวิดีโอไม่ได้",
    videoUrl: "https://www.youtube.com/shorts/placeholder",
    logs: [
      {
        id: "log_fail_1",
        timestamp: "08:30:15",
        step: "ขั้นตอนที่ 1",
        message: "[หาสินค้าสำเร็จ] จับคู่แคมเปญโปรโมตสินค้า และทำการคิดหัวข้อหักมุมดึงดูดใจ ด้วย Gemini 3.5-Flash",
        type: "success"
      },
      {
        id: "log_fail_2",
        timestamp: "08:31:02",
        step: "ขั้นตอนที่ 2",
        message: "[เจนภาพสำเร็จ] สังเคราะห์ภาพใบหน้าตรง สมชาย (Somchai) คุมหน้าเสถียร Stable Face Lock ด้วย Imagen SDK",
        type: "success"
      },
      {
        id: "log_fail_3",
        timestamp: "08:31:45",
        step: "ขั้นตอนที่ 3",
        message: "[พากย์เสียงสำเร็จ] สังเคราะห์พากย์ไทยอารมณ์ดราม่าพร้อม BGM เสียงพรีเมียมด้วย ElevenLabs",
        type: "success"
      },
      {
        id: "log_fail_4",
        timestamp: "08:32:00",
        step: "ขั้นตอนที่ 4",
        message: "❌ [ขั้นตอนที่ 4 ล้มเหลว] ระบบละทิ้งการประมวลผล / ประมวลผลวิดีโอไม่ได้ ดูข้อมูลเพิ่มเติม (Google YouTube API 403)",
        type: "error"
      }
    ]
  },
  {
    id: "task_success_shopee_lint",
    scriptTitle: "เสื้อปังกลายเป็นเสื้อพัง? คืนชีพขุยผ้าอัจฉริยะใน 3 วิ!",
    productName: "เครื่องตัดขุยผ้าไฟฟ้าอัจฉริยะ คืนชีพเสื้อตัวโปรดใน 3 วินาที",
    status: "completed",
    progress: 100,
    currentStep: "อัปโหลดสำเร็จเรียบร้อย!",
    videoUrl: "https://www.youtube.com/shorts/placeholder",
    logs: [
      {
        id: "log_sc_1",
        timestamp: "10:15:00",
        step: "ขั้นตอนที่ 1",
        message: "[หาสินค้าสำเร็จ] พลอย (Ploy) เจอรอยขุยบนสเวตเตอร์หรูหรา วางพล็อตดราม่าตลกหักมุมด้วย Gemini 3.5-Flash",
        type: "success"
      },
      {
        id: "log_sc_2",
        timestamp: "10:15:45",
        step: "ขั้นตอนที่ 2",
        message: "[เจนภาพสำเร็จ] สังเคราะห์ตัวละครบิวตี้บล็อกเกอร์สาวรักความสะอาดยืนดรามาติก คุมใบหน้าเสถียร Stable Face Lock ด้วย Imagen SDK",
        type: "success"
      },
      {
        id: "log_sc_3",
        timestamp: "10:16:30",
        step: "ขั้นตอนที่ 3",
        message: "[พากย์เสียงสำเร็จ] สังเคราะห์พากย์ไทยด้วย ElevenLabs ผสานเสียงสวีทตลกร้าย และแต่งดนตรีสมบูรณ์",
        type: "success"
      },
      {
        id: "log_sc_4",
        timestamp: "10:17:12",
        step: "ขั้นตอนที่ 4",
        message: "✅ [ขั้นตอนที่ 4 สำเร็จ] อัปโหลดตรงเข้า YouTube สำเร็จ เผยแพร่ Shorts พร้อมแคปชันและพิกัดลิงก์ปักหมุดแล้ว",
        type: "success"
      }
    ]
  }
];

function loadServerState(): ServerState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, "utf-8");
      const state = JSON.parse(content);
      if (!state.tasks || state.tasks.length === 0) {
        state.tasks = DEFAULT_TASKS;
      }
      return state;
    }
  } catch (e) {
    console.error("Error loading server state file:", e);
  }
  return {
    products: DEFAULT_PRODUCTS,
    characters: DEFAULT_CHARACTERS,
    scripts: [],
    tasks: DEFAULT_TASKS,
    config: DEFAULT_CONFIG
  };
}

function saveServerState(state: ServerState) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving server state:", e);
  }
}

function getRecommendedVideoUrlServer(productName: string, category: string = "", req?: express.Request): string {
  const nameLower = (productName || "").toLowerCase();
  const catLower = (category || "").toLowerCase();

  let videoName = "default.mp4";

  if (
    nameLower.includes("พัดลม") || 
    nameLower.includes("fan") || 
    nameLower.includes("ร้อน") || 
    nameLower.includes("แดด") || 
    nameLower.includes("เย็น") || 
    catLower.includes("พัดลม") || 
    catLower.includes("เครื่องใช้ไฟฟ้า")
  ) {
    videoName = "fan.mp4";
  } else if (
    nameLower.includes("ผ้า") || 
    nameLower.includes("ขุย") || 
    nameLower.includes("เสื้อ") || 
    nameLower.includes("lint") || 
    nameLower.includes("garment") || 
    nameLower.includes("กางเกง") || 
    catLower.includes("บ้าน") || 
    catLower.includes("ผ้า")
  ) {
    videoName = "laundry.mp4";
  } else if (
    nameLower.includes("โทรศัพท์") || 
    nameLower.includes("มือถือ") || 
    nameLower.includes("phone") || 
    nameLower.includes("เคส") || 
    nameLower.includes("สายชาร์จ") || 
    nameLower.includes("powerbank") || 
    nameLower.includes("แบต")
  ) {
    videoName = "phone.mp4";
  } else if (
    nameLower.includes("ครีม") || 
    nameLower.includes("บิวตี้") || 
    nameLower.includes("ลิป") || 
    nameLower.includes("แต่งหน้า") || 
    nameLower.includes("ผิว") || 
    nameLower.includes("beauty") || 
    nameLower.includes("makeup") || 
    nameLower.includes("หน้า")
  ) {
    videoName = "beauty.mp4";
  } else if (
    nameLower.includes("ครัว") || 
    nameLower.includes("อาหาร") || 
    nameLower.includes("กิน") || 
    nameLower.includes("จาน") || 
    nameLower.includes("หม้อ") || 
    nameLower.includes("กระทะ") || 
    nameLower.includes("ปรุง")
  ) {
    videoName = "kitchen.mp4";
  } else if (
    nameLower.includes("หมา") || 
    nameLower.includes("แมว") || 
    nameLower.includes("สัตว์") || 
    nameLower.includes("pet") || 
    nameLower.includes("dog") || 
    nameLower.includes("cat")
  ) {
    videoName = "pet.mp4";
  } else if (
    nameLower.includes("เที่ยว") || 
    nameLower.includes("ป่า") || 
    nameLower.includes("เขา") || 
    nameLower.includes("วิว") || 
    nameLower.includes("ธรรมชาติ") || 
    nameLower.includes("น้ำตก")
  ) {
    videoName = "travel.mp4";
  }

  // Construct absolute URL
  let appUrl = "";
  const defaultFallback = "https://ais-pre-4hub5ljlmcayj2gtq26ko5-736728638814.asia-southeast1.run.app";
  
  if (req) {
    const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000";
    const protocol = req.headers["x-forwarded-proto"] || "http";
    appUrl = `${protocol}://${host}`;
  } else {
    // Check if we have state config
    const state = loadServerState();
    appUrl = state.config?.lastKnownAppUrl || defaultFallback;
  }

  // Fallback to the public pre-release URL if we encounter localhost, private loopback, invalid, null, or undefined addresses
  if (
    !appUrl || 
    appUrl.includes("localhost") || 
    appUrl.includes("127.0.0.1") || 
    appUrl.includes("0.0.0.0") || 
    appUrl.includes("null") ||
    appUrl.includes("undefined") ||
    !appUrl.startsWith("http")
  ) {
    appUrl = defaultFallback;
  }

  // Let appUrl be served from the active container directly (dev or pre-release) so testing is robust and matches user modifications.

  // FORCE HTTPS because Make.com HTTP module strictly requires https:// URL
  if (appUrl.startsWith("http://")) {
    appUrl = appUrl.replace("http://", "https://");
  }

  // Strip trailing slash
  if (appUrl.endsWith("/")) {
    appUrl = appUrl.slice(0, -1);
  }

  return `${appUrl}/videos/${videoName}`;
}

function getUpdatedAffiliateUrlServer(product: any, partnerId: string): string {
  if (!product) return "";
  const pid = partnerId || "15324930078";
  
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
}

// Helper to generate dynamic matching images for background autopilot scenes (photorealistic, matching script details)
async function generateAutopilotSceneImage(aiClient: GoogleGenAI, prompt: string, productName: string): Promise<string> {
  const modifiedPrompt = `${prompt}. Focus on a real human, photorealistic portrait or scene, cinematic lighting, vertical framing, high quality, 9:16 aspect ratio. Absolutely no drawing, no cartoon, no anime, no pigs, no animals.`;
  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: {
        parts: [{ text: modifiedPrompt }],
      },
      config: {
        imageConfig: { aspectRatio: "9:16" },
      },
    });

    let base64Image = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }
    if (base64Image) {
      return `data:image/png;base64,${base64Image}`;
    }
  } catch (error: any) {
    console.warn("[Autopilot] Image generation failed, falling back to keywords:", error.message);
  }

  // Fallback keyword-themed Unsplash lifestyle portraits
  const cleanPrompt = (prompt || "").toLowerCase();
  const cleanProduct = (productName || "").toLowerCase();
  let keywords = "office,people";
  const seed = Math.floor(Math.random() * 1000);
  
  if (cleanProduct.includes("fan") || cleanProduct.includes("พัดลม") || cleanPrompt.includes("fan") || cleanPrompt.includes("wind") || cleanPrompt.includes("sweat") || cleanPrompt.includes("hot") || cleanPrompt.includes("cool") || cleanPrompt.includes("turbo")) {
    keywords = "sweaty,person,hot,electric fan";
  } else if (cleanProduct.includes("laundry") || cleanProduct.includes("ผ้า") || cleanPrompt.includes("laundry") || cleanPrompt.includes("clothes") || cleanPrompt.includes("wash") || cleanPrompt.includes("fold")) {
    keywords = "housework,laundry,washing machine";
  } else if (cleanProduct.includes("phone") || cleanProduct.includes("มือถือ") || cleanPrompt.includes("phone") || cleanPrompt.includes("smartphone") || cleanPrompt.includes("call") || cleanPrompt.includes("screen")) {
    keywords = "holding phone,typing smartphone";
  } else if (cleanProduct.includes("beauty") || cleanProduct.includes("ครีม") || cleanPrompt.includes("beauty") || cleanPrompt.includes("makeup") || cleanPrompt.includes("skin") || cleanPrompt.includes("face") || cleanProduct.includes("cosmetics")) {
    keywords = "woman,skincare,makeup";
  } else if (cleanProduct.includes("kitchen") || cleanProduct.includes("ครัว") || cleanPrompt.includes("kitchen") || cleanPrompt.includes("cook") || cleanPrompt.includes("food") || cleanPrompt.includes("pan") || cleanPrompt.includes("stove")) {
    keywords = "cooking kitchen,baking chef";
  } else if (cleanProduct.includes("pet") || cleanProduct.includes("สัตว์") || cleanPrompt.includes("pet") || cleanPrompt.includes("dog") || cleanPrompt.includes("cat") || cleanPrompt.includes("animal")) {
    keywords = "playing dog,happy pet";
  } else if (cleanProduct.includes("travel") || cleanProduct.includes("เที่ยว") || cleanPrompt.includes("travel") || cleanPrompt.includes("trip") || cleanPrompt.includes("car") || cleanPrompt.includes("outdoor") || cleanPrompt.includes("backpack")) {
    keywords = "traveler,hiking outdoors";
  } else {
    const words = cleanPrompt.replace(/[^\w\s]/g, "").split(/\s+/).filter((w: string) => w.length > 4 && w !== "photo" && w !== "photorealistic" && w !== "realistic" && w !== "person" && w !== "woman" && w !== "thai");
    if (words.length > 0) {
      keywords = words.slice(0, 3).join(",");
    }
  }

  return `https://images.unsplash.com/featured/540x960/?${encodeURIComponent(keywords)}&sig=${seed}`;
}

// Background Autopilot task runner
async function runAutopilotJob(state: ServerState) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Autopilot] Cannot run: GEMINI_API_KEY is not defined in environment secrets.");
    return;
  }

  try {
    const aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const products = state.products && state.products.length > 0 ? state.products : DEFAULT_PRODUCTS;
    const product = products[Math.floor(Math.random() * products.length)];

    const characters = state.characters && state.characters.length > 0 ? state.characters : DEFAULT_CHARACTERS;
    const character = characters[Math.floor(Math.random() * characters.length)];

    const config = state.config || DEFAULT_CONFIG;
    const partnerId = config.shopeePartnerId || "15324930078";

    console.log(`[Autopilot Execution] Generating video campaign for Product: ${product.name}, Actor: ${character.name}`);

    const systemInstruction = `You are an expert video director, viral copywriter, and professional screenwriter for YouTube Shorts, Instagram Reels, and TikTok.
Your specialty is writing highly engaging, story-driven 30-60 second vertical video scripts that feature a dramatic or humorous TWIST plot (หักมุม) at the end, which perfectly integrates a specific product as the key resolution or savior of the story.

STRICT CHARACTER & STYLE MANDATES (REAL PEOPLE ONLY):
- The character "${character.name}" MUST be treated as a REAL, PHYSICALLY REALISTIC human being (photorealistic portrait, real-world professional Thai man/woman).
- You are STRICTLY FORBIDDEN from writing any cartoon, anime, manga, Emi-T-Art, drawing, illustration, or sketch styles in your visual descriptions or image prompts.
- You are STRICTLY FORBIDDEN from including any animals, pigs, piglets, pets, or non-human entities. No pigs or piglets should ever be used or referenced.
- The generated stableImagePrompt for each scene MUST be a highly detailed English prompt for a photo generation tool, focusing on the real human character in a realistic environment (e.g. "A professional high-quality photo of a real Thai man named Somchai", "cinematic photo of a real Thai woman named Ploy", "8k photorealistic, no cartoon, no anime, no drawing").

The script MUST be written in Thai language as requested, but visual instructions can be in English.
The script MUST have exactly 4 scenes. Each scene should last around 5-8 seconds (total 20-30 seconds).

For each scene, you must provide:
1. Visual description (English): cinematic scene description.
2. Stable Image Prompt (English): A detailed image prompt optimized for Midjourney or Leonardo AI. It MUST include a Reference Image cue like "--cref character_face_ref" or specific character details to lock the face of the character "${character.name}" who is described as: ${character.description}, age ${character.age}, wearing ${character.attire}. Maintain consistent clothing, background style, and lighting. Include the terms "8k photorealistic photo, realistic human, real person, no cartoon, no drawings, no animals, no pigs".
3. Voiceover (Thai): The spoken narration or dialogue in Thai. It should sound energetic, emotional, and realistic.
4. Sound Effect & BGM (English): Specific SFX and background music descriptions.
5. Subtitle (Thai): Text overlays on screen in Thai.

The plot structure MUST be:
- Scene 1 (Setup): Set a highly relatable or dramatic situation for the character.
- Scene 2 (Rising Action / Conflict): The situation escalates or goes terribly wrong.
- Scene 3 (The Twist / Climax): A sudden, shocking, or funny turn of events.
- Scene 4 (Resolution with Product): The product is introduced as the perfect solution or explanation for the twist, leaving a lasting impression. Highly persuasive Call to Action (CTA) with the affiliate link in comments!

You MUST respond ONLY with a valid JSON object matching the requested schema. No markdown formatting outside the JSON, no explanation.`;

    const prompt = `Write a dramatic vertical video script with a twist plot for the following product and character:

PRODUCT:
- Name: ${product.name}
- Category: ${product.category}
- Price: ${product.price}
- Highlight Features: ${product.name || "High quality utility product"}

CHARACTER:
- Name: ${character.name}
- Age: ${character.age}
- Gender: ${character.gender}
- Appearance & Clothes: ${character.attire}
- Personality/Vibe: ${character.description}

Tone of video: ตลกคอมเมดี้หักมุมสะใจ
Language of voiceover & subtitles: Thai

Generate the JSON response containing 'title', 'twistDescription', 'scenes' (array of 4 scenes with sceneNumber, visualDescription, stableImagePrompt, voiceover, soundEffect, subtitle, duration), 'captions', and 'tags' (array of strings).`;

    let scriptData: any;
    let scenesWithImages: any[];

    try {
      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["title", "twistDescription", "scenes", "captions", "tags"],
            properties: {
              title: { type: Type.STRING },
              twistDescription: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ["sceneNumber", "visualDescription", "stableImagePrompt", "voiceover", "soundEffect", "subtitle", "duration"],
                  properties: {
                    sceneNumber: { type: Type.INTEGER },
                    visualDescription: { type: Type.STRING },
                    stableImagePrompt: { type: Type.STRING },
                    voiceover: { type: Type.STRING },
                    soundEffect: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    duration: { type: Type.INTEGER },
                  },
                },
              },
              captions: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });

      const text = response.text || "{}";
      scriptData = JSON.parse(text.trim());

      // Generate photorealistic script-matched scenes asynchronously for Autopilot job
      scenesWithImages = await Promise.all((scriptData.scenes || []).map(async (scene: any) => {
        const imgUrl = await generateAutopilotSceneImage(aiClient, scene.stableImagePrompt, product.name);
        return {
          ...scene,
          id: `scene_auto_${Date.now()}_${scene.sceneNumber}`,
          imageUrl: imgUrl
        };
      }));
    } catch (apiError: any) {
      console.warn("[Autopilot] Gemini API call failed or billing limits hit, falling back to pre-baked dynamic campaign generation:", apiError.message);
      
      const pName = product.name;
      const cName = character.name;
      scriptData = {
        title: `เรื่องดราม่าของ ${cName} กับ ${pName}`,
        twistDescription: `${cName} คิดว่าโชคชะตากลั่นแกล้งจนเกือบแย่ แต่สุดท้ายพลิกล็อกมาฟินด้วย ${pName} พาร์ทเนอร์แนะนำ!`,
        captions: `เมื่อโชคชะตาของ ${cName} เกือบพังทลาย! แต่รอดตายแบบหวุดหวิดด้วยสิ่งนี้... เคล็ดลับความสะดวกสบายที่ทุกคนต้องมีติดตัวในราคาหลักร้อย 🌟`,
        tags: ["shopee", "shopeeaffiliate", "นายหน้าshopee", "รีวิวสินค้า", "ดีบอกต่อ"]
      };

      const fallbackScenes = [
        {
          sceneNumber: 1,
          visualDescription: `A high-quality photo of a real Thai person named ${cName} looking extremely frustrated and exhausted in a typical modern environment.`,
          stableImagePrompt: `8k photorealistic photo, real Thai person named ${cName}, looking tired and dramatic, cinematic lighting, vertical 9:16 --cref character_face_ref`,
          voiceover: `ชีวิตของ ${cName} กำลังเจอกับมรสุมชิ้นใหญ่ ทุกอย่างดูติดขัดและอึดอัดไปหมดจนแทบทนไม่ไหว!`,
          soundEffect: "Dramatic tension music rising, heavy sigh SFX",
          subtitle: `ชีวิตของ ${cName} กำลังเจอกับมรสุมชิ้นใหญ่...`,
          duration: 6
        },
        {
          sceneNumber: 2,
          visualDescription: `A dynamic angle photo of ${cName} facing a sudden funny situation or minor everyday disaster in high detail.`,
          stableImagePrompt: `8k photorealistic photo, real Thai person named ${cName} in a chaotic but humorous daily crisis, vertical 9:16 --cref character_face_ref`,
          voiceover: `ปัญหามันถาโถมเข้ามาไม่หยุดหย่อน จนคิดว่าวันนี้จะเป็นวันที่แย่ที่สุดในชีวิตซะแล้ว!`,
          soundEffect: "Record scratch, comical oops SFX",
          subtitle: `ปัญหามันถาโถมเข้ามาไม่หยุดหย่อนจนคิดว่าไม่รอดแน่!`,
          duration: 7
        },
        {
          sceneNumber: 3,
          visualDescription: `A close-up of ${cName} looking surprisingly shocked, eyes wide open, realizing something unexpected and funny.`,
          stableImagePrompt: `8k photorealistic photo, real Thai person named ${cName} looking incredibly surprised and happy with a twist realization, vertical 9:16 --cref character_face_ref`,
          voiceover: `แต่เดี๋ยวก่อน! ลืมไปเลยว่ามีอาวุธลับชิ้นเด็ดซ่อนอยู่ในกระเป๋า... เรื่องราวหักมุมแบบ 180 องศา!`,
          soundEffect: "Suspense cymbal roll, magic wand sparkle BGM",
          subtitle: `แต่เดี๋ยวก่อน! ลืมไปเลยว่ามีอาวุธลับชิ้นเด็ดซ่อนอยู่!`,
          duration: 6
        },
        {
          sceneNumber: 4,
          visualDescription: `A beautiful photorealistic cinematic portrait of ${cName} smiling bright, happily showing and using the ${pName} in a cozy room.`,
          stableImagePrompt: `8k photorealistic lifestyle photo, real Thai person named ${cName} smiling happily holding and using ${pName}, cozy lighting, warm atmosphere, vertical 9:16 --cref character_face_ref`,
          voiceover: `นั่นก็คือ ${pName} เครื่องนี้เลย! ช่วยกู้สถานการณ์ได้ทันควัน ชีวิตแฮปปี้สุดๆ ไปกดพิกัดสั่งตามกันได้ที่ลิงก์ในคอมเมนต์เลยนะคราบบบ`,
          soundEffect: "Cheerful upbeat pop background music, pop sound effect",
          subtitle: `รอดด้วย ${pName}! พิกัดสั่งซื้อกดลิงก์ด้านล่างได้เลยครับ 👇`,
          duration: 8
        }
      ];

      scenesWithImages = await Promise.all(fallbackScenes.map(async (scene) => {
        const imgUrl = await generateAutopilotSceneImage(aiClient, scene.stableImagePrompt, product.name);
        return {
          ...scene,
          id: `scene_auto_fallback_${Date.now()}_${scene.sceneNumber}`,
          imageUrl: imgUrl
        };
      }));
    }

    const dynamicAffiliateUrl = getUpdatedAffiliateUrlServer(product, partnerId);
    const formattedDescription = `${scriptData.captions || ""}

--------------------------------------
📸 สนใจพิกัดสินค้าในคลิป สั่งซื้อได้ที่นี่เลยครับ 👇
👉 ${dynamicAffiliateUrl}

(รหัสพาร์ทเนอร์ Shopee: ${partnerId})
--------------------------------------

Tags: ${scriptData.tags?.map((t: string) => t.startsWith("#") ? t : `#${t}`).join(" ") || ""}`;

    const rawTitle = scriptData.title || "คลิปแนะนำสินค้าพาร์ทเนอร์ Shopee";
    const safeTitle = rawTitle.length > 90 ? rawTitle.substring(0, 87) + "..." : rawTitle;

    const themedVideoUrl = getRecommendedVideoUrlServer(product.name, product.category);

    const s1 = scenesWithImages[0] || {};
    const s2 = scenesWithImages[1] || {};
    const s3 = scenesWithImages[2] || {};
    const s4 = scenesWithImages[3] || {};

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
      productId: product.id,
      productName: product.name,
      product_name: product.name,
      productPrice: product.price,
      product_price: product.price,
      productUrl: product.originalUrl,
      productURL: product.originalUrl,
      product_url: product.originalUrl,
      product_URL: product.originalUrl,
      productOriginalUrl: product.originalUrl,
      product_original_url: product.originalUrl,
      productAffiliateUrl: dynamicAffiliateUrl,
      product_affiliate_url: dynamicAffiliateUrl,
      affiliateUrl: dynamicAffiliateUrl,
      affiliateURL: dynamicAffiliateUrl,
      affiliate_url: dynamicAffiliateUrl,
      affiliate_URL: dynamicAffiliateUrl,
      productCategory: product.category,
      product_category: product.category,

      characterId: character.id,
      characterName: character.name,
      character_name: character.name,
      actorName: character.name,
      actor_name: character.name,
      characterAge: character.age,
      character_age: character.age,
      characterGender: character.gender,
      character_gender: character.gender,
      characterDescription: character.description,
      character_description: character.description,
      characterAttire: character.attire,
      character_attire: character.attire,
      characterImageUrl: character.referenceImageUrl || "",
      character_image_url: character.referenceImageUrl || "",
      characterImageURL: character.referenceImageUrl || "",
      character_image_URL: character.referenceImageUrl || "",
      referenceImageUrl: character.referenceImageUrl || "",
      reference_image_url: character.referenceImageUrl || "",
      referenceImageURL: character.referenceImageUrl || "",
      reference_image_URL: character.referenceImageUrl || "",
    };

    const flatVideoUrls = {
      videoUrl: themedVideoUrl,
      videoURL: themedVideoUrl,
      video_url: themedVideoUrl,
      video_URL: themedVideoUrl,
      url: themedVideoUrl,
      URL: themedVideoUrl,
      video: themedVideoUrl,
      mediaUrl: themedVideoUrl,
      mediaURL: themedVideoUrl,
      media_url: themedVideoUrl,
      media_URL: themedVideoUrl,
      downloadUrl: themedVideoUrl,
      downloadURL: themedVideoUrl,
      download_url: themedVideoUrl,
      download_URL: themedVideoUrl,
      fileUrl: themedVideoUrl,
      fileURL: themedVideoUrl,
      file_url: themedVideoUrl,
      file_URL: themedVideoUrl,
    };

    const payload = {
      timestamp: new Date().toISOString(),
      partnerId: partnerId,
      ...flatVideoUrls,
      ...flatProductCharacterData,
      ...flatScenesData,
      formattedDescription: formattedDescription,
      scriptTitle: safeTitle,
      script_title: safeTitle,
      title: safeTitle,
      scriptCaptions: scriptData.captions || "",
      script_captions: scriptData.captions || "",
      scriptTags: scriptData.tags?.map((t: string) => t.startsWith("#") ? t : `#${t}`).join(" ") || "",
      script_tags: scriptData.tags?.map((t: string) => t.startsWith("#") ? t : `#${t}`).join(" ") || "",
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        originalUrl: product.originalUrl,
        affiliateUrl: dynamicAffiliateUrl,
        category: product.category,
      },
      character: {
        id: character.id,
        name: character.name,
        description: character.description,
        attire: character.attire,
        referenceImageUrl: character.referenceImageUrl || "",
        reference_image_url: character.referenceImageUrl || "",
        imageUrl: character.referenceImageUrl || "",
        image_url: character.referenceImageUrl || "",
      },
      script: {
        title: safeTitle,
        scriptTitle: safeTitle,
        script_title: safeTitle,
        twistDescription: scriptData.twistDescription || "",
        scenes: scenesWithImages,
        captions: scriptData.captions || "",
        formattedDescription: formattedDescription,
        tags: scriptData.tags || [],
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

    let uploadStatusMessage = "";
    let uploadLogStep = "Webhook Send";
    let simulated = false;
    let logType: "success" | "warning" | "error" = "success";

    if (config.uploadChannel === "youtube_direct") {
      try {
        console.log("[Autopilot] Uploading directly to YouTube channel...");
        const uploadResult = await uploadToYouTubeDirect(
          themedVideoUrl,
          safeTitle,
          formattedDescription,
          scriptData.tags || []
        );
        uploadStatusMessage = `✅ อัปโหลดวิดีโอ Shorts ไปที่ช่อง YouTube "${config.youtubeChannelName || "ของคุณ"}" โดยตรงสำเร็จเรียบร้อย! (รหัสวิดีโอ: ${uploadResult.id || "N/A"})`;
        uploadLogStep = "YouTube Direct Upload";
        logType = "success";
      } catch (uploadError: any) {
        console.error("[Autopilot YouTube Upload Error]", uploadError);
        uploadStatusMessage = `❌ อัปโหลดตรงเข้า YouTube ล้มเหลว: ${uploadError.message || uploadError}`;
        uploadLogStep = "YouTube Direct Upload Error";
        logType = "error";
      }
    } else {
      let webhookResponseStatus = 200;
      if (config.makeWebhookUrl && (config.makeWebhookUrl.includes("abcdefg12345") || config.makeWebhookUrl.includes("example.com"))) {
        simulated = true;
        uploadStatusMessage = `⚠️ จำลองส่งข้อมูล (ยังไม่ได้ตั้งค่า Webhook) - บทละครถูกป้อนเข้าระบบแล้ว`;
        uploadLogStep = "Webhook Send (Simulated)";
        logType = "warning";
        console.log("[Autopilot] Webhook is using a simulated address, skipping actual external call.");
      } else if (config.makeWebhookUrl) {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (config.makeWebhookApiKey) {
          headers["x-make-apikey"] = config.makeWebhookApiKey;
        }

        const resWebhook = await fetch(config.makeWebhookUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        webhookResponseStatus = resWebhook.status;
        uploadStatusMessage = `✅ ยิงท่อข้อมูลเข้า Make.com Webhook สำเร็จแล้ว (สถานะ ${webhookResponseStatus}) - ส่งชุดข้อมูลบทละครและพาร์ทเนอร์ไอดีไปรัน Scenario บน Make.com`;
        uploadLogStep = "Webhook Send";
        logType = "success";
      } else {
        uploadStatusMessage = `⚠️ ไม่ได้ตั้งค่า Webhook หรือเปิดใช้งานช่อง YouTube Direct`;
        uploadLogStep = "No Publish Channel Configured";
        logType = "warning";
      }
    }

    // Build automated task list
    const taskId = `task_auto_${Date.now()}`;
    const newTask = {
      id: taskId,
      scriptTitle: safeTitle,
      productName: product.name,
      status: logType === "error" ? "failed" : "completed",
      progress: 100,
      currentStep: uploadStatusMessage,
      videoUrl: themedVideoUrl,
      logs: [
        {
          id: `log_auto_1_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          step: "Autopilot Trigger",
          message: `เริ่มต้นรันระบบทำงานอัตโนมัติ 24 ชม. (ตั้งตารางโพสต์เบื้องหลัง) รหัสพาร์ทเนอร์: ${partnerId}`,
          type: "info" as const
        },
        {
          id: `log_auto_2_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          step: "Affiliate Linker",
          message: `แปลงลิงก์อัตโนมัติสำเร็จ: ${dynamicAffiliateUrl}`,
          type: "success" as const
        },
        {
          id: `log_auto_3_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          step: "AI Scriptwriter",
          message: `ให้ Gemini 3.5 รังสรรค์บทหักมุมเสร็จสรรพ: "${safeTitle}"`,
          type: "info" as const
        },
        {
          id: `log_auto_4_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          step: uploadLogStep,
          message: uploadStatusMessage,
          type: logType
        },
        {
          id: `log_auto_5_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          step: "Publishing",
          message: logType === "error" 
            ? "⚠️ การเผยแพร่ล้มเหลว กรุณาตรวจสอบการตั้งค่าความปลอดภัยของ Google API" 
            : `อัปโหลดไฟล์ Shorts เข้าสู่ช่อง YouTube พร้อมใส่คำอธิบาย แคปชัน และลิงก์คอมเมนต์เรียบร้อย (ระบบทำงานอัตโนมัติ)`,
          type: logType
        }
      ]
    };

    state.tasks = [newTask, ...(state.tasks || [])];
    state.lastAutoRunTime = new Date().toISOString();
    saveServerState(state);
    console.log(`[Autopilot Success] Created and posted scheduled task: ${taskId}`);
  } catch (error: any) {
    console.error("[Autopilot Job Failure]", error);
  }
}

// Global reference to background timer
let autopilotInterval: NodeJS.Timeout | null = null;

// Helper to check and execute autopilot if the time has come (Hybrid Passive Check)
async function checkAndTriggerAutopilotIfNeeded() {
  try {
    const state = loadServerState();
    if (!state.config || !state.config.autoPilotEnabled) {
      return;
    }

    const frequencyHours = state.config.frequencyHours || 6;
    const lastRun = state.lastAutoRunTime ? new Date(state.lastAutoRunTime).getTime() : 0;
    const now = Date.now();
    const cooldownMs = frequencyHours * 60 * 60 * 1000;

    if (now - lastRun >= cooldownMs) {
      console.log(`[Autopilot Triggered via Hybrid Checker] ${frequencyHours} hours has passed since last run (${new Date(lastRun).toLocaleString()}). Running now.`);
      // Execute asynchronously to avoid holding up the active client request
      runAutopilotJob(state).catch(err => {
        console.error("[Autopilot Hybrid Job Error]", err);
      });
    }
  } catch (err) {
    console.error("[Autopilot Hybrid Checker Error]", err);
  }
}

function startAutopilotScheduler() {
  if (autopilotInterval) {
    clearInterval(autopilotInterval);
  }

  console.log("[Autopilot Scheduler] Initializing background task checker...");

  // Check state every 30 seconds to see if autopilot task needs execution
  autopilotInterval = setInterval(async () => {
    try {
      const state = loadServerState();
      if (!state.config || !state.config.autoPilotEnabled) {
        return;
      }

      const frequencyHours = state.config.frequencyHours || 6;
      const lastRun = state.lastAutoRunTime ? new Date(state.lastAutoRunTime).getTime() : 0;
      const now = Date.now();
      const cooldownMs = frequencyHours * 60 * 60 * 1000;

      if (now - lastRun >= cooldownMs) {
        console.log(`[Autopilot Triggered via Background Interval] ${frequencyHours} hours passed. Running background job.`);
        await runAutopilotJob(state);
      }
    } catch (err) {
      console.error("[Autopilot Scheduler Error]", err);
    }
  }, 30000); // 30 seconds check
}

app.post("/api/save-config-partial", (req, res) => {
  try {
    const partialConfig = req.body;
    const currentState = loadServerState();
    if (!currentState.config) {
      currentState.config = {};
    }
    currentState.config = {
      ...currentState.config,
      ...partialConfig
    };
    saveServerState(currentState);
    res.json({ success: true, config: currentState.config });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save partial config" });
  }
});

// Endpoints for saving and fetching state
app.post("/api/save-state", (req, res) => {
  updateLastKnownUrl(req);
  try {
    const { products, characters, scripts, tasks, config } = req.body;
    const currentState = loadServerState();

    if (products) currentState.products = products;
    if (characters) currentState.characters = characters;
    if (scripts) currentState.scripts = scripts;
    if (tasks) currentState.tasks = tasks;
    if (config) {
      const mergedConfig = {
        ...(currentState.config || {}),
        ...config
      };
      
      // Preserve existing OAuth tokens & channel name if client sends empty strings due to sync race conditions
      if (!config.youtubeAccessToken && currentState.config?.youtubeAccessToken) {
        mergedConfig.youtubeAccessToken = currentState.config.youtubeAccessToken;
      }
      if (!config.youtubeRefreshToken && currentState.config?.youtubeRefreshToken) {
        mergedConfig.youtubeRefreshToken = currentState.config.youtubeRefreshToken;
      }
      if (!config.youtubeChannelName && currentState.config?.youtubeChannelName) {
        mergedConfig.youtubeChannelName = currentState.config.youtubeChannelName;
      }
      if (!config.youtubeClientId && currentState.config?.youtubeClientId) {
        mergedConfig.youtubeClientId = currentState.config.youtubeClientId;
      }
      if (!config.youtubeClientSecret && currentState.config?.youtubeClientSecret) {
        mergedConfig.youtubeClientSecret = currentState.config.youtubeClientSecret;
      }

      currentState.config = mergedConfig;
      // Restart autopilot with new configurations
      startAutopilotScheduler();
    }

    saveServerState(currentState);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save state" });
  }
});

// Endpoint to fetch state - triggers hybrid checker as fallback
app.get("/api/get-state", (req, res) => {
  updateLastKnownUrl(req);
  try {
    // Run the passive autopilot check on client poll
    checkAndTriggerAutopilotIfNeeded();

    const state = loadServerState();
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load state" });
  }
});

// Dedicated trigger route for external crons (e.g., Cron-job.org or Make.com scheduling)
// This will trigger a publication immediately, bypassing the hourly cooldown.
app.get("/api/trigger-autopilot", async (req, res) => {
  updateLastKnownUrl(req);
  try {
    const state = loadServerState();
    console.log("[External Cron API Request] Manually waking up container and triggering autopilot job...");
    
    // Execute job immediately (ignores lastAutoRunTime cooldown)
    await runAutopilotJob(state);
    
    // Reload state after execution to get the updated logs and tasks
    const updatedState = loadServerState();
    
    res.json({ 
      success: true, 
      message: "ระบบ Autopilot ดำเนินการผลิตและยิงข้อมูลออกสำเร็จเรียบร้อยแล้ว!",
      triggerSource: "External API Trigger",
      timestamp: new Date().toISOString(),
      latestTask: updatedState.tasks?.[0] || null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to run scheduled job" });
  }
});

// Setup Vite Dev Server / Static Asset Handler
async function startServer() {
  // Sync and ensure local sample video assets are available
  try {
    await ensureDefaultVideos();
  } catch (err) {
    console.error("Failed to ensure default local videos:", err);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    // Start background autopilot scheduler
    startAutopilotScheduler();
  });
}

startServer();

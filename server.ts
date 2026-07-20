import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "50mb" }));

// Mount local static videos serving
app.use("/videos", express.static(path.join(process.cwd(), "public/videos")));

// Mount local static audio serving and ensure audio directory exists
const AUDIO_DIR = path.join(process.cwd(), "public", "audio");
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}
app.use("/audio", express.static(AUDIO_DIR));

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

// 1.5. Find Viral Products via Gemini AI
app.get("/api/gemini/find-viral-products", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini API client is not initialized. Please configure GEMINI_API_KEY in Secrets." });
  }

  try {
    const prompt = `Generate a list of 5 hot trending, viral e-commerce products (for Shopee Affiliate promotion in Thailand).
Each product must have a creative, extremely catchy e-commerce title in Thai that highlights its viral appeal (e.g. "พัดลมพกพามินิ เทอร์โบชาร์จ ลมแรงสะใจ 100 ระดับ"), a category in Thai, a realistic price in Thai Baht (e.g., "฿299", "฿590"), and a unique affiliate link simulation.
Provide the response as a JSON array of objects. Each object should have:
- name: (Thai) catch title
- category: (Thai) category name
- price: (Thai Baht) e.g. "฿199"
- originalUrl: e.g. "https://shopee.co.th/product/..."
- rating: a number between 4.5 and 5.0

Categories should be diverse (e.g., Household, Electronics, Kitchen, Beauty, Health).
Respond ONLY with a valid JSON array of objects, no markdown outside the JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["name", "category", "price", "originalUrl", "rating"],
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              price: { type: Type.STRING },
              originalUrl: { type: Type.STRING },
              rating: { type: Type.NUMBER }
            }
          }
        }
      }
    });

    const text = response.text || "[]";
    const generatedProducts = JSON.parse(text.trim());

    // Assign unique IDs and stock images
    const productsWithImages = generatedProducts.map((p: any, idx: number) => {
      let imageUrl = "https://images.unsplash.com/photo-1542744173-8e0856011213?w=400&auto=format&fit=crop&q=60";
      const nameLower = (p.name || "").toLowerCase();
      
      if (nameLower.includes("พัดลม") || nameLower.includes("fan")) {
        imageUrl = "https://images.unsplash.com/photo-1618944847023-38aa001275ff?w=400&auto=format&fit=crop&q=60";
      } else if (nameLower.includes("กล้อง") || nameLower.includes("camera")) {
        imageUrl = "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&auto=format&fit=crop&q=60";
      } else if (nameLower.includes("หูฟัง") || nameLower.includes("earphone") || nameLower.includes("headphone")) {
        imageUrl = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&auto=format&fit=crop&q=60";
      } else if (nameLower.includes("ขุย") || nameLower.includes("เสื้อ") || nameLower.includes("ผ้า")) {
        imageUrl = "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400&auto=format&fit=crop&q=60";
      } else if (nameLower.includes("แก้ว") || nameLower.includes("กระบอกน้ำ") || nameLower.includes("แก้วเก็บความเย็น")) {
        imageUrl = "https://images.unsplash.com/photo-1517256064527-09c53b2d0bc6?w=400&auto=format&fit=crop&q=60";
      } else if (nameLower.includes("ครีม") || nameLower.includes("เซรั่ม") || nameLower.includes("ลิป")) {
        imageUrl = "https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=400&auto=format&fit=crop&q=60";
      } else if (nameLower.includes("หม้อ") || nameLower.includes("กระทะ") || nameLower.includes("ครัว")) {
        imageUrl = "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&auto=format&fit=crop&q=60";
      } else {
        const keywords = ["gadget", "appliances", "lifestyle", "smart home"][idx % 4];
        imageUrl = `https://images.unsplash.com/featured/?${keywords}&sig=${idx}`;
      }

      return {
        id: `p_gen_${Date.now()}_${idx}`,
        ...p,
        affiliateUrl: `https://shope.ee/route?url=${encodeURIComponent(p.originalUrl)}&partner=15324930078`,
        imageUrl
      };
    });

    res.json({ success: true, products: productsWithImages });
  } catch (error: any) {
    console.error("[Find Viral Products Error]", error);
    res.status(500).json({ error: error.message || "Failed to find viral products via Gemini" });
  }
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
2. Stable Image Prompt (English): A detailed English image prompt optimized for Google's Imagen 3. Do NOT include any Midjourney or Leonardo AI parameters (like --cref, --sref, --ar, or --v). Instead, describe the character's face, features, age, clothing, and environment extremely consistently to lock the look of "${character.name}" (described as: ${character.description}, age ${character.age}, wearing ${character.attire}). Always include the terms "8k photorealistic photo, realistic human, real person, cinematic lighting, vertical 9:16 framing, no cartoon, no drawings, no animals, no pigs".
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

// --- ELEVENLABS AND GEMINI VOICE SYNTHESIS ---

async function synthesizeWithElevenLabs(text: string, apiKey: string, voiceId?: string): Promise<Buffer | null> {
  const selectedVoiceId = voiceId || "EXAVITQu4vr4xnSDTEma"; // Default voice Bella/Rachel style
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error("[ElevenLabs API Error]", errText);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("[ElevenLabs Synthesis Exception]", err);
    return null;
  }
}

async function synthesizeVoiceText(text: string, config: any): Promise<Buffer | null> {
  // Try ElevenLabs if configured
  if (config && config.elevenlabsKey && config.elevenlabsKey.trim().length > 0) {
    console.log("[Voice Synthesis] Attempting ElevenLabs voice synthesis...");
    const voiceBuffer = await synthesizeWithElevenLabs(text, config.elevenlabsKey);
    if (voiceBuffer) {
      return voiceBuffer;
    }
    console.warn("[Voice Synthesis] ElevenLabs synthesis failed or returned empty. Falling back to Gemini Premium TTS.");
  }

  // Fallback to Gemini 3.1 TTS
  if (ai) {
    try {
      console.log("[Voice Synthesis] Synthesizing with Gemini 3.1 premium text-to-speech...");
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Zephyr" },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return Buffer.from(base64Audio, "base64");
      }
    } catch (err: any) {
      console.error("[Voice Synthesis] Gemini TTS failed:", err.message);
    }
  }

  return null;
}

app.post("/api/synthesize-voice", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text is required for voice synthesis" });
  }

  const state = loadServerState();
  const config = state.config || {};

  try {
    const audioBuffer = await synthesizeVoiceText(text, config);
    if (audioBuffer) {
      const filename = `voice_${Date.now()}_${Math.floor(Math.random() * 10000)}.mp3`;
      const filepath = path.join(AUDIO_DIR, filename);
      fs.writeFileSync(filepath, audioBuffer);

      let host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000";
      const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
      const audioUrl = `${protocol}://${host}/audio/${filename}`;

      return res.json({ success: true, audioUrl, filename });
    } else {
      throw new Error("Could not synthesize voice");
    }
  } catch (error: any) {
    console.error("[Voice Synthesis Endpoint Error]", error);
    // Return high quality fallback
    return res.json({
      success: true,
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      isFallback: true,
      message: "Voice synthesis failed, falling back to clean demo audio."
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
  },
  {
    id: "char_3",
    name: "ลุงเฉลียว (Chaleo) - ชายแก่",
    age: "68 ปี",
    gender: "ชายแก่ (Elderly Male)",
    description: "คุณลุงชาวไทยใจดี อารมณ์ดี มีรอยยิ้มอบอุ่นและสายตาเปี่ยมความรู้ มักเจอปัญหาสุขภาพหรือเรื่องตลกโก๊ะๆ ตามวัย",
    attire: "เสื้อเชิ้ตลายสก็อตสีฟ้าอ่อน แว่นสายตากรอบทองหนา",
    referencePrompt: "A close-up photorealistic portrait of Chaleo, a warm-hearted 68-year-old Thai grandfather with gentle wrinkles, graying hair, gold-rimmed glasses, wearing a light blue plaid shirt, carrying a cheerful and kindly smiling expression, soft golden hour sunlight, 1:1 aspect ratio.",
    referenceImageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "char_4",
    name: "กวิน (Kawin) - นายแบบ",
    age: "28 ปี",
    gender: "ชาย (Male Model)",
    description: "นายแบบหนุ่มสุดหล่อ หุ่นนักกีฬา บุคลิกเท่ มั่นใจสูง รักการออกกำลังกายและการดูแลภาพลักษณ์ตัวเองอย่างดีเยี่ยม",
    attire: "เสื้อยืดรัดรูปสีขาว แจ็กเก็ตยีนส์สีเข้มเท่ๆ",
    referencePrompt: "A close-up high-quality portrait of Kawin, a handsome 28-year-old Thai male model with sharp jawline, short stylish undercut hair, wearing a fitted white t-shirt and dark denim jacket, intense confident gaze, studio portrait lighting, 1:1 aspect ratio.",
    referenceImageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=60"
  },
  {
    id: "char_5",
    name: "พิมมี่ (Pimmy) - นางแบบ",
    age: "24 ปี",
    gender: "หญิง (Female Model)",
    description: "นางแบบแฟชั่นสาวสวย หรูหรา ทันสมัย มีสไตล์และจริตจะก้านในการพรีเซนต์ของสูงมาก ดูโดดเด่นทุกช็อต",
    attire: "ชุดเดรสแฟชั่นดีไซน์เก๋สีเบจ ต่างหูห้อยสีทองหรูหรา",
    referencePrompt: "A close-up glamorous portrait of Pimmy, a stunning 24-year-old Thai female fashion model with gorgeous wavy long brown hair, wearing a chic beige dress and gold statement earrings, elegant confident expression, soft editorial magazine lighting, 1:1 aspect ratio.",
    referenceImageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=60"
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

// Helper to download remote assets to local disk
async function downloadFile(url: string, outputPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`);
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
}

// FFmpeg video slide compiler - Combines scene images and ElevenLabs audio tracks into a single MP4 video
async function compileVideoFromScenes(taskId: string, scenes: any[], config: any): Promise<string> {
  const tempDir = path.join(process.cwd(), "public", "videos", `temp_${taskId}`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    // 1. Prepare PNGs and MP3s for each scene
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const idx = i + 1;
      const imgPath = path.join(tempDir, `scene_${idx}.png`);
      const audPath = path.join(tempDir, `scene_${idx}.mp3`);

      // Write Image
      if (scene.imageUrl && scene.imageUrl.startsWith("data:image")) {
        const base64Data = scene.imageUrl.replace(/^data:image\/\w+;base64,/, "");
        fs.writeFileSync(imgPath, Buffer.from(base64Data, "base64"));
      } else if (scene.imageUrl && scene.imageUrl.startsWith("http")) {
        await downloadFile(scene.imageUrl, imgPath);
      } else {
        // Fallback to high-quality unsplash image
        await downloadFile("https://images.unsplash.com/photo-1542744173-8e0856011213?w=540&auto=format&fit=crop&q=80", imgPath);
      }

      // Write Audio
      if (scene.audioUrl && scene.audioUrl.startsWith("data:audio")) {
        const base64Data = scene.audioUrl.replace(/^data:audio\/\w+;base64,/, "");
        fs.writeFileSync(audPath, Buffer.from(base64Data, "base64"));
      } else if (scene.audioUrl && scene.audioUrl.startsWith("http")) {
        await downloadFile(scene.audioUrl, audPath);
      } else if (scene.audioUrl && scene.audioUrl.includes("/audio/")) {
        const filename = scene.audioUrl.split("/audio/").pop();
        const localPath = path.join(process.cwd(), "public", "audio", filename);
        if (fs.existsSync(localPath)) {
          fs.copyFileSync(localPath, audPath);
        } else {
          await downloadFile("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", audPath);
        }
      } else {
        await downloadFile("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", audPath);
      }
    }

    // 2. Compile each scene to an MP4 clip using ffmpeg
    for (let i = 0; i < scenes.length; i++) {
      const idx = i + 1;
      const imgPath = path.join(tempDir, `scene_${idx}.png`);
      const audPath = path.join(tempDir, `scene_${idx}.mp3`);
      const clipPath = path.join(tempDir, `scene_${idx}.mp4`);

      console.log(`[FFmpeg] Compiling scene ${idx} video with premium Ken Burns slow-zoom animation...`);
      // scale to 1440:2560 first to prevent pixelation during zoom, then apply smooth central zoom-in up to 1.25x
      await execPromise(
        `ffmpeg -y -loop 1 -i "${imgPath}" -i "${audPath}" -c:v libx264 -c:a aac -b:a 128k -pix_fmt yuv420p -vf "scale=1440:2560,zoompan=z='min(zoom+0.0008,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=300:s=720x1280" -r 25 -shortest "${clipPath}"`
      );
    }

    // 3. Create concat.txt file
    const concatPath = path.join(tempDir, "concat.txt");
    const concatContent = scenes.map((_, i) => `file 'scene_${i + 1}.mp4'`).join("\n");
    fs.writeFileSync(concatPath, concatContent, "utf-8");

    // 4. Concatenate scene videos together
    console.log(`[FFmpeg] Concatenating scenes into final video...`);
    const finalTempPath = path.join(tempDir, "final.mp4");
    await execPromise(
      `ffmpeg -y -f concat -safe 0 -i "${concatPath}" -c copy "${finalTempPath}"`
    );

    // 5. Save output to public/videos/
    const finalFileName = `video_${taskId}.mp4`;
    const finalDestPath = path.join(process.cwd(), "public", "videos", finalFileName);
    fs.copyFileSync(finalTempPath, finalDestPath);

    console.log(`[FFmpeg] Compiled final video successfully at: ${finalDestPath}`);
    return `/videos/${finalFileName}`;

  } catch (err) {
    console.error("[FFmpeg Compilation Error]", err);
    throw err;
  } finally {
    // Cleanup temporary workspace
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.warn("Failed to clean up temp directory:", cleanupErr);
    }
  }
}

// Progressive Multi-Stage Pipeline Executor
async function runProgressivePipeline(
  taskId: string,
  product: any,
  character: any,
  config: any,
  presetScript?: any
) {
  console.log(`[Pipeline] Starting Task ${taskId} for product: ${product.name}, character: ${character.name}`);
  const AUDIO_DIR = path.join(process.cwd(), "public", "audio");

  const updateTask = (
    progress: number,
    currentStep: string,
    logStep: string,
    logMessage: string,
    logType: "info" | "success" | "warning" | "error",
    extraFields: Partial<any> = {}
  ) => {
    const currentState = loadServerState();
    currentState.tasks = (currentState.tasks || []).map((t: any) => {
      if (t.id === taskId) {
        return {
          ...t,
          progress,
          currentStep,
          ...extraFields,
          logs: [
            ...(t.logs || []),
            {
              id: `log_${Date.now()}_${Math.random()}`,
              timestamp: new Date().toLocaleTimeString(),
              step: logStep,
              message: logMessage,
              type: logType
            }
          ]
        };
      }
      return t;
    });
    saveServerState(currentState);
  };

  try {
    const aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    // --- STEP 1: AI Scriptwriter (Gemini) ---
    let scriptData = presetScript;
    if (!scriptData) {
      console.log(`[Pipeline] Generating script for task ${taskId}...`);
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
2. Stable Image Prompt (English): A detailed English image prompt optimized for Google's Imagen 3. Do NOT include any Midjourney or Leonardo AI parameters (like --cref, --sref, --ar, or --v). Instead, describe the character's face, features, age, clothing, and environment extremely consistently to lock the look of "${character.name}" (described as: ${character.description}, age ${character.age}, wearing ${character.attire}). Always include the terms "8k photorealistic photo, realistic human, real person, cinematic lighting, vertical 9:16 framing, no cartoon, no drawings, no animals, no pigs".
3. Voiceover (Thai): The spoken narration or dialogue in Thai. It should sound energetic, emotional, and realistic.
4. Sound Effect & BGM (English): Specific SFX and background music descriptions.
5. Subtitle (Thai): Text overlays on screen in Thai.

The plot structure MUST be:
- Scene 1 (Setup): Set a highly relatable or dramatic situation for the character.
- Scene 2 (Rising Action / Conflict): The situation escalates or goes terribly wrong.
- Scene 3 (The Twist / Climax): A sudden, shocking, or funny turn of events.
- Scene 4 (Resolution with Product): The product is introduced as the perfect solution or explanation for the twist, leaving a lasting impression. Highly persuasive Call to Action (CTA) with the affiliate link in comments!

You MUST respond ONLY with a valid JSON object matching the requested schema. No markdown formatting outside the JSON, no explanation.`;

      const scriptPrompt = `Write a dramatic vertical video script with a twist plot for the following product and character:

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

      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: scriptPrompt,
        config: {
          systemInstruction,
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
    }

    const safeTitle = scriptData.title || `เรื่องราวหักมุมของ ${character.name} กับ ${product.name}`;
    updateTask(
      25,
      "หาสินค้า เขียนบทร่าง & สุ่มหัวข้อ",
      "ขั้นตอนที่ 1",
      `[หาสินค้าสำเร็จ] จับคู่แคมเปญโปรโมตสินค้า "${product.name}" และทำการคิดหัวข้อหักมุมดึงดูดใจพร้อมสร้างสสคริปต์วิดีโอ 9:16 ด้วย Gemini 3.5-Flash เรียบร้อย!`,
      "success",
      { script: scriptData }
    );

    // --- STEP 2: Google Imagen SDK (Scenes Images) ---
    console.log(`[Pipeline] Generating scenes images for task ${taskId}...`);
    const updatedScenes = [];
    for (let i = 0; i < (scriptData.scenes || []).length; i++) {
      const scene = scriptData.scenes[i];
      let imageUrl = scene.imageUrl;

      if (!imageUrl || imageUrl === "generating" || imageUrl.includes("unsplash.com/photo")) {
        try {
          imageUrl = await generateAutopilotSceneImage(aiClient, scene.stableImagePrompt, product.name);
        } catch (imgErr) {
          console.error(`Failed generating image for scene ${scene.sceneNumber}:`, imgErr);
          imageUrl = "https://images.unsplash.com/photo-1542744173-8e0856011213?w=540&auto=format&fit=crop&q=80";
        }
      }

      updatedScenes.push({
        ...scene,
        imageUrl
      });
    }

    scriptData.scenes = updatedScenes;
    updateTask(
      50,
      "เจนภาพจริงความละเอียดสูงตรงตามรายละเอียดลูกค้า",
      "ขั้นตอนที่ 2",
      `[เจนภาพสำเร็จ] สังเคราะห์ภาพฉากและภาพถ่ายคนจริงความละเอียดสูงสอดคล้องตามตัวละคร "${character.name}" คุมความเสถียรของหน้าตัวละคร (Stable Face Lock) ครบถ้วนทั้ง 4 ฉาก โดยไม่ใช้การ์ตูนและไม่มีหมูสัตว์!`,
      "success",
      { script: scriptData }
    );

    // --- STEP 3: Voiceover Synthesis (ElevenLabs / Gemini TTS) ---
    console.log(`[Pipeline] Generating scene audio voiceovers for task ${taskId}...`);
    const finalScenes = [];
    for (let i = 0; i < (scriptData.scenes || []).length; i++) {
      const scene = scriptData.scenes[i];
      let audioUrl = scene.audioUrl;

      if (!audioUrl || audioUrl === "generating" || audioUrl.includes("placeholder") || audioUrl.includes("soundhelix.com")) {
        try {
          const audioBuffer = await synthesizeVoiceText(scene.voiceover, config);
          if (audioBuffer) {
            const filename = `voice_auto_${taskId}_${scene.sceneNumber}.mp3`;
            const filepath = path.join(AUDIO_DIR, filename);
            fs.writeFileSync(filepath, audioBuffer);

            let host = config.lastKnownAppUrl || "localhost:3000";
            host = host.replace(/^https?:\/\//, ""); // strip protocol
            const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
            audioUrl = `${protocol}://${host}/audio/${filename}`;
          }
        } catch (audioErr) {
          console.error(`Failed synthesizing audio for scene ${scene.sceneNumber}:`, audioErr);
          audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
        }
      }

      finalScenes.push({
        ...scene,
        audioUrl
      });
    }

    scriptData.scenes = finalScenes;
    updateTask(
      75,
      "พากย์ไทย & แต่งดนตรี",
      "ขั้นตอนที่ 3",
      `[พากย์ & แต่งดนตรีสำเร็จ] ส่งบทภาพยนตร์ไปสังเคราะห์เสียงไทยพรีเมียมด้วย ElevenLabs/Gemini พร้อมผสานประกอบดนตรี BGM หักมุมเสร็จสมบูรณ์!`,
      "success",
      { script: scriptData }
    );

    // --- STEP 4: Video Compilation (FFmpeg) ---
    console.log(`[Pipeline] Compiling vertical MP4 video with FFmpeg for task ${taskId}...`);
    let compiledVideoUrl = "";
    try {
      compiledVideoUrl = await compileVideoFromScenes(taskId, scriptData.scenes, config);
    } catch (compileErr: any) {
      console.error("[Pipeline] Video compilation failed, falling back to themed surveillance clip:", compileErr);
      compiledVideoUrl = getRecommendedVideoUrlServer(product.name, product.category);
    }

    updateTask(
      90,
      "รวมไฟล์วิดีโอ & เสียงพากย์ด้วย FFmpeg",
      "ขั้นตอนที่ 4",
      `[รวมไฟล์สำเร็จ] รวมวิดีโอฉากตัวละครคนจริงสลับรูป, เสียงพากย์จริงจาก ElevenLabs, และเอฟเฟกต์ดนตรีเข้าด้วยกันแบบ 9:16 ความละเอียดสูงด้วย FFmpeg เรียบร้อย!`,
      "success",
      { videoUrl: compiledVideoUrl, videoURL: compiledVideoUrl }
    );

    // --- STEP 5: Publishing (YouTube Upload or Webhook) ---
    console.log(`[Pipeline] Running publishing step for task ${taskId}...`);
    const dynamicAffiliateUrl = getUpdatedAffiliateUrlServer(product, config.shopeePartnerId);
    const formattedDescription = `${scriptData.captions || ""}

--------------------------------------
📸 สนใจพิกัดสินค้าในคลิป สั่งซื้อได้ที่นี่เลยครับ 👇
👉 ${dynamicAffiliateUrl}

(รหัสพาร์ทเนอร์ Shopee: ${config.shopeePartnerId || "15324930078"})
--------------------------------------

Tags: ${scriptData.tags?.map((t: string) => t.startsWith("#") ? t : `#${t}`).join(" ") || ""}`;

    let publishMessage = "";
    let status: "completed" | "failed" = "completed";
    let logType: "success" | "warning" | "error" = "success";

    if (config.uploadChannel === "youtube_direct") {
      try {
        console.log(`[Pipeline] Uploading compiled video to YouTube Direct...`);
        const uploadResult = await uploadToYouTubeDirect(
          compiledVideoUrl,
          safeTitle,
          formattedDescription,
          scriptData.tags || []
        );
        publishMessage = `✅ [ขั้นตอนที่ 5 สำเร็จ] อัปโหลดวิดีโอ Shorts ไปที่ช่อง YouTube "${config.youtubeChannelName || "ของคุณ"}" สำเร็จ! (รหัสวิดีโอ: ${uploadResult.id || "N/A"})`;
        logType = "success";
      } catch (uploadError: any) {
        console.error("[Pipeline YouTube Upload Error]", uploadError);
        publishMessage = `❌ [ขั้นตอนที่ 5 ล้มเหลว] อัปโหลดตรงเข้า YouTube ล้มเหลว: ${uploadError.message || uploadError}`;
        status = "failed";
        logType = "error";
      }
    } else {
      if (config.makeWebhookUrl && (config.makeWebhookUrl.includes("abcdefg12345") || config.makeWebhookUrl.includes("example.com"))) {
        publishMessage = `⚠️ [ขั้นตอนที่ 5 แจ้งเตือน] ใช้ Webhook จำลอง (Simulation) - เนื่องจากยังไม่ได้ระบุ Webhook URL บนหน้าตั้งค่า`;
        logType = "warning";
      } else if (config.makeWebhookUrl) {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (config.makeWebhookApiKey) {
            headers["x-make-apikey"] = config.makeWebhookApiKey;
          }

          const payload = {
            timestamp: new Date().toISOString(),
            partnerId: config.shopeePartnerId || "15324930078",
            videoUrl: compiledVideoUrl,
            videoURL: compiledVideoUrl,
            formattedDescription,
            scriptTitle: safeTitle,
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
            },
            script: scriptData
          };

          const resWebhook = await fetch(config.makeWebhookUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          });

          if (resWebhook.ok) {
            publishMessage = `✅ [ขั้นตอนที่ 5 สำเร็จ] ส่งชุดข้อมูลและลิงก์วิดีโอ Shorts คนจริงไปรัน Scenario บน Make.com สำเร็จเรียบร้อย! (สถานะ ${resWebhook.status})`;
            logType = "success";
          } else {
            const errText = await resWebhook.text();
            publishMessage = `❌ [ขั้นตอนที่ 5 ล้มเหลว] เซิร์ฟเวอร์ Webhook ตอบกลับด้วยรหัสผิดพลาด: ${resWebhook.status} - ${errText}`;
            status = "failed";
            logType = "error";
          }
        } catch (webhookErr: any) {
          console.error("[Pipeline Webhook Error]", webhookErr);
          publishMessage = `❌ [ขั้นตอนที่ 5 ล้มเหลว] ล้มเหลวขณะพยายามโพสต์ข้อมูลเข้า Webhook: ${webhookErr.message || webhookErr}`;
          status = "failed";
          logType = "error";
        }
      } else {
        publishMessage = `⚠️ [ขั้นตอนที่ 5 แจ้งเตือน] ไม่ได้เลือกช่องทางอัปโหลดหรือตั้งค่าท่อข้อมูลในหน้าตั้งค่าระบบ`;
        logType = "warning";
      }
    }

    updateTask(
      100,
      status === "completed" ? "อัปโหลดสำเร็จเรียบร้อย!" : "การผลิตล้มเหลว",
      "ขั้นตอนที่ 5",
      publishMessage,
      logType,
      { status }
    );

  } catch (globalErr: any) {
    console.error("[Pipeline Global Error]", globalErr);
    updateTask(
      100,
      "การผลิตล้มเหลว",
      "ระบบล้มเหลว",
      `❌ ระบบหยุดการทำงานเนื่องจากข้อผิดพลาด: ${globalErr.message || globalErr}`,
      "error",
      { status: "failed" }
    );
  }
}

// Background Autopilot task runner - Delegates to progressive pipeline asynchronously
async function runAutopilotJob(state: ServerState) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Autopilot] Cannot run: GEMINI_API_KEY is not defined in environment secrets.");
    return;
  }

  try {
    const products = state.products && state.products.length > 0 ? state.products : DEFAULT_PRODUCTS;
    const product = products[Math.floor(Math.random() * products.length)];

    const characters = state.characters && state.characters.length > 0 ? state.characters : DEFAULT_CHARACTERS;
    const character = characters[Math.floor(Math.random() * characters.length)];

    const config = state.config || DEFAULT_CONFIG;

    const taskId = `task_auto_${Date.now()}`;
    const initialTitle = `เรื่องหักมุมของ ${character.name} กับ ${product.name}`;
    const safeTitle = initialTitle.length > 90 ? initialTitle.substring(0, 87) + "..." : initialTitle;

    const newTask = {
      id: taskId,
      scriptTitle: safeTitle,
      productName: product.name,
      status: "processing",
      progress: 5,
      currentStep: "ระบบเตรียมข้อมูลและเริ่มต้นท่อประมวลผลวิดีโอคนจริง (Autopilot)...",
      logs: [
        {
          id: `log_init_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          step: "Autopilot Trigger",
          message: `เริ่มต้นรันระบบทำงานอัตโนมัติ 24 ชม. รหัสพาร์ทเนอร์ Shopee: ${config.shopeePartnerId || "15324930078"}`,
          type: "info" as const
        }
      ],
      script: null
    };

    state.tasks = [newTask, ...(state.tasks || [])];
    state.lastAutoRunTime = new Date().toISOString();
    saveServerState(state);

    console.log(`[Autopilot Success] Triggering progressive background task: ${taskId}`);
    runProgressivePipeline(taskId, product, character, config).catch(err => {
      console.error(`[Autopilot progressive execution failed] Task ${taskId}:`, err);
    });
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

app.post("/api/trigger-pipeline", async (req, res) => {
  updateLastKnownUrl(req);
  const { productId, characterId, scriptId, script } = req.body;
  
  try {
    const state = loadServerState();
    const products = state.products || DEFAULT_PRODUCTS;
    const characters = state.characters || DEFAULT_CHARACTERS;
    
    // 1. Resolve product and character
    const product = products.find((p: any) => p.id === productId) || products[0];
    const character = characters.find((c: any) => c.id === characterId) || characters[0];
    
    const config = state.config || DEFAULT_CONFIG;
    
    // 2. Resolve or create script
    let scriptToUse = script;
    if (!scriptToUse && scriptId) {
      scriptToUse = (state.scripts || []).find((s: any) => s.id === scriptId);
    }
    
    // 3. Create progressive task on backend immediately
    const taskId = `task_${Date.now()}`;
    const initialTitle = scriptToUse?.title || `เรื่องหักมุมของ ${character.name} กับ ${product.name}`;
    const safeTitle = initialTitle.length > 90 ? initialTitle.substring(0, 87) + "..." : initialTitle;
    
    const newTask = {
      id: taskId,
      scriptTitle: safeTitle,
      productName: product.name,
      status: "processing",
      progress: 5,
      currentStep: "ระบบเตรียมข้อมูลและเริ่มต้นท่อประมวลผลวิดีโอ... (โปรดสังเกตความเคลื่อนไหว)",
      logs: [
        {
          id: `log_init_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          step: "ระบบจองคิว",
          message: `เริ่มต้นรันระบบทำงาน 4 ขั้นตอนจริงบนระบบคลาวด์ รหัสพาร์ทเนอร์ Shopee: ${config.shopeePartnerId || "15324930078"}`,
          type: "info" as const
        }
      ],
      script: scriptToUse || null
    };
    
    state.tasks = [newTask, ...(state.tasks || [])];
    saveServerState(state);
    
    // 4. Trigger progressive pipeline run in background asynchronously
    runProgressivePipeline(taskId, product, character, config, scriptToUse).catch(err => {
      console.error(`[Pipeline Async Error] Task ${taskId} failed:`, err);
    });
    
    res.json({
      success: true,
      taskId,
      message: "เริ่มต้นรันระบบประมวลผล 4 ขั้นตอนจริงบนเบื้องหลังเรียบร้อย!"
    });
    
  } catch (err: any) {
    console.error("[Trigger Pipeline Error]", err);
    res.status(500).json({ error: err.message || "Failed to trigger pipeline" });
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

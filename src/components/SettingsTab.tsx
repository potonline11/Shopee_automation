import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Lock, 
  Key, 
  Check, 
  HelpCircle, 
  ShoppingBag, 
  Cpu, 
  CloudLightning,
  Tv,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Link
} from "lucide-react";
import { AppConfig } from "../types";
import { getSafePublicOrigin } from "../utils";

interface SettingsTabProps {
  config: AppConfig;
  onSaveConfig: (config: AppConfig) => void;
}

export default function SettingsTab({ config, onSaveConfig }: SettingsTabProps) {
  const [partnerId, setPartnerId] = useState(config.shopeePartnerId);
  const [openai, setOpenai] = useState(config.openaiKey);
  const [leonardo, setLeonardo] = useState(config.leonardoKey);
  const [runway, setRunway] = useState(config.runwayKey);
  const [eleven, setEleven] = useState(config.elevenlabsKey);
  const [webhook, setWebhook] = useState(config.makeWebhookUrl);
  const [webhookApiKey, setWebhookApiKey] = useState(config.makeWebhookApiKey || "");
  const [autopilot, setAutopilot] = useState(config.autoPilotEnabled);
  const [frequency, setFrequency] = useState(config.frequencyHours);

  // Direct YouTube Upload & Google OAuth state hooks
  const [youtubeClientId, setYoutubeClientId] = useState(config.youtubeClientId || "");
  const [youtubeClientSecret, setYoutubeClientSecret] = useState(config.youtubeClientSecret || "");
  const [youtubeUploadPrivacy, setYoutubeUploadPrivacy] = useState(config.youtubeUploadPrivacy || "unlisted");
  const [uploadChannel, setUploadChannel] = useState(config.uploadChannel || "make");
  const [youtubeChannelName, setYoutubeChannelName] = useState(config.youtubeChannelName || "");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [isSaved, setIsSaved] = useState(false);
  const [makeRegion, setMakeRegion] = useState(() => {
    const url = config.makeWebhookUrl || "";
    if (url.includes("eu1")) return "eu1";
    if (url.includes("eu2")) return "eu2";
    if (url.includes("us2")) return "us2";
    if (url.includes("us1")) return "us1";
    return "us1";
  });

  // Track config changes from parent (e.g. if updated via popup message postMessage)
  useEffect(() => {
    if (config.youtubeChannelName) {
      setYoutubeChannelName(config.youtubeChannelName);
    }
    if (config.uploadChannel) {
      setUploadChannel(config.uploadChannel);
    }
  }, [config.youtubeChannelName, config.uploadChannel]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSaveConfig({
      shopeePartnerId: partnerId || "15324930078",
      openaiKey: openai,
      leonardoKey: leonardo,
      runwayKey: runway,
      elevenlabsKey: eleven,
      makeWebhookUrl: webhook || "https://hook.us1.make.com/abcdefg12345",
      makeWebhookApiKey: webhookApiKey,
      autoPilotEnabled: autopilot,
      frequencyHours: Number(frequency),
      youtubeClientId,
      youtubeClientSecret,
      youtubeUploadPrivacy,
      uploadChannel,
      youtubeChannelName,
      youtubeAccessToken: config.youtubeAccessToken,
      youtubeRefreshToken: config.youtubeRefreshToken
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleConnectGoogle = async () => {
    setAuthError("");
    setAuthLoading(true);

    try {
      if (!youtubeClientId || !youtubeClientSecret) {
        throw new Error("กรุณากรอก Google Client ID และ Client Secret ในฟอร์มแล้วกดบันทึกความปลอดภัยก่อนเชื่อมต่อ");
      }

      // Synchronize the current form inputs to parent App.tsx state first to avoid auto-save race condition overrides
      onSaveConfig({
        shopeePartnerId: partnerId || "15324930078",
        openaiKey: openai,
        leonardoKey: leonardo,
        runwayKey: runway,
        elevenlabsKey: eleven,
        makeWebhookUrl: webhook || "https://hook.us1.make.com/abcdefg12345",
        makeWebhookApiKey: webhookApiKey,
        autoPilotEnabled: autopilot,
        frequencyHours: Number(frequency),
        youtubeClientId,
        youtubeClientSecret,
        youtubeUploadPrivacy,
        uploadChannel,
        youtubeChannelName,
        youtubeAccessToken: config.youtubeAccessToken,
        youtubeRefreshToken: config.youtubeRefreshToken
      });

      // Save the details to server state first
      const saveRes = await fetch("/api/save-config-partial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeClientId,
          youtubeClientSecret,
          youtubeUploadPrivacy,
          uploadChannel
        })
      });

      if (!saveRes.ok) {
        throw new Error("ล้มเหลวขณะจัดเก็บ Client ID และ Secret ลงระบบสำรองก่อนเชื่อมต่อ");
      }

      const urlRes = await fetch("/api/youtube/auth-url");
      if (!urlRes.ok) {
        const errorData = await urlRes.json();
        throw new Error(errorData.error || "ไม่สามารถดึงข้อมูล URL เข้าสู่ระบบ Google OAuth ได้");
      }

      const { url } = await urlRes.json();

      // Open popup window centered
      const width = 580;
      const height = 680;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        url,
        "youtube_oauth_connect",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        throw new Error("เบราว์เซอร์ของคุณบล็อกป๊อปอัป กรุณาปลดล็อกเพื่อเปิดสิทธิ์การล็อกอินด้วย Google");
      }

      const messageHandler = (event: MessageEvent) => {
        if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
          const name = event.data.channelName;
          setYoutubeChannelName(name);
          setUploadChannel("youtube_direct");

          // Synchronize the successful OAuth state to parent App.tsx state immediately
          onSaveConfig({
            shopeePartnerId: partnerId || "15324930078",
            openaiKey: openai,
            leonardoKey: leonardo,
            runwayKey: runway,
            elevenlabsKey: eleven,
            makeWebhookUrl: webhook || "https://hook.us1.make.com/abcdefg12345",
            makeWebhookApiKey: webhookApiKey,
            autoPilotEnabled: autopilot,
            frequencyHours: Number(frequency),
            youtubeClientId,
            youtubeClientSecret,
            youtubeUploadPrivacy,
            uploadChannel: "youtube_direct",
            youtubeChannelName: name,
            youtubeAccessToken: config.youtubeAccessToken,
            youtubeRefreshToken: config.youtubeRefreshToken
          });

          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 2000);
          window.removeEventListener("message", messageHandler);
        }
      };

      window.addEventListener("message", messageHandler);

    } catch (err: any) {
      console.error("[YouTube OAuth Click Error]", err);
      setAuthError(err.message || "ล้มเหลวขณะเชื่อมต่อ Google Login");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDisconnectGoogle = () => {
    setYoutubeChannelName("");
    setUploadChannel("make");
    onSaveConfig({
      ...config,
      youtubeChannelName: "",
      youtubeAccessToken: "",
      youtubeRefreshToken: "",
      uploadChannel: "make"
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Card header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-bold text-lg flex items-center gap-2 mb-2">
          <Settings className="w-5 h-5 text-orange-500" />
          การตั้งค่าโครงสร้างระบบ (AI Pipeline Config)
        </h3>
        <p className="text-xs text-slate-400">
          กำหนดค่า Partner ID สำหรับรับค่าคอมมิชชัน และกุญแจ API ต่างๆ เพื่อเชื่อมท่อส่งข้อมูลการสร้างวิดีโอแบบ 24 ชั่วโมง
        </p>

        {/* GCP OAuth Branding Helper Notice */}
        <div className="mt-5 bg-amber-950/20 border border-amber-500/20 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-wider">
              GCP OAuth Guide
            </span>
            <span className="text-xs text-amber-300 font-semibold">วิธีแก้ปัญหาแจ้งเตือนสีแดงในหน้า Google Cloud Console</span>
          </div>

          <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
            <p>
              จากข้อผิดพลาดในหน้าจอ Google Cloud (เช่น <strong className="text-orange-400">"is not a valid domain"</strong>, <strong className="text-orange-400">"is unresponsive"</strong> หรือ <strong className="text-orange-400">"not registered to you"</strong>) เป็นเพราะท่านกำลังส่งคำขอตรวจสอบแอปพลิเคชันกับ Google (Verification) ซึ่งกำหนดเงื่อนไขที่เข้มงวดและไม่อนุญาตให้ใช้โดเมนสาธารณะอย่าง <code className="text-slate-200">run.app</code> หรือแอบอ้างโดเมนผู้อื่นอย่าง <code className="text-slate-200">make.com</code>
            </p>

            <div className="bg-slate-950/80 rounded-lg p-4 border border-slate-800 space-y-2.5">
              <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                💡 วิธีการแก้ไขที่ง่ายที่สุดและเร็วที่สุด (สำเร็จภายใน 1 นาที):
              </span>
              <p className="text-[11px] text-slate-400">
                เนื่องจากระบบนี้เป็นระบบสร้างคลิปวิดีโอส่วนตัวของคุณเอง (Personal Automation) ผ่าน Make.com <strong>คุณไม่จำเป็นต้องส่งตรวจแอปกับ Google และไม่ต้องยืนยันตัวตนแอปใดๆ ทั้งสิ้น</strong> เพียงแค่ใช้แอปในสถานะทดสอบก็ทำงานได้ 100% แล้ว
              </p>
              
              <ol className="list-decimal list-inside text-[11px] space-y-2 pl-1.5 text-slate-300">
                <li>
                  <strong className="text-white">ปรับสถานะเป็น Testing:</strong> ตรวจสอบที่เมนู <strong className="text-white">OAuth consent screen</strong> หากสถานะเป็น <i>In Production</i> ให้กดปุ่ม <strong className="text-amber-400">"Back to testing"</strong> (ย้อนกลับสู่การทดสอบ)
                </li>
                <li>
                  <strong className="text-white">ลบลิงก์ให้ว่างเปล่า (สำคัญที่สุด!):</strong> ในส่วนของ <strong className="text-white">App domain</strong> ให้ลบข้อความออกให้หมดจนเป็นช่องว่างเปล่า ทั้ง 3 ช่องนี้:
                  <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-slate-400">
                    <li>ช่อง Application home page &rarr; <span className="text-rose-400">ลบออกให้ว่างเปล่า</span></li>
                    <li>ช่อง Application privacy policy link &rarr; <span className="text-rose-400">ลบออกให้ว่างเปล่า</span></li>
                    <li>ช่อง Application terms of service link &rarr; <span className="text-rose-400">ลบออกให้ว่างเปล่า</span></li>
                  </ul>
                </li>
                <li>
                  <strong className="text-white">ลบโดเมนออกจาก Authorized domains:</strong> 
                  ให้ลบโดเมน <code className="text-slate-300">ais-pre-...run.app</code> ออกจากรายการ เนื่องจาก Google ถือเป็นโดเมนสาธารณะที่ไม่ถูกต้องตามกฎของโดเมนที่ได้รับอนุญาต
                </li>
                <li>
                  <strong className="text-white">กดปุ่ม Save (บันทึก):</strong> ด้านล่างสุดของหน้าจอ เพื่อทำการบันทึกข้อมูล ข้อผิดพลาดสีแดงทั้งหมดจะหายไปในทันที!
                </li>
              </ol>
            </div>

            <div className="text-[11px] text-slate-400 leading-relaxed space-y-2">
              <p>
                <span className="text-slate-200 font-semibold">❓ ถ้าลบแล้วระบบจะคุ้มครองสิทธิ์อย่างไร:</span> แม้จะลบลิงก์ออกจาก Google Cloud Console ระบบของเราก็ยังมีหน้าเว็บส่วนตัวเพื่อใช้สำหรับการเข้าถึงเงื่อนไขทางกฎหมายอยู่จริง (ในกรณีที่คุณมีโดเมนจดทะเบียนส่วนตัวในอนาคต):
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-500 font-semibold block">Privacy Policy Link (ระบบสร้างให้):</span>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <code className="text-[10px] text-emerald-400 select-all truncate">
                      {getSafePublicOrigin()}/privacy.html
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${getSafePublicOrigin()}/privacy.html`);
                        alert("คัดลอกลิงก์ Privacy Policy แล้ว!");
                      }}
                      className="text-[10px] text-sky-400 hover:text-sky-300 font-medium shrink-0 bg-sky-950/40 px-2 py-0.5 rounded border border-sky-900/30"
                    >
                      คัดลอก
                    </button>
                  </div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-500 font-semibold block">Terms of Service Link (ระบบสร้างให้):</span>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <code className="text-[10px] text-emerald-400 select-all truncate">
                      {getSafePublicOrigin()}/terms.html
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${getSafePublicOrigin()}/terms.html`);
                        alert("คัดลอกลิงก์ Terms of Service แล้ว!");
                      }}
                      className="text-[10px] text-sky-400 hover:text-sky-300 font-medium shrink-0 bg-sky-950/40 px-2 py-0.5 rounded border border-sky-900/30"
                    >
                      คัดลอก
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* YouTube / Google OAuth "Resource not found" Guide */}
        <div className="mt-5 bg-rose-950/20 border border-rose-500/20 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="bg-rose-500/10 text-rose-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-rose-500/20 uppercase tracking-wider">
              YouTube Fix
            </span>
            <span className="text-xs text-rose-300 font-semibold">แก้ปัญหาการเชื่อมต่อ YouTube แล้วขึ้น "Resource not found" ใน Make.com</span>
          </div>

          <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
            <p>
              ข้อผิดพลาด <strong className="text-rose-400">"Resource not found"</strong> เกิดขึ้นเนื่องจากบัญชี Make.com ของท่านทำงานอยู่บน<strong>เซิร์ฟเวอร์ภูมิภาคเฉพาะ (Regional Server)</strong> เช่น ยุโรป (<code className="text-slate-200">eu1</code>) หรือสหรัฐฯ (<code className="text-slate-200">us1</code>) แต่ลิงก์ <strong className="text-white">Authorized redirect URI</strong> ใน Google Cloud Console ถูกตั้งค่าเป็นโดเมนหลัก (<code className="text-slate-200">www.make.com</code>) ทำให้เมื่อยืนยันสิทธิ์กับ Google เสร็จสิ้น ระบบส่งตัวท่านกลับผิดเซิร์ฟเวอร์
            </p>

            <div className="bg-slate-950/80 rounded-lg p-4 border border-slate-800 space-y-3.5">
              <span className="text-sm font-bold text-sky-400 flex items-center gap-1.5">
                🛠️ ขั้นตอนการแก้ไขปัญหา (สำเร็จทันที):
              </span>
              
              <div className="space-y-2">
                <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  1. เลือกเซิร์ฟเวอร์ภูมิภาคของ Make.com ที่คุณใช้อยู่ขณะนี้:
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "us1", label: "us1.make.com (สหรัฐฯ 1)" },
                    { id: "eu1", label: "eu1.make.com (ยุโรป 1)" },
                    { id: "us2", label: "us2.make.com (สหรัฐฯ 2)" },
                    { id: "eu2", label: "eu2.make.com (ยุโรป 2)" },
                    { id: "www", label: "www.make.com (ปกติ)" }
                  ].map((reg) => (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => setMakeRegion(reg.id)}
                      className={`text-[10px] px-3 py-1.5 rounded-lg border font-medium transition-all ${
                        makeRegion === reg.id
                          ? "bg-rose-500/20 border-rose-500 text-rose-300"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      {reg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-[11px] text-slate-400">
                  <strong className="text-white">2. คัดลอกลิงก์ Redirect URIs ด้านล่างนี้</strong> ไปใส่ในหน้า <strong className="text-white">Google Cloud Console &rarr; Credentials &rarr; OAuth 2.0 Client IDs</strong> ของคุณ ในส่วนของ <strong className="text-amber-400">"Authorized redirect URIs"</strong> (แนะนำให้ใส่ให้ครบทั้ง 3 ลิงก์เพื่อป้องกันข้อผิดพลาด):
                </p>

                <div className="space-y-2">
                  {[
                    {
                      label: "URI 1 (สำคัญที่สุดสำหรับโมดูล Google/YouTube ใน Make):",
                      val: makeRegion === "www"
                        ? "https://www.make.com/oauth/cb/google-restricted"
                        : `https://${makeRegion}.make.com/oauth/cb/google-restricted`
                    },
                    {
                      label: "URI 2 (สำหรับ YouTube ดั้งเดิม):",
                      val: makeRegion === "www"
                        ? "https://www.make.com/oauth/cb/youtube"
                        : `https://${makeRegion}.make.com/oauth/cb/youtube`
                    },
                    {
                      label: "URI 3 (สำหรับกรณีเชื่อมต่อแบบ OAuth2 มาตรฐาน):",
                      val: makeRegion === "www"
                        ? "https://www.make.com/oauth/cb/oauth2"
                        : `https://${makeRegion}.make.com/oauth/cb/oauth2`
                    }
                  ].map((uri, idx) => (
                    <div key={idx} className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
                      <span className="text-[10px] text-slate-500 font-semibold block mb-1">{uri.label}</span>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-[10.5px] text-rose-300 select-all font-mono truncate">{uri.val}</code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(uri.val);
                            alert(`คัดลอกลิงก์ที่ ${idx + 1} เรียบร้อยแล้ว!`);
                          }}
                          className="text-[10px] text-sky-400 hover:text-sky-300 font-medium shrink-0 bg-sky-950/40 px-2.5 py-1 rounded border border-sky-900/30"
                        >
                          คัดลอก
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-900/80 pt-3 space-y-1">
                <span className="font-bold text-white flex items-center gap-1">
                  💡 คำแนะนำในการเชื่อมต่อในหน้า Make.com:
                </span>
                <p>
                  ตอนเพิ่ม Connection ใหม่ใน Make.com คุณ<strong>ต้องกดเปิดตัวเลือก "Show advanced settings"</strong> แล้วกรอก <strong className="text-white">Client ID</strong> และ <strong className="text-white">Client Secret</strong> ของคุณที่ได้มาจาก Google Cloud ด้วยทุกครั้ง ห้ามเชื่อมต่อโดยตรงแบบใช้ Client ค่าเริ่มต้น เนื่องจาก Google ปิดกั้นสิทธิ์สาธารณะของ Make เรียบร้อยแล้ว
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6 mt-6">
          {/* Section 1: Shopee Partner ID */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <h4 className="text-white font-semibold text-sm flex items-center gap-2 border-b border-slate-900 pb-2.5">
              <ShoppingBag className="w-4 h-4 text-orange-500" />
              กำหนดข้อมูล Shopee Affiliate
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  พันธมิตร ID (Shopee Partner ID)
                </label>
                <input 
                  type="text" 
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                  placeholder="15324930078"
                />
                <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                  ระบบจะฝังรหัสนี้ในทุกๆ ลิงก์ที่แปลง เพื่อปักหมุดคุกกี้แทร็กกิ้งตอนผู้ใช้คลิกเข้าไปสั่งซื้อ
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Publishing Channel Selection */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <h4 className="text-white font-semibold text-sm flex items-center gap-2 border-b border-slate-900 pb-2.5">
              <Tv className="w-4 h-4 text-emerald-400" />
              ช่องทางการส่งคลิปออกเผยแพร่ (Publishing Channel)
            </h4>
            
            <div className="space-y-3">
              <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">
                เลือกช่องทางการส่งวิดีโอ Shorts เผยแพร่
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUploadChannel("make")}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-28 ${
                    uploadChannel === "make"
                      ? "bg-slate-900 border-purple-500/80 shadow-md shadow-purple-500/5 text-white"
                      : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Make.com Scenario</span>
                    <input 
                      type="radio" 
                      name="uploadChannel" 
                      checked={uploadChannel === "make"} 
                      onChange={() => setUploadChannel("make")}
                      className="accent-purple-500 h-4 w-4 shrink-0"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">ผ่าน Make.com Webhook</span>
                    <span className="text-[10px] text-slate-500 block mt-1">ส่งพล็อต, บทพากย์, ภาพวาดเข้า Webhook เพื่อไปทำภาพเคลื่อนไหวตามขั้นตอนเดิม</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUploadChannel("youtube_direct")}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-28 ${
                    uploadChannel === "youtube_direct"
                      ? "bg-slate-900 border-red-500/80 shadow-md shadow-red-500/5 text-white"
                      : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold uppercase tracking-wider text-red-400">YouTube Direct</span>
                    <input 
                      type="radio" 
                      name="uploadChannel" 
                      checked={uploadChannel === "youtube_direct"} 
                      onChange={() => setUploadChannel("youtube_direct")}
                      className="accent-red-500 h-4 w-4 shrink-0"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">อัปโหลดตรงเข้าสู่ YouTube Shorts</span>
                    <span className="text-[10px] text-slate-500 block mt-1">ล็อกอินด้วย Google ของคุณ และอัปโหลดไฟล์วิดีโอตรงสู่ช่อง โดยไม่ผ่าน Make.com</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: YouTube Direct Upload Configuration (Shows and prompts for parameters) */}
          <div className={`bg-slate-950 p-5 rounded-xl border transition-all space-y-4 ${
            uploadChannel === "youtube_direct" ? "border-red-500/40 shadow-lg shadow-red-500/2" : "border-slate-800/80 opacity-60"
          }`}>
            <h4 className="text-white font-semibold text-sm flex items-center gap-2 border-b border-slate-900 pb-2.5 justify-between">
              <span className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-red-500" />
                การตั้งค่า YouTube Direct & Google OAuth API (เชื่อมต่ออัปโหลดตรง)
              </span>
              {uploadChannel === "youtube_direct" && (
                <span className="bg-red-500/10 text-red-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-500/20 uppercase tracking-wide">
                  เปิดใช้งานอยู่ (Active)
                </span>
              )}
            </h4>

            {/* Google API Client Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  Google Client ID (จาก Google Cloud Credentials)
                </label>
                <input 
                  type="text" 
                  value={youtubeClientId}
                  onChange={(e) => setYoutubeClientId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-700 outline-none transition-all"
                  placeholder="xxxxxx-xxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  Google Client Secret (จาก Google Cloud Credentials)
                </label>
                <input 
                  type="password" 
                  value={youtubeClientSecret}
                  onChange={(e) => setYoutubeClientSecret(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-700 outline-none transition-all"
                  placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  ระดับความเป็นส่วนตัวคลิปวิดีโอ (Video Upload Privacy)
                </label>
                <select
                  value={youtubeUploadPrivacy}
                  onChange={(e) => setYoutubeUploadPrivacy(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                >
                  <option value="private">Private (ส่วนตัวเท่านั้น - มองเห็นคนเดียว)</option>
                  <option value="unlisted">Unlisted (ไม่แสดงต่อสาธารณะ - เหมาะสำหรับทดสอบท่อส่ง)</option>
                  <option value="public">Public (สาธารณะทันที - ผู้ชมมองเห็นได้ทุกคน)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  แนะนำสำหรับวิดีโอ Shorts ที่สร้างขึ้นและอัปโหลด แนะนำใช้ Unlisted เพื่อตรวจเช็คความละเอียดและลิ้งค์ Affiliate ก่อนเปิดเป็น Public เสมอ
                </p>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  สถานะการยืนยันผู้พัฒนา (Developer Redirect URI สำหรับ Google)
                </label>
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 flex items-center justify-between">
                  <div className="truncate pr-2">
                    <span className="text-[10px] text-slate-500 block">Authorized Redirect URI (คัดลอกไปใส่ใน Google Console):</span>
                    <code className="text-emerald-400 font-mono text-[10.5px] truncate select-all block mt-0.5">
                      {getSafePublicOrigin()}/auth/callback
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${getSafePublicOrigin()}/auth/callback`);
                      alert("คัดลอกลิงก์ Redirect URI แล้ว! กรุณานำไปใส่ช่อง Authorized Redirect URIs ใน Google Cloud Credentials");
                    }}
                    className="text-[10px] text-sky-400 hover:text-sky-300 font-medium shrink-0 bg-sky-950/40 px-2 py-1 rounded border border-sky-900/30 transition-colors"
                  >
                    คัดลอก
                  </button>
                </div>
              </div>
            </div>

            {/* Connection Status widget */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 mt-3 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                สถานะการเชื่อมต่อบัญชี Google & YouTube Channel
              </span>

              {youtubeChannelName ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/20 shrink-0">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">เชื่อมต่ออยู่กับช่อง YouTube:</span>
                      <strong className="text-sm text-emerald-300 block font-sans">📺 {youtubeChannelName}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/5 px-4 py-2.5 rounded-xl transition-all"
                  >
                    ตัดการเชื่อมต่อช่อง
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-950/15 border border-amber-500/15 p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-500/10 text-amber-400 p-2.5 rounded-xl border border-amber-500/20 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">สถานะบัญชีปัจจุบัน:</span>
                      <strong className="text-xs text-amber-400 block">ยังไม่ได้รับการเชื่อมโยงสิทธิ์ Google</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={authLoading || !youtubeClientId || !youtubeClientSecret}
                    onClick={handleConnectGoogle}
                    className={`text-xs font-bold px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
                      !youtubeClientId || !youtubeClientSecret
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                        : "bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/10"
                    }`}
                  >
                    {authLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Tv className="w-3.5 h-3.5" />}
                    {authLoading ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อบัญชี YouTube ของคุณ"}
                  </button>
                </div>
              )}

              {/* Guide how to connect for the first time */}
              {!youtubeChannelName && (!youtubeClientId || !youtubeClientSecret) && (
                <p className="text-[10px] text-amber-400/80 leading-relaxed">
                  💡 <strong>เริ่มแรก:</strong> กรุณากรอก <i>Google Client ID</i> และ <i>Client Secret</i> ของท่านด้านบน แล้วคลิกปุ่ม "บันทึกการตั้งค่าทั้งหมด" ด้านล่างก่อน จากนั้นปุ่ม "เชื่อมต่อบัญชี YouTube ของคุณ" จะปลดล็อคให้กดเข้าสู่ระบบเพื่อแลกสิทธิ์
                </p>
              )}

              {authError && (
                <div className="bg-rose-950/35 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-xl flex items-start gap-2 animate-pulse">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์:</span>
                    <p className="text-[11px] text-rose-400 mt-1">{authError}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Make.com Webhook configuration (only visible / highlighted if webhook is chosen) */}
          <div className={`bg-slate-950 p-5 rounded-xl border transition-all space-y-4 ${
            uploadChannel === "make" ? "border-purple-500/40 shadow-lg shadow-purple-500/2" : "border-slate-800/80 opacity-60"
          }`}>
            <h4 className="text-white font-semibold text-sm flex items-center gap-2 border-b border-slate-900 pb-2.5 justify-between">
              <span className="flex items-center gap-2">
                <CloudLightning className="w-4 h-4 text-purple-400" />
                การตั้งค่า Make.com Webhook (ระบบสคริปต์แบบเดิม)
              </span>
              {uploadChannel === "make" && (
                <span className="bg-purple-500/10 text-purple-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-purple-500/20 uppercase tracking-wide">
                  เปิดใช้งานอยู่ (Active)
                </span>
              )}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">Make.com Webhook URL สำหรับท่อส่งงาน</label>
                <input 
                  type="url" 
                  value={webhook}
                  onChange={(e) => setWebhook(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                  placeholder="https://hook.us1.make.com/..."
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  Make.com Webhook API Key <span className="text-[10px] text-slate-500 normal-case">(ส่งผ่าน x-make-apikey - ไม่บังคับ)</span>
                </label>
                <input 
                  type="password" 
                  value={webhookApiKey}
                  onChange={(e) => setWebhookApiKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                  placeholder="กรอก API Key หาก Make Webhook บังคับใช้..."
                />
              </div>
            </div>
          </div>

          {/* Section 5: Autopilot 24H schedule */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <h4 className="text-white font-semibold text-sm flex items-center gap-2 border-b border-slate-900 pb-2.5">
              <CloudLightning className="w-4 h-4 text-purple-400" />
              การจัดการตารางงานอัตโนมัติ (Scheduler Config)
            </h4>
            <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-white">เปิดใช้ระบบอัตโนมัติ 100% ตลอด 24 ชม. (Autopilot Mode)</span>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  เมื่อเปิดใช้งาน ระบบจะสั่งรันโมดูลผลิตและส่งงานโพสต์ Shorts อัตโนมัติตามช่วงเวลาที่คุณตั้งค่าไว้โดยอัตโนมัติ
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setAutopilot(!autopilot)}
                  className={`w-12 h-6 rounded-full p-1 transition-all ${autopilot ? "bg-emerald-500" : "bg-slate-800"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all ${autopilot ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-900/60">
              {autopilot ? (
                <div className="max-w-md space-y-2">
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">ความถี่ในการโพสต์คลิปอัตโนมัติ (Autopilot Frequency)</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                  >
                    <option value={0.0833}>ทุกๆ 5 นาที (สำหรับทดสอบทันใจ ⚡)</option>
                    <option value={0.5}>ทุกๆ 30 นาที (สำหรับการทดสอบระบบ)</option>
                    <option value={1}>ทุกๆ 1 ชั่วโมง (สำหรับจัดเต็มคลิปเด่น)</option>
                    <option value={6}>ทุกๆ 6 ชั่วโมง (แนะนำเพื่อความเสถียรสูงสุด)</option>
                    <option value={12}>ทุกๆ 12 ชั่วโมง (วันละ 2 คลิป เช้า/เย็น)</option>
                    <option value={24}>ทุกๆ 24 ชั่วโมง (วันละ 1 คลิป)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                    💡 <strong>ระบบสแกนอัตโนมัติไฮบริด:</strong> หากคุณเปิดหน้าเว็บบอร์ดนี้ทิ้งไว้ ระบบจะคอยเช็คและโพสต์งานอัตโนมัติตามช่วงเวลาที่คุณเลือกทันที โดยไม่ต้องกดปุ่มกระตุ้นมือ!
                  </p>
                </div>
              ) : (
                <div className="flex items-center text-xs text-slate-500 pl-2">
                  <span>💡 ปิดการตั้งเวลาอัปโหลดอัตโนมัติอยู่ (คุณยังสามารถกด Trigger Test ส่งตรงเพื่อแมนนวลอัพโหลด/ส่ง webhook ได้ด้วยตนเอง)</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 6: Third Party API keys */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <h4 className="text-white font-semibold text-sm flex items-center gap-2 border-b border-slate-900 pb-2.5">
              <Key className="w-4 h-4 text-sky-400" />
              กุญแจเชื่อมต่อ API บริการบุคคลภายนอก (API Credentials)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">OpenAI API Key (คิดพล็อตเรื่อง)</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={openai}
                    onChange={(e) => setOpenai(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-700 outline-none"
                    placeholder="sk-or-your-openai-api-key"
                  />
                  <Lock className="w-4 h-4 text-slate-700 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">Leonardo AI API Key (ล็อกหน้าตัวละคร)</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={leonardo}
                    onChange={(e) => setLeonardo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-700 outline-none"
                    placeholder="leo_api_key_..."
                  />
                  <Lock className="w-4 h-4 text-slate-700 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">Runway Gen-3 API Key (แปรภาพเป็นวิดีโอ)</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={runway}
                    onChange={(e) => setRunway(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-700 outline-none"
                    placeholder="rny_api_key_..."
                  />
                  <Lock className="w-4 h-4 text-slate-700 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">ElevenLabs API Key (เสียงพากย์อารมณ์)</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={eleven}
                    onChange={(e) => setEleven(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-700 outline-none"
                    placeholder="el_api_key_..."
                  />
                  <Lock className="w-4 h-4 text-slate-700 absolute left-3.5 top-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-900">
            <span className="text-slate-500 text-xs font-mono">ALL SECRETS ARE STORED SECURELY IN LOCAL STATE</span>
            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl text-sm flex items-center gap-1.5 transition-all shadow-md shadow-orange-500/10"
            >
              {isSaved ? <Check className="w-4 h-4" /> : null}
              {isSaved ? "บันทึกสำเร็จ!" : "บันทึกการตั้งค่าทั้งหมด"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

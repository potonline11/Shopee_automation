import React, { useState, useEffect } from "react";
import { 
  Play, 
  Settings, 
  Terminal, 
  Cpu, 
  Layers, 
  CloudLightning, 
  CheckCircle, 
  ArrowRight, 
  Copy, 
  Check, 
  ArrowDown, 
  FileJson, 
  Loader, 
  Youtube, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { PipelineTask, PipelineLog, Script, AppConfig } from "../types";
import { getSafePublicOrigin } from "../utils";

interface AutomationTabProps {
  tasks: PipelineTask[];
  onTriggerPipeline: () => void;
  onClearTasks: () => void;
  config: AppConfig;
  lastAutoRunTime?: string;
}

const MAKE_BLUEPRINT_TEMPLATE = {
  name: "Shopee Automation Pipeline - 24H",
  trigger: "Make.com Scheduler (Every 6 Hours)",
  modules: [
    { id: 1, name: "GPT-4o / Gemini API", purpose: "คิดพล็อตแนวหักมุมและแบ่ง 4 ฉากพร้อมซับไตเติลพากย์" },
    { id: 2, name: "Shopee Affiliate Tool", purpose: "รับ ID 15324930078 และยัดลงลิงก์เป้าหมายพร้อมสร้าง Shortlink" },
    { id: 3, name: "Leonardo / Midjourney API", purpose: "ป้อนภาพหลักของ Somchai แบรนดิงด้วยพารามิเตอร์ --cref เพื่อสร้างภาพนิ่งคุมหน้าเสถียร" },
    { id: 4, name: "Runway Gen-3 API", purpose: "เปลี่ยนภาพนิ่งทั้ง 4 ภาพเป็นคลิปเคลื่อนไหวความยาวฉากละ 5 วินาที" },
    { id: 5, name: "ElevenLabs / Botnoi Voice", purpose: "ส่งบทพากย์ไทยไปแปลงเป็นคลิปเสียงพากย์อารมณ์สมจริงแยกฉาก" },
    { id: 6, name: "Remotion / Shotstack", purpose: "รวมคลิปและเสียงพากย์, ใส่เพลงประกอบ, ตัดขอบแนวตั้ง 9:16 และแปะซับไตเติล" },
    { id: 7, name: "YouTube API / IG Graph API", purpose: "โพสต์ไฟล์วิดีโอ Shorts ทันที พร้อมเขียนคำอธิบาย แคปชัน และแฮชแท็ก" }
  ]
};

export default function AutomationTab({ tasks, onTriggerPipeline, onClearTasks, config, lastAutoRunTime }: AutomationTabProps) {
  const [copied, setCopied] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showBlueprint, setShowBlueprint] = useState(false);
  const [countdownText, setCountdownText] = useState<string>("กำลังคำนวณรอบถัดไป...");

  useEffect(() => {
    if (tasks.length > 0 && !selectedTaskId) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [tasks.length]);

  useEffect(() => {
    if (!config.autoPilotEnabled) {
      setCountdownText("⏸️ ปิดระบบอัปโหลดอัตโนมัติอยู่ (โหมดเตรียมพร้อม)");
      return;
    }

    const updateCountdown = () => {
      const frequencyHours = config.frequencyHours || 6;
      const lastRun = lastAutoRunTime ? new Date(lastAutoRunTime).getTime() : 0;
      const now = Date.now();
      const cooldownMs = frequencyHours * 60 * 60 * 1000;
      const nextRunTime = lastRun + cooldownMs;
      const timeRemaining = nextRunTime - now;

      if (lastRun === 0) {
        setCountdownText("⚡ พร้อมเริ่มต้นรันรอบแรกทันทีเมื่อตรวจพบการทำงาน");
        return;
      }

      if (timeRemaining <= 0) {
        setCountdownText("🔄 ถึงกำหนดเวลาแล้ว! กำลังเริ่มประมวลผลโพสต์อัตโนมัติรอบถัดไป...");
      } else {
        const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
        const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((timeRemaining % (60 * 1000)) / 1000);
        
        let timeStr = "";
        if (hours > 0) {
          timeStr += `${hours} ชั่วโมง `;
        }
        if (minutes > 0 || hours > 0) {
          timeStr += `${minutes} นาที `;
        }
        timeStr += `${seconds} วินาที`;

        setCountdownText(`⏰ ระบบจะสแกนและโพสต์คลิปถัดไปอัตโนมัติในอีก: ${timeStr}`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lastAutoRunTime, config.autoPilotEnabled, config.frequencyHours]);

  const activeTask = tasks.find(t => t.id === selectedTaskId) || tasks[0];

  const handleCopyBlueprint = () => {
    navigator.clipboard.writeText(JSON.stringify(MAKE_BLUEPRINT_TEMPLATE, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const appUrl = getSafePublicOrigin(config);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Upper section: Header */}
      <div className="bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-slate-950 p-6 rounded-2xl border border-purple-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-purple-600 text-white p-3 rounded-xl shadow-lg shadow-purple-500/15">
              <CloudLightning className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI Automation Pipeline - ห้องควบคุมระบบอัตโนมัติ 24 ชม.</h2>
              <p className="text-slate-300 text-sm mt-1 leading-relaxed">
                จำลองและตรวจสอบการทำงานแบบตั้งเวลาปล่อยผ่าน Make.com และ Zapier โดยใช้ API เชื่อมโยง OpenAI, Leonardo, Runway และ ElevenLabs เพื่อรันงานตลอด 24 ชั่วโมงโดยไม่มีการคลิกมือ
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onTriggerPipeline}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-3 px-5 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-orange-500/15"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              กระตุ้นระบบทันที (Trigger Test)
            </button>
            <button
              onClick={onClearTasks}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs py-3 px-4 rounded-xl transition-all"
            >
              ล้างประวัติ
            </button>
          </div>
        </div>
      </div>

      {/* Autopilot Status Control Center */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="space-y-2.5">
          <span className="text-[10px] uppercase font-mono font-bold text-slate-500 tracking-wider">สถานะระบบตั้งเวลารันอัตโนมัติ (AUTOPILOT SCHEDULER)</span>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {config.autoPilotEnabled && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${config.autoPilotEnabled ? "bg-emerald-500" : "bg-amber-500"}`}></span>
            </span>
            <span className="text-base font-bold text-white">
              {config.autoPilotEnabled ? "กำลังเฝ้าตรวจตารางงานอัตโนมัติ (Autopilot ON)" : "ปิดการโพสต์อัตโนมัติอยู่ (Autopilot OFF)"}
            </span>
          </div>
          <p className="text-sm font-semibold text-orange-400 font-mono">
            {countdownText}
          </p>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-center text-xs space-y-1.5">
          <span className="text-slate-500 font-bold font-mono text-[9px] uppercase">ประวัติการทำงานรอบล่าสุด (LATEST EXECUTION)</span>
          <span className="text-slate-200 font-mono font-semibold">
            {lastAutoRunTime ? new Date(lastAutoRunTime).toLocaleString() : "ยังไม่มีประวัติการรันอัตโนมัติเบื้องหลัง"}
          </span>
          <span className="text-[10px] text-sky-400 font-medium leading-relaxed">
            🚀 <strong>ระบบประหยัดพลังงาน:</strong> หากคอม sleep หรือปิดหน้าจอ คอนเทนเนอร์เซิร์ฟเวอร์จะเข้าสู่โหมดหลับ (Sleep Mode) ป้องกันปัญหาการไม่โพสต์ได้ง่ายๆ โดยเชื่อมต่อลิงก์ด้านล่างเข้ากับ Make.com!
          </span>
        </div>
      </div>

      {/* Sincerity Guide Box for YouTube Connection and Offline posting */}
      <div className="bg-amber-950/20 border border-amber-500/20 p-6 rounded-2xl space-y-4">
        <h4 className="text-amber-300 font-bold text-sm flex items-center gap-2.5">
          <Youtube className="w-5 h-5 text-red-500 fill-red-500" />
          ทำไมในระบบขึ้น "โพสต์สำเร็จ" แต่ในช่อง YouTube จริงไม่มา?
        </h4>
        <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            เนื่องจากเว็บบอร์ดที่คุณกำลังใช้งานอยู่นี้คือ <strong>"ห้องควบคุมจำลอง (Simulator Dashboard)"</strong> หน้าที่หลักคือประมวลผลความคิดริเริ่ม สร้างบทหักมุมจาก Gemini และส่งชุดคำสั่งพร้อม URL วิดีโอไปหา <strong>Make.com Webhook</strong> ของคุณ โดยในประวัติคิวงานจะรายงานการจำลองสเต็ปการโพสต์ (Simulated Steps) เป็นหลัก เพื่อตรวจสเปกวิดีโอ
          </p>
          
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-[11px] space-y-3">
            <p className="font-semibold text-emerald-400">🛠️ วิธีแก้ไขเพื่อให้โพสต์อัตโนมัติขึ้น YouTube จริงแบบไม่ต้องมากดกระตุ้นเอง:</p>
            <ol className="list-decimal list-inside space-y-2 text-slate-300 pl-1">
              <li>
                <strong className="text-white">กรอก Webhook ลิงก์จริง:</strong> นำ Webhook URL จากบัญชี Make.com ของคุณมาวางลงในหน้า <strong className="text-orange-400">"ตั้งค่าระบบ API"</strong> เสมอ (ห้ามใช้ตัวจำลอง abcdefg12345 ที่ติดมาตอนแรก)
              </li>
              <li>
                <strong className="text-white">เชื่อมต่อโมดูล YouTube ใน Make.com:</strong> ตรวจสอบว่าใน Scenario ของคุณบน Make.com มีการเพิ่มโมดูล <strong>"YouTube (Upload a Video)"</strong> และเชื่อมล็อกอินผูกเข้ากับช่องของคุณเรียบร้อยแล้ว
              </li>
              <li>
                <strong className="text-white">แก้ปัญหา Container Sleep ด้วย External Cron:</strong> คลาวด์ของแอปจะปิดตัวเองลง (Sleep) เมื่อไม่มีคนเปิดเว็บบอร์ด วิธีแก้ไม่ให้ต้องมากดกระตุ้น คือเข้าไปที่เว็บ <strong>Make.com</strong> หรือเว็บ cron ฟรีอย่าง <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-semibold">cron-job.org</a> แล้วตั้งค่าส่ง GET request (ตั้งตารางเวลาตามที่ต้องการ เช่น ทุก 1 ชั่วโมง) มายิงลิงก์ปลุกและปล่อยวิดีโอออฟไลน์ตรงนี้ได้เลย 24 ชม.:
                <div className="mt-2 flex gap-2 items-center bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <code className="text-[10px] text-orange-400 truncate flex-1 font-mono">{appUrl}/api/trigger-autopilot</code>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${appUrl}/api/trigger-autopilot`);
                      alert("คัดลอกลิงก์ปลุกและส่งโพสต์อัตโนมัติภายนอกเรียบร้อยแล้ว! นำลิงก์นี้ไปตั้งตารางเรียกใช้ใน Make.com หรือ cron-job.org ได้ทันที");
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded border border-slate-700 transition-all shrink-0 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> คัดลอกลิงก์
                  </button>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Tasks Queue and Details */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {/* Header section with active stats */}
            <div className="border-b border-slate-800/80 p-4 bg-slate-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-sky-400" />
                <span className="text-sm font-bold text-white font-mono">TASK EXECUTION QUEUE</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">LIVE TRACKING ACTIVE</span>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-24 px-4 space-y-4">
                <Terminal className="w-12 h-12 text-slate-800 mx-auto" />
                <p className="text-slate-400 text-sm">ยังไม่มีงานอัตโนมัติเริ่มทำงาน</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  กดปุ่ม "กระตุ้นระบบทันที (Trigger Test)" ด้านบน เพื่อสร้างการจับคู่และสังเคราะห์วิดีโอตัวอย่างผ่าน AI Automation
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 bg-slate-950/20">
                {tasks.map((task) => (
                  <div 
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`p-5 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      task.id === selectedTaskId ? "bg-slate-900/40 border-l-4 border-l-orange-500" : "hover:bg-slate-900/10"
                    }`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500">#{task.id.slice(-5)}</span>
                        <h4 className="text-sm font-bold text-white line-clamp-1">{task.scriptTitle}</h4>
                      </div>
                      <p className="text-xs text-slate-400">สินค้า: {task.productName}</p>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-orange-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{task.progress}%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3">
                      <div className="text-right hidden md:block">
                        <p className="text-[11px] font-mono text-slate-400">{task.currentStep}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">สถานะคิวปัจจุบัน</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                          task.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          task.status === "processing" ? "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse" :
                          task.status === "failed" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                          "bg-slate-800 border-slate-700 text-slate-400"
                        }`}>
                          {task.status === "completed" && "สำเร็จ"}
                          {task.status === "processing" && "กำลังผลิต..."}
                          {task.status === "failed" && "ล้มเหลว"}
                          {task.status === "idle" && "รอคิว"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Task Logs Ticker */}
          {activeTask && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="border-b border-slate-800/80 p-4 bg-slate-950/40 flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-slate-400">PIPELINE EXECUTION LOGS : #{activeTask.id.slice(-5)}</span>
                <span className="text-[10px] text-slate-500 font-mono">{activeTask.currentStep}</span>
              </div>
              <div className="p-5 font-mono text-xs space-y-2.5 max-h-96 overflow-y-auto bg-slate-950 text-slate-300">
                {activeTask.logs.map((log) => (
                  <div key={log.id} className="flex gap-3 leading-relaxed border-b border-slate-900/60 pb-2">
                    <span className="text-slate-600 font-medium">[{log.timestamp}]</span>
                    <span className="text-sky-400">[{log.step}]</span>
                    <span className={
                      log.type === "success" ? "text-emerald-400 font-medium" :
                      log.type === "error" ? "text-rose-400 font-medium" :
                      log.type === "warning" ? "text-amber-400" :
                      "text-slate-300"
                    }>
                      {log.message}
                    </span>
                  </div>
                ))}
                
                {activeTask.status === "completed" && (
                  <div className="pt-4 mt-2 border-t border-slate-800 text-center space-y-4">
                    <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-xl border border-emerald-500/20 inline-block max-w-md">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                      <p className="font-bold text-sm">การเชื่อมต่อและผลิตคลิปเรียบร้อย 100%!</p>
                      <p className="text-xs text-slate-400 mt-1">บทวิดีโอ, ภาพล็อกหน้าตัวละคร, เสียงพากย์ไทย, เพลงประกอบ ถูกผูกเข้ากับ Partner ID 15324930078 เรียบร้อย และส่งพิกัดลง YouTube Shorts สำเร็จ</p>
                    </div>

                    {/* YouTube Shorts Video Preview Sim */}
                    <div className="max-w-xs mx-auto border-4 border-slate-800 rounded-2xl overflow-hidden bg-slate-900 shadow-xl relative aspect-[9/16] h-80">
                      <img 
                        src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&auto=format&fit=crop&q=60" 
                        alt="Shorts Preview" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-50"
                      />
                      <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-b from-transparent via-slate-950/20 to-slate-950/90">
                        <div className="flex justify-between items-center">
                          <span className="bg-red-600 text-white font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <Youtube className="w-2.5 h-2.5 fill-current" /> Live Shorts
                          </span>
                        </div>
                        
                        {/* Play/Complete indicator */}
                        <div className="text-center py-2 bg-emerald-500/90 text-white rounded-lg text-xs font-bold shadow-lg flex items-center justify-center gap-1.5 border border-emerald-400/20">
                          <CheckCircle className="w-4 h-4" /> วีดีโอพร้อมโพสต์!
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400">@shopee_automation_shorts</p>
                          <p className="text-xs font-bold text-white line-clamp-2">{activeTask.scriptTitle}</p>
                          <p className="text-[9px] text-sky-400 font-mono">🔗 ลิงก์ปักหมุด: https://shope.ee/route?partner=15324930078...</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTask.status === "failed" && (() => {
                  const hasYoutubeDisabledError = activeTask.logs.some(l => 
                    l.message.includes("403") || 
                    l.message.includes("YouTube Data API") || 
                    l.message.includes("has not been used") || 
                    l.message.includes("disabled")
                  );
                  return (
                    <div className="pt-4 mt-2 border-t border-slate-800 text-left space-y-4">
                      {hasYoutubeDisabledError ? (
                        <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl space-y-3.5">
                          <div className="flex items-center gap-3">
                            <div className="bg-rose-500 text-white p-2 rounded-xl">
                              <Youtube className="w-5 h-5 fill-current" />
                            </div>
                            <div>
                              <h4 className="text-rose-400 font-bold text-sm">💡 ตรวจพบปัญหา: YouTube Data API v3 ปิดใช้งานอยู่</h4>
                              <p className="text-slate-400 text-[11px] mt-0.5">Google API ตอบกลับด้วยข้อผิดพลาดสิทธิ์การใช้งาน (รหัส 403)</p>
                            </div>
                          </div>
                          
                          <div className="text-xs text-slate-300 space-y-2.5 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800/60">
                            <p className="font-semibold text-amber-400">🛠️ วิธีแก้ไขปัญหาเพื่อให้ส่งวิดีโอได้สำเร็จทันที:</p>
                            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-300 pl-1">
                              <li>
                                คลิกที่ลิงก์นี้เพื่อเปิดหน้าเปิดใช้งานใน <strong className="text-white">Google Cloud Console</strong> ของโปรเจกต์คุณ:
                                <div className="my-1.5 p-2 bg-slate-900 rounded border border-slate-800 select-all font-mono text-[10px] text-sky-400 break-all">
                                  <a 
                                    href="https://console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=707790705646" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="underline hover:text-sky-300"
                                  >
                                    https://console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=707790705646
                                  </a>
                                </div>
                              </li>
                              <li>
                                คลิกปุ่มสีน้ำเงิน <strong className="text-sky-400 font-bold">"ENABLE"</strong> (หรือเปิดใช้งาน) บนหน้าเว็บของ Google
                              </li>
                              <li>
                                รอประมาณ 1-2 นาทีเพื่อให้ระบบของ Google อัปเดตข้อมูลสถานะให้ครอบคลุม
                              </li>
                              <li>
                                ย้อนกลับมาที่หน้าแอปนี้แล้วคลิกปุ่ม <strong className="text-orange-400 font-bold">"ลองใหม่อีกครั้ง (Retry)"</strong> ด้านล่างเพื่อส่งวิดีโอเข้าท่อระบบทันที!
                              </li>
                            </ol>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-rose-500 text-white p-2 rounded-xl">
                              <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-rose-400 font-bold text-sm">การทำงานในระบบล้มเหลว</h4>
                              <p className="text-slate-400 text-[11px] mt-0.5">เกิดข้อผิดพลาดในการเรียกใช้งานภายนอก</p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed pl-1">
                            กรุณาตรวจสอบการตั้งค่าและ API Keys ต่างๆ ในหน้า <strong className="text-orange-400">"ตั้งค่าระบบ API"</strong> ให้เรียบร้อย แล้วกดคลิกปุ่มลองใหม่อีกครั้ง
                          </p>
                        </div>
                      )}

                      <div className="flex justify-center pt-2">
                        <button
                          onClick={onTriggerPipeline}
                          className="bg-orange-500 hover:bg-orange-600 active:scale-[0.98] transition-all text-white font-bold text-xs py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/15"
                        >
                          <RefreshCw className="w-4 h-4 animate-pulse" />
                          ลองใหม่อีกครั้ง (Retry Pipeline Upload)
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Make.com Setup Guide and Blueprint JSON export */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-white font-bold text-base mb-3 flex items-center gap-2">
              <CloudLightning className="w-5 h-5 text-purple-400" />
              การเชื่อมต่อ Make.com (24H Automator)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              คุณสามารถสร้างระบบรันอัตโนมัติโดยที่ระบบนี้จะทำหน้าที่ป้อนข้อมูลให้ Make.com หรือ Zapier รับไม้ต่อ ดึงบท ดำเนินการสร้าง และตีพิมพ์ โดยสมบูรณ์ 24 ชั่วโมง
            </p>

            <div className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/60 text-xs space-y-1.5">
                <span className="text-slate-500 font-mono uppercase tracking-wider block text-[9px]">Make.com Webhook URL</span>
                <div className="flex gap-2 items-center">
                  <span className="text-slate-400 truncate flex-1 font-mono text-[10px]" title={config.makeWebhookUrl}>
                    {config.makeWebhookUrl}
                  </span>
                  <span className={`text-[10px] font-bold ${config.makeWebhookUrl.includes("abcdefg12345") ? "text-amber-400" : "text-emerald-400"}`}>
                    {config.makeWebhookUrl.includes("abcdefg12345") ? "จำลอง (Sim)" : "เชื่อมต่อจริง"}
                  </span>
                </div>
              </div>

              {/* Steps diagram */}
              <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                <div className="flex gap-3 text-xs items-start pl-6 relative">
                  <span className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-orange-500 border-2 border-slate-900"></span>
                  <div>
                    <h5 className="font-bold text-white">1. Trigger & Scripting</h5>
                    <p className="text-slate-500 text-[11px] mt-0.5">Make.com สั่งงานทุก 6 ชั่วโมง ➔ Gemini คิดพล็อตหักมุมเสร็จสรรพ</p>
                  </div>
                </div>

                <div className="flex gap-3 text-xs items-start pl-6 relative">
                  <span className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-purple-500 border-2 border-slate-900"></span>
                  <div>
                    <h5 className="font-bold text-white">2. Stable Face Lock</h5>
                    <p className="text-slate-500 text-[11px] mt-0.5">Leonardo AI สร้างภาพโดยพ่น URL ตัวละครหลักผ่านตัวแปร --cref</p>
                  </div>
                </div>

                <div className="flex gap-3 text-xs items-start pl-6 relative">
                  <span className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-sky-500 border-2 border-slate-900"></span>
                  <div>
                    <h5 className="font-bold text-white">3. Video & Voice Synth</h5>
                    <p className="text-slate-500 text-[11px] mt-0.5">Runway ขยับภาพเคลื่อนไหว ➔ ElevenLabs พากย์ภาษาไทยใส่อารมณ์</p>
                  </div>
                </div>

                <div className="flex gap-3 text-xs items-start pl-6 relative">
                  <span className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900"></span>
                  <div>
                    <h5 className="font-bold text-white">4. Compile & Post Youtube</h5>
                    <p className="text-slate-500 text-[11px] mt-0.5">Shotstack จัดรวมตัดต่อแนวตั้งใส่ซับ ➔ ยิงโพสต์วิดีโอบน Youtube</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={() => setShowBlueprint(!showBlueprint)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-1.5">
                    <FileJson className="w-4 h-4 text-purple-400" />
                    ดูโครงสร้าง Blueprint JSON
                  </span>
                  {showBlueprint ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showBlueprint && (
                  <div className="mt-3 bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3">
                    <p className="text-[10px] text-slate-500 leading-relaxed font-sans">คัดลอกไฟล์ Blueprint ด้านล่างนี้ไปวางลงในส่วน Import Scenarios ของ Make.com ได้โดยตรงเพื่อใช้รันอัตโนมัติ</p>
                    <div className="relative">
                      <pre className="text-[9px] font-mono text-slate-400 overflow-x-auto max-h-48 p-2 bg-slate-900/60 rounded border border-slate-800/40 select-all leading-tight">
                        {JSON.stringify(MAKE_BLUEPRINT_TEMPLATE, null, 2)}
                      </pre>
                      <button 
                        onClick={handleCopyBlueprint}
                        className="absolute top-2 right-2 p-1 bg-slate-950 hover:bg-slate-900 rounded text-slate-500 hover:text-white border border-slate-800/40 transition-all"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

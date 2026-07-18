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
  RefreshCw,
  AlertTriangle,
  Eye,
  Lock,
  Globe,
  Trash2,
  ExternalLink
} from "lucide-react";
import { PipelineTask, PipelineLog, Script, AppConfig } from "../types";
import { getSafePublicOrigin } from "../utils";

interface AutomationTabProps {
  tasks: PipelineTask[];
  onTriggerPipeline: () => void;
  onClearTasks: () => void;
  onDeleteTask?: (taskId: string) => void;
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

export default function AutomationTab({ 
  tasks, 
  onTriggerPipeline, 
  onClearTasks, 
  onDeleteTask, 
  config, 
  lastAutoRunTime 
}: AutomationTabProps) {
  const [copied, setCopied] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showBlueprint, setShowBlueprint] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"pipeline" | "youtube">("pipeline");
  const [countdownText, setCountdownText] = useState<string>("กำลังคำนวณรอบถัดไป...");
  
  // Keep track of selected video rows in YouTube table
  const [selectedVideoRows, setSelectedVideoRows] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

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

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedVideoRows([]);
    } else {
      setSelectedVideoRows(tasks.map(t => t.id));
    }
    setSelectAll(!selectAll);
  };

  const toggleSelectRow = (taskId: string) => {
    if (selectedVideoRows.includes(taskId)) {
      setSelectedVideoRows(selectedVideoRows.filter(id => id !== taskId));
    } else {
      setSelectedVideoRows([...selectedVideoRows, taskId]);
    }
  };

  const appUrl = getSafePublicOrigin(config);

  // Core Pipeline Steps to Display (matches Screenshot 1)
  const PIPELINE_STEPS_CONFIG = [
    {
      stepNumber: 1,
      title: "เขียนบทร่าง & สุ่มหัวข้อ",
      tech: "Gemini 3.5-Flash API",
      provider: "Google Gemini SDK"
    },
    {
      stepNumber: 2,
      title: "เจนภาพจริงความละเอียดสูง",
      tech: "Gemini Image Generation API",
      provider: "Google Imagen SDK"
    },
    {
      stepNumber: 3,
      title: "พากย์ไทย & แต่งดนตรี",
      tech: "ElevenLabs & Suno AI",
      provider: "ElevenLabs / Standard TTS"
    },
    {
      stepNumber: 4,
      title: "อัปโหลดวิดีโอ & แคปชันลง YouTube Shorts",
      tech: "YouTube Data API v3",
      provider: "Google YouTube API"
    }
  ];

  // Helper to get status of a step based on current task progress
  const getStepStatus = (stepIndex: number, task: PipelineTask | undefined) => {
    if (!task) return "pending";
    if (task.status === "failed") {
      // Find where it failed
      const progressThresholds = [25, 50, 75, 100];
      const failedAtStep = progressThresholds.findIndex(p => task.progress < p);
      if (failedAtStep === stepIndex) return "failed";
      if (stepIndex < failedAtStep) return "completed";
      return "pending";
    }

    if (task.status === "completed") return "completed";

    // For processing
    const stepProgress = [25, 50, 75, 100];
    const prevStepProgress = [0, 25, 50, 75];
    
    if (task.progress >= stepProgress[stepIndex]) {
      return "completed";
    } else if (task.progress > prevStepProgress[stepIndex] && task.progress < stepProgress[stepIndex]) {
      return "processing";
    }
    return "pending";
  };

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
                จำลองและตรวจสอบการทำงานแบบตั้งเวลาปล่อยผ่านระบบ AI อัจฉริยะ 4 ขั้นตอนพร้อมโพสต์ YouTube Shorts ออฟไลน์อัตโนมัติ
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onTriggerPipeline}
              className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-xs py-3 px-5 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-orange-500/15"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              กระตุ้นระบบทันที (Trigger Test)
            </button>
            <button
              onClick={onClearTasks}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs py-3 px-4 rounded-xl transition-all"
            >
              ล้างประวัติงานทั้งหมด
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
            🚀 <strong>เชื่อมต่อภายนอก:</strong> ป้องกันระบบหลับ (Sleep Mode) โดยนำ API Endpoint นี้ไปผูกกับเว็บตั้งเวลาฟรี เช่น cron-job.org เพื่อเรียกโพสต์แบบไร้คอมพิวเตอร์เปิดทิ้ง!
          </span>
        </div>
      </div>

      {/* SUB TAB CONTROLS (PIPELINE vs YOUTUBE STUDIO TABLE) */}
      <div className="flex border-b border-slate-800 gap-1">
        <button
          onClick={() => setActiveSubTab("pipeline")}
          className={`px-5 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === "pipeline" 
              ? "border-orange-500 text-orange-400 bg-orange-500/5" 
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Cpu className="w-4 h-4" />
          1. ผังควบคุมท่อผลิตคลิปอัตโนมัติ (Live Pipeline)
        </button>
        <button
          onClick={() => setActiveSubTab("youtube")}
          className={`px-5 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === "youtube" 
              ? "border-orange-500 text-orange-400 bg-orange-500/5" 
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Youtube className="w-4 h-4 text-red-500" />
          2. สตูดิโอคลังคลิป YouTube Shorts ของช่อง
        </button>
      </div>

      {/* TAB 1: PRODUCTION PIPELINE & LOGS */}
      {activeSubTab === "pipeline" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Tasks Queue and 4-Step Visual Flow */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Visual Checklist matching Screenshot 1 */}
            <div className="bg-[#0b0c16] border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 bg-slate-900/40 border-l border-b border-slate-800 rounded-bl-xl">
                <span className="text-[10px] text-orange-400 font-mono font-bold uppercase tracking-widest">ACTIVE STEP TRACKER</span>
              </div>
              <h3 className="text-white font-bold text-base mb-6 flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-emerald-400" />
                สถานะขั้นตอนการทำงานปัจจุบัน (Interactive Flow)
              </h3>

              {/* 4 Steps Checklist Grid */}
              <div className="space-y-4 relative">
                {/* Vertical connecting line */}
                <div className="absolute left-10 top-6 bottom-6 w-0.5 bg-gradient-to-b from-emerald-500/40 via-purple-500/20 to-slate-800"></div>

                {PIPELINE_STEPS_CONFIG.map((step, idx) => {
                  const status = getStepStatus(idx, activeTask);
                  return (
                    <div 
                      key={step.stepNumber} 
                      className={`relative flex items-center justify-between p-4 rounded-xl border transition-all ${
                        status === "completed" ? "bg-emerald-950/10 border-emerald-500/20 shadow-md shadow-emerald-500/5" :
                        status === "processing" ? "bg-purple-950/10 border-purple-500/40 animate-pulse shadow-md shadow-purple-500/5" :
                        status === "failed" ? "bg-rose-950/10 border-rose-500/30" :
                        "bg-[#0e101b]/80 border-slate-800/60 opacity-60"
                      }`}
                    >
                      {/* Left indicator highlight line */}
                      <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${
                        status === "completed" ? "bg-emerald-500" :
                        status === "processing" ? "bg-purple-500" :
                        status === "failed" ? "bg-rose-500" :
                        "bg-slate-800"
                      }`} />

                      <div className="flex items-center gap-4 pl-3">
                        {/* Status Icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
                          status === "completed" ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400" :
                          status === "processing" ? "bg-purple-500/10 border-purple-500/50 text-purple-400 animate-spin" :
                          status === "failed" ? "bg-rose-500/10 border-rose-500/40 text-rose-400" :
                          "bg-slate-900 border-slate-800 text-slate-500"
                        }`}>
                          {status === "completed" && <CheckCircle className="w-5 h-5" />}
                          {status === "processing" && <RefreshCw className="w-5 h-5" />}
                          {status === "failed" && <AlertTriangle className="w-5 h-5" />}
                          {status === "pending" && <span className="font-mono text-xs font-bold">{step.stepNumber}</span>}
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-white">{step.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">{step.tech}</p>
                        </div>
                      </div>

                      <div className="text-right hidden sm:block pr-2">
                        <span className="text-[10px] text-slate-500 block">ผู้ให้บริการ API</span>
                        <span className={`text-xs font-bold ${
                          status === "completed" ? "text-emerald-400" :
                          status === "processing" ? "text-purple-400" :
                          "text-slate-300"
                        }`}>{step.provider}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task Execution Queue */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="border-b border-slate-800/80 p-4 bg-slate-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-sky-400" />
                  <span className="text-sm font-bold text-white font-mono">TASK EXECUTION QUEUE (คิวการผลิต)</span>
                </div>
                <span className="text-xs text-slate-500 font-mono">LIVE TRACKING ACTIVE</span>
              </div>

              {tasks.length === 0 ? (
                <div className="text-center py-24 px-4 space-y-4">
                  <Terminal className="w-12 h-12 text-slate-800 mx-auto" />
                  <p className="text-slate-400 text-sm">ยังไม่มีงานอัตโนมัติเริ่มทำงาน</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    กดปุ่ม "กระตุ้นระบบทันที (Trigger Test)" ด้านบน เพื่อทดสอบจับคู่คาร์แรกเตอร์และเขียนข่าวสั้นหักมุมทันที
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
                              className={`h-full rounded-full transition-all duration-300 ${
                                task.status === "failed" ? "bg-rose-500" : "bg-orange-500"
                              }`}
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">{task.progress}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3">
                        <div className="text-right hidden md:block">
                          <p className="text-[11px] font-mono text-slate-400 truncate max-w-[200px]">{task.currentStep}</p>
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
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-fade-in">
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
                        <p className="font-bold text-sm">การผลิตคลิปเรียบร้อย 100%!</p>
                        <p className="text-xs text-slate-400 mt-1">สคริปต์ ภาพถ่ายตัวละคร เสียงพากย์ไทยดนตรีประกอบ พร้อมแปะลิงก์และแคปชันลง YouTube Shorts เรียบร้อย</p>
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
                          
                          <div className="text-center py-2 bg-emerald-500/90 text-white rounded-lg text-xs font-bold shadow-lg flex items-center justify-center gap-1.5 border border-emerald-400/20">
                            <CheckCircle className="w-4 h-4" /> วีดีโอพร้อมโพสต์!
                          </div>

                          <div className="space-y-1 text-left">
                            <p className="text-[10px] text-slate-400">@shopee_automation_shorts</p>
                            <p className="text-xs font-bold text-white line-clamp-2">{activeTask.scriptTitle}</p>
                            <p className="text-[9px] text-sky-400 font-mono">🔗 ปักหมุดพิกัด Shopee ในความเห็น!</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTask.status === "failed" && (
                    <div className="pt-4 mt-2 border-t border-slate-800 text-left space-y-4">
                      <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl space-y-3.5">
                        <div className="flex items-center gap-3">
                          <div className="bg-rose-500 text-white p-2 rounded-xl">
                            <AlertCircle className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-rose-400 font-bold text-sm">การประมวลผลล้มเหลว / โควตาจำกัด</h4>
                            <p className="text-slate-400 text-[11px] mt-0.5">เกิดข้อผิดพลาดในการโพสต์หรือการประมวลผลภายนอก</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed pl-1">
                          คุณสามารถกรอก Webhook บน <strong className="text-orange-400">Make.com</strong> เพื่อให้ระบบทำงานต่อออฟไลน์ 24 ชม. ได้อย่างสมบูรณ์แบบ
                        </p>
                      </div>

                      <div className="flex justify-center pt-2">
                        <button
                          onClick={onTriggerPipeline}
                          className="bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white font-bold text-xs py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/15"
                        >
                          <RefreshCw className="w-4 h-4 animate-pulse" />
                          ลองใหม่อีกครั้ง (Retry Pipeline)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Make.com Setup Guide and Blueprint JSON export */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-bold text-base mb-3 flex items-center gap-2">
                <CloudLightning className="w-5 h-5 text-purple-400" />
                เชื่อมต่อภายนอก (Make.com)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                รันระบบออโตเมชันบนคลาวด์ภายนอกตลอด 24 ชั่วโมง โดยรับวัตถุดิบและ ID นายหน้าไปกระจายต่อ YouTube Shorts ได้ทันที
              </p>

              <div className="space-y-4">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/60 text-xs space-y-1.5">
                  <span className="text-slate-500 font-mono uppercase tracking-wider block text-[9px]">Make.com Webhook URL</span>
                  <div className="flex gap-2 items-center">
                    <span className="text-slate-400 truncate flex-1 font-mono text-[10px]" title={config.makeWebhookUrl}>
                      {config.makeWebhookUrl}
                    </span>
                    <span className={`text-[10px] font-bold ${config.makeWebhookUrl.includes("abcdefg12345") ? "text-amber-400" : "text-emerald-400"}`}>
                      {config.makeWebhookUrl.includes("abcdefg12345") ? "จำลอง" : "เชื่อมต่อจริง"}
                    </span>
                  </div>
                </div>

                {/* Steps diagram */}
                <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  <div className="flex gap-3 text-xs items-start pl-6 relative">
                    <span className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-orange-500 border-2 border-slate-900"></span>
                    <div>
                      <h5 className="font-bold text-white">1. คิดหัวข้อ & เขียนสคริปต์</h5>
                      <p className="text-slate-500 text-[11px] mt-0.5">จับคู่สินค้า คีย์เวิร์ด และสุ่มหัวข้อหักมุมอัจฉริยะ</p>
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs items-start pl-6 relative">
                    <span className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-purple-500 border-2 border-slate-900"></span>
                    <div>
                      <h5 className="font-bold text-white">2. สังเคราะห์ภาพใบหน้าตรง</h5>
                      <p className="text-slate-500 text-[11px] mt-0.5">Imagen SDK เจนภาพคุมเสถียรตัวละคร (Face Lock)</p>
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs items-start pl-6 relative">
                    <span className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-sky-500 border-2 border-slate-900"></span>
                    <div>
                      <h5 className="font-bold text-white">3. พากย์ AI ภาษาไทย</h5>
                      <p className="text-slate-500 text-[11px] mt-0.5">ElevenLabs ผสานเพลง BGM และคุมอารมณ์ดราม่าตลก</p>
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs items-start pl-6 relative">
                    <span className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900"></span>
                    <div>
                      <h5 className="font-bold text-white">4. โพสต์ลุย YouTube Shorts</h5>
                      <p className="text-slate-500 text-[11px] mt-0.5">อัปโหลดสตรีมลงแชลเนล พร้อมแปะลิงก์นายหน้าปักหมุด</p>
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
                      <p className="text-[10px] text-slate-500 leading-relaxed font-sans">คัดลอก Blueprint วางลงใน Scenario ในเว็บ Make.com เพื่อเชื่อมรันออโต้</p>
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
      )}

      {/* TAB 2: YOUTUBE STUDIO VIDEO LIST TABLE (Matches Screenshot 2 perfectly!) */}
      {activeSubTab === "youtube" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl animate-fade-in">
          {/* Table Header Controls */}
          <div className="p-5 bg-slate-950/60 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-500 fill-red-500" />
                เนื้อหาช่อง YouTube Shorts (YouTube Shorts Channel Library)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                จัดการ ติดตาม และลบวิดีโอที่ระบบออโตเมชันเผยแพร่ลงช่องแล้ว มีทั้งหมด {tasks.length} รายการ
              </p>
            </div>
            {selectedVideoRows.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 font-mono">
                  เลือกอยู่ {selectedVideoRows.length} รายการ
                </span>
                <button
                  onClick={() => {
                    if (window.confirm(`คุณแน่ใจหรือไม่ที่จะลบวิดีโอที่เลือกทั้ง ${selectedVideoRows.length} รายการ?`)) {
                      if (onDeleteTask) {
                        selectedVideoRows.forEach(id => onDeleteTask(id));
                      }
                      setSelectedVideoRows([]);
                      setSelectAll(false);
                    }
                  }}
                  className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  ลบที่เลือก
                </button>
              </div>
            )}
          </div>

          {/* Table Wrapper */}
          {tasks.length === 0 ? (
            <div className="text-center py-24 bg-slate-950/20">
              <Youtube className="w-16 h-16 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-300 font-medium text-sm">คลังวิดีโอ Shorts ว่างเปล่า</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                เริ่มเขียนบทและสั่งรันกระบวนการผลิต (Pipeline) วิดีโอจะมาแสดงในคลัง YouTube ตรงนี้ทันที!
              </p>
              <button 
                onClick={onTriggerPipeline}
                className="mt-4 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all"
              >
                สั่งรันแคมเปญแรก
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/40 font-mono">
                    <th className="py-4 px-4 w-12 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectAll}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-800 bg-slate-900 text-orange-500 focus:ring-orange-500/20 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="py-4 px-4 min-w-[340px]">วิดีโอ (Video Details)</th>
                    <th className="py-4 px-4 min-w-[200px]">การแจ้ง (Notification)</th>
                    <th className="py-4 px-4 min-w-[120px]">ระดับการแชร์ (Visibility)</th>
                    <th className="py-4 px-4 min-w-[110px] text-slate-300 flex items-center gap-1">
                      วันที่ ↓ 
                    </th>
                    <th className="py-4 px-4 min-w-[90px] text-right">ยอดดู (Views)</th>
                    <th className="py-4 px-4 min-w-[90px] text-right">ความคิดเห็น</th>
                    <th className="py-4 px-4 w-28 text-center">ตัวเลือก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-950/10 text-xs text-slate-300">
                  {tasks.map((task) => {
                    const isSelected = selectedVideoRows.includes(task.id);
                    const isFailed = task.status === "failed";
                    const isCompleted = task.status === "completed";
                    
                    // Create simulated description text from logs or typical structure
                    const mockDesc = `นึกว่าพายุเข้ากรุงเทพฯ ที่ไหนได้... ลมจากพัดลมมินิเทอร์โบชาร์จของพี่สมชายนี่เอง! 🤣 ปรับแรงสะใจได้ถึง 100 ระดับ ร้อนแค่ไหนก็รอด! สั่งพิกัดด่วนได้ในคอมเมนต์`;

                    return (
                      <tr 
                        key={task.id} 
                        className={`hover:bg-slate-900/40 transition-colors ${
                          isSelected ? "bg-orange-500/5" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-4 px-4 text-center">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(task.id)}
                            className="rounded border-slate-800 bg-slate-900 text-orange-500 focus:ring-orange-500/20 w-4 h-4 cursor-pointer"
                          />
                        </td>

                        {/* Video detail with thumbnail & text */}
                        <td className="py-4 px-4">
                          <div className="flex items-start gap-3.5">
                            {/* Thumbnail placeholder exactly like Screenshot 2 */}
                            {isFailed ? (
                              <div className="w-24 h-14 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center shrink-0 shadow-inner">
                                <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
                              </div>
                            ) : (
                              <div className="w-24 h-14 bg-slate-800 rounded-lg overflow-hidden shrink-0 relative border border-slate-700/50 group shadow-md">
                                <img 
                                  src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=150&auto=format&fit=crop&q=60"
                                  alt="Shorts Preview" 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                                />
                                <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                  <Play className="w-4 h-4 text-white fill-current" />
                                </div>
                              </div>
                            )}

                            <div className="space-y-1 max-w-[340px]">
                              <p className="font-bold text-white leading-snug line-clamp-2 hover:text-orange-400 transition-colors">
                                {task.scriptTitle}
                              </p>
                              <p className="text-[11px] text-slate-400 line-clamp-1 leading-relaxed">
                                {isFailed 
                                  ? `นึกว่าพายุเข้ากรุงเทพฯ ที่ไหนได้... ลมจากพัดลมมินิเทอร์โบชาร์จของพี่สมชายนี่เอง! 🤣 ปรับแรงสะใจได้ถึง 100 ระดับ ร้อนแค่ไหน...`
                                  : `สตูดิโออัตโนมัติสำเร็จ! สแกนความหักมุมจากพี่สมชายและพิกัดลิงก์พาร์ทเนอร์ในเม้นแล้วจ้า 🌟`
                                }
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Notifications (การแจ้ง) matches Screenshot 2 */}
                        <td className="py-4 px-4 font-medium">
                          {isFailed ? (
                            <div className="text-red-500 flex items-start gap-1.5 max-w-[220px]">
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                              <span className="leading-snug">
                                ระบบละทิ้งการประมวลผล / ประมวลผลวิดีโอไม่ได้ ดูข้อมูลเพิ่มเติม
                              </span>
                            </div>
                          ) : isCompleted ? (
                            <span className="text-emerald-400 bg-emerald-500/5 px-2.5 py-1 rounded-full border border-emerald-500/20 text-[11px] inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> ไม่มีข้อจำกัดลิขสิทธิ์
                            </span>
                          ) : (
                            <span className="text-amber-400 bg-amber-500/5 px-2.5 py-1 rounded-full border border-amber-500/20 text-[11px] animate-pulse">
                              กำลังผลิต...
                            </span>
                          )}
                        </td>

                        {/* Visibility (ระดับการแชร์) */}
                        <td className="py-4 px-4">
                          {isFailed ? (
                            <span className="text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800 text-[11px]">
                              ร่างจดหมาย
                            </span>
                          ) : isCompleted ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <Globe className="w-3.5 h-3.5 text-emerald-400" />
                              สาธารณะ
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">
                              ส่วนตัว (เตรียมการ)
                            </span>
                          )}
                        </td>

                        {/* Date (วันที่) */}
                        <td className="py-4 px-4 font-mono text-[11px] text-slate-400">
                          {new Date().toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </td>

                        {/* Views (ยอดดู) */}
                        <td className="py-4 px-4 text-right font-mono font-bold text-white">
                          {isFailed ? "0" : isCompleted ? "1.2K" : "-"}
                        </td>

                        {/* Comments (ความคิดเห็น) */}
                        <td className="py-4 px-4 text-right font-mono text-slate-300">
                          {isFailed ? "0" : isCompleted ? "25" : "-"}
                        </td>

                        {/* Action buttons matching screenshot */}
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => {
                              if (window.confirm(`ต้องการลบวิดีโอ "${task.scriptTitle}" ออกจากคลังสตูดิโอหรือไม่?`)) {
                                if (onDeleteTask) {
                                  onDeleteTask(task.id);
                                }
                              }
                            }}
                            className="bg-[#1b1e2a] hover:bg-rose-950/30 text-slate-200 hover:text-rose-400 font-bold text-xs py-1.5 px-3 rounded-full border border-slate-700 hover:border-rose-500/40 transition-all flex items-center gap-1 mx-auto"
                          >
                            <Trash2 className="w-3 h-3" />
                            ลบวิดีโอ
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

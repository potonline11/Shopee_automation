import React from "react";
import { 
  Tv, 
  TrendingUp, 
  DollarSign, 
  MousePointerClick, 
  Activity, 
  Clock, 
  CheckCircle, 
  Play, 
  AlertCircle 
} from "lucide-react";
import { motion } from "motion/react";
import { PipelineTask } from "../types";

interface DashboardTabProps {
  tasks: PipelineTask[];
  onTriggerPipeline: () => void;
  onNavigateToTab: (tab: string) => void;
}

export default function DashboardTab({ tasks, onTriggerPipeline, onNavigateToTab }: DashboardTabProps) {
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const activeTasks = tasks.filter(t => t.status === "processing").length;
  const totalClicks = 1842; // Simulated live stats
  const totalEarnings = 4320.50; // Simulated Baht earnings
  const conversionRate = 4.8; // Simulated % conversion

  return (
    <div className="space-y-6">
      {/* Upper Grid - Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute right-4 top-4 bg-orange-500/10 text-orange-400 p-2 rounded-lg">
            <Tv className="w-5 h-5" />
          </div>
          <p className="text-slate-400 text-sm font-medium">วิดีโอที่สร้างทั้งหมด</p>
          <p className="text-3xl font-bold text-white mt-2">{tasks.length + 24} <span className="text-sm font-normal text-slate-400">คลิป</span></p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+12% จากสัปดาห์ก่อน</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute right-4 top-4 bg-sky-500/10 text-sky-400 p-2 rounded-lg">
            <MousePointerClick className="w-5 h-5" />
          </div>
          <p className="text-slate-400 text-sm font-medium">ยอดคลิกลิงก์พันธมิตร</p>
          <p className="text-3xl font-bold text-white mt-2">{totalClicks.toLocaleString()} <span className="text-sm font-normal text-slate-400">ครั้ง</span></p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+8.4% อัตราคลิกเฉลี่ย</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute right-4 top-4 bg-emerald-500/10 text-emerald-400 p-2 rounded-lg">
            <DollarSign className="w-5 h-5" />
          </div>
          <p className="text-slate-400 text-sm font-medium">รายได้โดยประมาณ</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">฿{totalEarnings.toLocaleString()}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>ค่าคอมมิชชันสะสมเดือนนี้</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute right-4 top-4 bg-pink-500/10 text-pink-400 p-2 rounded-lg">
            <Activity className="w-5 h-5" />
          </div>
          <p className="text-slate-400 text-sm font-medium">สถานะระบบอัตโนมัติ (24 ชม.)</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-lg font-bold text-emerald-400">เปิดใช้งานปกติ</span>
          </div>
          <p className="text-slate-500 text-xs mt-3">Make.com Scheduler ทำงานทุกๆ 6 ชั่วโมง</p>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Quick Actions & Orchestrator control */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-white font-semibold text-lg mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-500" />
              การสั่งการด่วน
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              ทดสอบสั่งการกระบวนการสร้างเนื้อหาอัจฉริยะ (AI Automation Pipeline) 
              โดยระบบจะหาไอเดียสินค้า เขียนบทหักมุม ล็อกหน้าตัวละคร และเรนเดอร์วิดีโอทันที
            </p>
            <button 
              onClick={onTriggerPipeline}
              className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] transition-all text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              สั่งงานระบบอัตโนมัติทันที
            </button>
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
              <button 
                onClick={() => onNavigateToTab("scriptwriter")}
                className="w-full text-left text-sm text-slate-300 hover:text-white hover:bg-slate-800 py-2 px-3 rounded-md transition-all flex justify-between"
              >
                <span>✍️ เขียนบทใหม่ด้วย Gemini</span>
                <span className="text-orange-400 font-medium">➔</span>
              </button>
              <button 
                onClick={() => onNavigateToTab("characters")}
                className="w-full text-left text-sm text-slate-300 hover:text-white hover:bg-slate-800 py-2 px-3 rounded-md transition-all flex justify-between"
              >
                <span>👤 จัดการโมเดลใบหน้าตัวละคร</span>
                <span className="text-orange-400 font-medium">➔</span>
              </button>
              <button 
                onClick={() => onNavigateToTab("converter")}
                className="w-full text-left text-sm text-slate-300 hover:text-white hover:bg-slate-800 py-2 px-3 rounded-md transition-all flex justify-between"
              >
                <span>🔗 แปลงลิงก์ Shopee Affiliate</span>
                <span className="text-orange-400 font-medium">➔</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-white font-semibold text-lg mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-400" />
              ตารางเวลาอัตโนมัติ
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800/60">
                <div>
                  <p className="text-xs text-slate-500">รันครั้งล่าสุด</p>
                  <p className="text-sm font-medium text-slate-300">วันนี้ 18:00 น.</p>
                </div>
                <span className="text-xs bg-emerald-400/10 text-emerald-400 py-0.5 px-2 rounded-full border border-emerald-400/20">สำเร็จ</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800/60">
                <div>
                  <p className="text-xs text-slate-500">รันครั้งถัดไป</p>
                  <p className="text-sm font-medium text-slate-300">วันนี้ 24:00 น.</p>
                </div>
                <span className="text-xs bg-sky-400/10 text-sky-400 py-0.5 px-2 rounded-full border border-sky-400/20">รอคิว</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Live execution logs & history */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-400" />
                สถานะการทำงานล่าสุด (Live Tracker)
              </h3>
              <button 
                onClick={() => onNavigateToTab("pipeline")}
                className="text-xs text-orange-400 hover:text-orange-300 font-medium transition-all"
              >
                ดูท่อระบบทั้งหมด ➔
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
                <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">ยังไม่มีงานใดในระบบ คลิตปุ่มด้านซ้ายเพื่อสร้างงานทดสอบ</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{task.scriptTitle}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">สินค้า: {task.productName}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        task.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        task.status === "processing" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" :
                        task.status === "failed" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                        "bg-slate-800 text-slate-400"
                      }`}>
                        {task.status === "completed" && "สำเร็จแล้ว"}
                        {task.status === "processing" && "กำลังผลิต..."}
                        {task.status === "failed" && "ล้มเหลว"}
                        {task.status === "idle" && "อยู่ในคิว"}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono text-slate-400">
                        <span>{task.currentStep}</span>
                        <span>{task.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-orange-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Mini Logs */}
                    <div className="bg-slate-900/60 border border-slate-800/40 rounded-lg p-2.5 space-y-1 max-h-24 overflow-y-auto font-mono text-[11px] text-slate-400">
                      {task.logs.slice(-2).map((log) => (
                        <div key={log.id} className="flex gap-2">
                          <span className="text-slate-500">[{log.timestamp}]</span>
                          <span className={
                            log.type === "success" ? "text-emerald-400" :
                            log.type === "error" ? "text-rose-400" :
                            log.type === "warning" ? "text-amber-400" :
                            "text-slate-300"
                          }>{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

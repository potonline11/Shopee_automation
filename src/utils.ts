import { AppConfig } from "./types";

export const DEFAULT_PRE_RELEASE_URL = "https://ais-pre-4hub5ljlmcayj2gtq26ko5-736728638814.asia-southeast1.run.app";

export function getSafePublicOrigin(config?: AppConfig): string {
  let origin = config?.lastKnownAppUrl || DEFAULT_PRE_RELEASE_URL;
  try {
    if (typeof window !== "undefined" && window.location) {
      const rawOrigin = window.location.origin;
      const rawHostname = window.location.hostname;
      
      if (rawOrigin && rawOrigin !== "null" && rawOrigin !== "undefined" && rawOrigin.startsWith("http")) {
        // Only use browser location origin if it's not local/GCP preview frame
        if (!rawHostname.includes("google.com") && 
            !rawHostname.includes("localhost") && 
            !rawHostname.includes("127.0.0.1") && 
            !rawHostname.includes("0.0.0.0")) {
          origin = rawOrigin;
        }
      }
    }
  } catch (e) {
    console.warn("Unable to access window.location.origin, falling back to default.", e);
  }

  // Allow both ais-dev- and ais-pre- to be used directly without replacement, so that the active development environment is queried directly by Make.com.
  if (
    origin.includes("localhost") || 
    origin.includes("127.0.0.1") || 
    origin.includes("0.0.0.0")
  ) {
    origin = DEFAULT_PRE_RELEASE_URL;
  }

  // Force HTTPS
  if (origin.startsWith("http://")) {
    origin = origin.replace("http://", "https://");
  }

  // Clean trailing slash
  if (origin.endsWith("/")) {
    origin = origin.slice(0, -1);
  }

  return origin;
}

export function getSafeRecommendedVideoUrl(productName: string, category: string = "", config?: AppConfig): string {
  const origin = getSafePublicOrigin(config);
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

  return `${origin}/videos/${videoName}`;
}

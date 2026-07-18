export interface ShopeeProduct {
  id: string;
  name: string;
  originalUrl: string;
  affiliateUrl: string;
  price: string;
  category: string;
  imageUrl: string;
  rating: number;
}

export interface Character {
  id: string;
  name: string;
  age: string;
  gender: string;
  description: string;
  attire: string;
  referencePrompt: string;
  referenceImageUrl: string;
}

export interface Scene {
  id: string;
  sceneNumber: number;
  visualDescription: string;
  stableImagePrompt: string;
  voiceover: string;
  soundEffect: string;
  subtitle: string;
  duration: number; // in seconds
  imageUrl?: string;
}

export interface Script {
  id: string;
  title: string;
  productId: string;
  characterId: string;
  twistDescription: string;
  scenes: Scene[];
  captions: string;
  tags: string[];
}

export interface PipelineLog {
  id: string;
  timestamp: string;
  step: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface PipelineTask {
  id: string;
  scriptTitle: string;
  productName: string;
  status: 'idle' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  logs: PipelineLog[];
  videoUrl?: string;
}

export interface AppConfig {
  shopeePartnerId: string;
  openaiKey: string;
  leonardoKey: string;
  runwayKey: string;
  elevenlabsKey: string;
  makeWebhookUrl: string;
  makeWebhookApiKey?: string;
  autoPilotEnabled: boolean;
  frequencyHours: number;
  lastKnownAppUrl?: string;
  youtubeClientId?: string;
  youtubeClientSecret?: string;
  youtubeAccessToken?: string;
  youtubeRefreshToken?: string;
  youtubeChannelName?: string;
  youtubeUploadPrivacy?: 'private' | 'unlisted' | 'public';
  uploadChannel?: 'make' | 'youtube_direct';
}

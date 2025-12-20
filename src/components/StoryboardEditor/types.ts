import { AudioSegment } from "@/utils/audioSplitter";

export interface Scene {
  id: string;
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  prompt: string;
  audioSegment?: AudioSegment;
  status: "pending" | "generating" | "completed" | "failed";
  videoUrl?: string;
  requestId?: string;
  selected: boolean;
}

export interface StoryboardSettings {
  basePrompt: string;
  referenceImage: string | null;
  aspectRatio: "16:9" | "9:16" | "1:1";
  clipDuration: number;
  preserveFace: boolean;
}

export type StoryboardStep = "setup" | "audio" | "timeline" | "generate";

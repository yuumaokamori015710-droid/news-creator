export type ProjectStatus =
  | "NEWS_SELECTED"
  | "SCRIPT_GENERATED"
  | "SCRIPT_APPROVED"
  | "AUDIO_UPLOADED"
  | "TRANSCRIBED"
  | "ASSETS_COLLECTED"
  | "VIDEO_PROCESSING"
  | "VIDEO_COMPLETED"
  | "VIDEO_FAILED"
  | "PUBLISHED";

export type NewsItem = {
  id: string;
  titleJa: string;
  titleEn: string;
  summaryJa: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  importanceScore: number;
  videoSuitabilityScore: number;
  selectionReason: string;
  createdAt: string;
};

export type Project = {
  id: string;
  selectedNewsId: string;
  status: ProjectStatus;
  shortsTitle: string;
  scriptEn: string;
  scriptJa: string;
  pronunciationGuide: string;
  descriptionEn: string;
  hashtags: string;
  searchKeywords: string;
  estimatedDuration: number;
  wordCount: number;
  audioPath: string | null;
  transcription: string | null;
  subtitlePath: string | null;
  videoPath: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  news?: NewsItem;
};

export type MediaAsset = {
  id: string;
  projectId: string;
  type: "image" | "video" | "generated";
  source: string;
  sourceUrl: string;
  localPath: string;
  author: string;
  license: string;
  searchKeyword: string;
};

export type SubtitleCue = {
  index: number;
  start: number;
  end: number;
  text: string;
};

import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bundledFfmpegPath = require("ffmpeg-static") as string | null;

export const rootDir = process.cwd();
export const dataDir = path.join(rootDir, "data");
export const storageDir = path.join(rootDir, "storage");
export const dbPath = path.join(dataDir, "app.db");

export const storage = {
  audio: path.join(storageDir, "audio"),
  assets: path.join(storageDir, "assets"),
  subtitles: path.join(storageDir, "subtitles"),
  videos: path.join(storageDir, "videos")
};

export const appConfig = {
  timezone: process.env.APP_TIMEZONE || "Asia/Tokyo",
  ffmpegPath: process.env.FFMPEG_PATH || bundledFfmpegPath || "ffmpeg",
  youtubeUploadEnabled: process.env.YOUTUBE_UPLOAD_ENABLED === "true"
};

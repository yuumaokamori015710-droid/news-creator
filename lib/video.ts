import fs from "node:fs";
import path from "node:path";
import { storage } from "./config";
import { listAssets, updateProject } from "./db";
import { getMediaDurationSeconds, normalizeFfmpegError, runFfmpeg } from "./ffmpeg";
import { estimateDuration, makeSubtitleCues, saveSubtitles } from "./subtitles";
import type { Project } from "./types";

export async function generateVideo(project: Project) {
  if (!project.audioPath) throw new Error("Audio is required before video generation.");
  const transcript = project.transcription || project.scriptEn;
  if (!transcript) throw new Error("Script is required before video generation.");
  const assets = listAssets(project.id);
  const asset = assets[0];
  if (!asset) throw new Error("No background asset was prepared.");
  fs.mkdirSync(storage.videos, { recursive: true });
  const output = path.join(storage.videos, `${project.id}.mp4`);
  updateProject(project.id, { status: "VIDEO_PROCESSING", errorMessage: null });

  const mediaDuration = await getMediaDurationSeconds(project.audioPath);
  const subtitleDuration = mediaDuration || project.estimatedDuration || estimateDuration(transcript);
  const cues = makeSubtitleCues(transcript, subtitleDuration);
  const { assPath } = saveSubtitles(project.id, cues);

  const title = sanitizeDrawText(project.shortsTitle || project.news?.titleEn || "Japan News").slice(0, 34);
  const subtitlePath = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");
  const countdown = "drawtext=text='%{eif\\:max(0\\,60-t)\\:d}s':fontcolor=white:fontsize=44:x=w-tw-56:y=96:box=1:boxcolor=black@0.55:boxborderw=14";
  const usesGeneratedBackground = path.extname(asset.localPath).toLowerCase() === ".svg";
  const visualProfile = pickVisualProfile(project);
  const videoInputArgs = usesGeneratedBackground
    ? ["-f", "lavfi", "-i", `color=c=${visualProfile.background}:s=1080x1920:r=30`]
    : ["-loop", "1", "-i", asset.localPath];
  const baseVideoFilter = usesGeneratedBackground
    ? buildGeneratedBackgroundFilter(visualProfile)
    : "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,drawbox=x=0:y=0:w=1080:h=1920:color=black@0.28:t=fill";
  const args = [
    "-y",
    ...videoInputArgs,
    "-i",
    project.audioPath,
    "-vf",
    `${baseVideoFilter},drawtext=text='${title}':fontcolor=white:fontsize=42:x=56:y=96:box=1:boxcolor=black@0.45:boxborderw=16,${countdown},subtitles='${subtitlePath}'`,
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    output
  ];

  try {
    await runFfmpeg(args);
    updateProject(project.id, { status: "VIDEO_COMPLETED", subtitlePath: assPath, videoPath: output, errorMessage: null });
    return output;
  } catch (error) {
    const friendlyMessage = normalizeFfmpegError(error);
    updateProject(project.id, { status: "VIDEO_FAILED", errorMessage: friendlyMessage });
    throw new Error(friendlyMessage);
  }
}

function sanitizeDrawText(value: string) {
  return value.replace(/[\\:']/g, " ").slice(0, 74);
}

type VisualProfile = {
  background: string;
  accent: string;
  glow: string;
  tokens: string[];
};

function pickVisualProfile(project: Project): VisualProfile {
  const text = [
    project.shortsTitle,
    project.scriptEn,
    project.transcription,
    project.searchKeywords,
    project.news?.titleJa,
    project.news?.summaryJa,
    project.news?.category
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (matchesAny(text, ["yen", "jpy", "dollar", "currency", "intervention", "為替", "介入", "円", "ドル"])) {
    return {
      background: "0x102a2a",
      accent: "0xf8fafc",
      glow: "0x0f766e",
      tokens: ["YEN", "JPY", "USD/JPY", "4T YEN", "FX"]
    };
  }
  if (matchesAny(text, ["ai", "semiconductor", "chip", "robot", "technology", "半導体", "ロボット"])) {
    return {
      background: "0x111827",
      accent: "0x93c5fd",
      glow: "0x22d3ee",
      tokens: ["AI", "CHIP", "DATA", "ROBOT", "TOKYO"]
    };
  }
  if (matchesAny(text, ["weather", "typhoon", "rain", "earthquake", "disaster", "台風", "大雨", "地震", "災害"])) {
    return {
      background: "0x1f2937",
      accent: "0xbfdbfe",
      glow: "0x38bdf8",
      tokens: ["ALERT", "RAIN", "JMA", "SAFETY", "MAP"]
    };
  }
  if (matchesAny(text, ["tourism", "travel", "visitor", "hotel", "観光", "訪日", "旅行"])) {
    return {
      background: "0x172554",
      accent: "0xfef3c7",
      glow: "0xf59e0b",
      tokens: ["TOKYO", "HOTEL", "TRAIN", "VISIT", "YEN"]
    };
  }
  return {
    background: "0x173f3a",
    accent: "0xf8fafc",
    glow: "0x14b8a6",
    tokens: ["JAPAN", "NEWS", "MARKET", "TODAY", "60 SEC"]
  };
}

function buildGeneratedBackgroundFilter(profile: VisualProfile) {
  const fallingText = profile.tokens.map((token, index) => {
    const x = 96 + ((index * 187) % 820);
    const speed = 76 + index * 18;
    const offset = index * 360;
    const size = index % 2 === 0 ? 72 : 54;
    const alpha = index % 2 === 0 ? "0.52" : "0.36";
    return `drawtext=text='${sanitizeDrawText(token)}':fontcolor=${profile.accent}@${alpha}:fontsize=${size}:x=${x}:y=mod(t*${speed}+${offset}\\,2200)-220:box=1:boxcolor=black@0.18:boxborderw=14`;
  });

  return [
    "format=yuv420p",
    `drawbox=x=0:y=0:w=1080:h=1920:color=${profile.glow}@0.16:t=fill`,
    `drawbox=x=(t*82)-floor(t*82/1280)*1280-220:y=0:w=220:h=1920:color=${profile.accent}@0.08:t=fill`,
    `drawbox=x=1080-((t*46)-floor(t*46/1340)*1340):y=0:w=170:h=1920:color=${profile.glow}@0.24:t=fill`,
    ...fallingText,
    "drawbox=x=0:y=0:w=1080:h=1920:color=black@0.18:t=fill"
  ].join(",");
}

function matchesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

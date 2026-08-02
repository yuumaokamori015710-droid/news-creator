import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { appConfig, storage } from "./config";
import { listAssets, updateProject } from "./db";
import type { Project } from "./types";

export async function generateVideo(project: Project) {
  if (!project.audioPath) throw new Error("Audio is required before video generation.");
  if (!project.subtitlePath) throw new Error("Subtitles are required before video generation.");
  const assets = listAssets(project.id);
  const asset = assets[0];
  if (!asset) throw new Error("No background asset was prepared.");
  fs.mkdirSync(storage.videos, { recursive: true });
  const output = path.join(storage.videos, `${project.id}.mp4`);
  updateProject(project.id, { status: "VIDEO_PROCESSING", errorMessage: null });

  const title = sanitizeDrawText(project.shortsTitle || project.news?.titleEn || "Japan News");
  const subtitlePath = project.subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:");
  const args = [
    "-y",
    "-loop",
    "1",
    "-i",
    asset.localPath,
    "-i",
    project.audioPath,
    "-vf",
    `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,drawbox=x=0:y=0:w=1080:h=1920:color=black@0.28:t=fill,drawtext=text='${title}':fontcolor=white:fontsize=60:x=72:y=120:box=1:boxcolor=black@0.45:boxborderw=22,subtitles='${subtitlePath}'`,
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
    await run(appConfig.ffmpegPath, args);
    updateProject(project.id, { status: "VIDEO_COMPLETED", videoPath: output, errorMessage: null });
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : "FFmpeg failed.";
    updateProject(project.id, { status: "VIDEO_FAILED", errorMessage: message });
    throw new Error(message.includes("ENOENT") ? "FFmpeg was not found. Install FFmpeg or set FFMPEG_PATH in .env." : message);
  }
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      code === 0 ? resolve() : reject(new Error(stderr || `Command exited with code ${code}`));
    });
  });
}

function sanitizeDrawText(value: string) {
  return value.replace(/[\\:']/g, " ").slice(0, 74);
}

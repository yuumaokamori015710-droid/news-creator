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
  const countdown = "drawtext=text='%{eif\\:max(0\\,60-t)\\:d}s':fontcolor=white:fontsize=56:x=w-tw-72:y=118:box=1:boxcolor=black@0.55:boxborderw=18";
  const usesGeneratedBackground = path.extname(asset.localPath).toLowerCase() === ".svg";
  const videoInputArgs = usesGeneratedBackground
    ? ["-f", "lavfi", "-i", "color=c=0x173f3a:s=1080x1920:r=30"]
    : ["-loop", "1", "-i", asset.localPath];
  const baseVideoFilter = usesGeneratedBackground
    ? "format=yuv420p,drawbox=x=0:y=0:w=1080:h=1920:color=black@0.12:t=fill"
    : "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,drawbox=x=0:y=0:w=1080:h=1920:color=black@0.28:t=fill";
  const args = [
    "-y",
    ...videoInputArgs,
    "-i",
    project.audioPath,
    "-vf",
    `${baseVideoFilter},drawtext=text='${title}':fontcolor=white:fontsize=60:x=72:y=120:box=1:boxcolor=black@0.45:boxborderw=22,${countdown},subtitles='${subtitlePath}'`,
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
    await run(resolveFfmpegPath(), args);
    updateProject(project.id, { status: "VIDEO_COMPLETED", videoPath: output, errorMessage: null });
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : "FFmpeg failed.";
    const friendlyMessage = message.includes("ENOENT")
      ? "FFmpegが見つかりません。プロジェクト依存のffmpeg-staticを入れるか、.envのFFMPEG_PATHにffmpeg.exeのパスを設定してください。"
      : message;
    updateProject(project.id, { status: "VIDEO_FAILED", errorMessage: friendlyMessage });
    throw new Error(friendlyMessage);
  }
}

function resolveFfmpegPath() {
  const configuredPath = appConfig.ffmpegPath;
  if (configuredPath !== "ffmpeg" && commandExists(configuredPath)) return configuredPath;

  const localBinary = path.join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  return fs.existsSync(localBinary) ? localBinary : configuredPath;
}

function commandExists(command: string) {
  return path.isAbsolute(command) && fs.existsSync(command);
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

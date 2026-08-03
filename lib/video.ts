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

  const title = sanitizeDrawText(project.shortsTitle || project.news?.titleEn || "Japan News");
  const subtitlePath = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");
  const countdown = "drawtext=text='%{eif\\:max(0\\,60-t)\\:d}s':fontcolor=white:fontsize=56:x=w-tw-72:y=118:box=1:boxcolor=black@0.55:boxborderw=18";
  const usesGeneratedBackground = path.extname(asset.localPath).toLowerCase() === ".svg";
  const videoInputArgs = usesGeneratedBackground
    ? ["-f", "lavfi", "-i", "color=c=0x173f3a:s=1080x1920:r=30"]
    : ["-loop", "1", "-i", asset.localPath];
  const baseVideoFilter = usesGeneratedBackground
    ? "format=yuv420p,noise=alls=16:allf=t+u,drawbox=x=(t*90)-floor(t*90/1260)*1260-180:y=0:w=180:h=1920:color=white@0.08:t=fill,drawbox=x=1080-((t*54)-floor(t*54/1320)*1320):y=0:w=150:h=1920:color=0x0f766e@0.22:t=fill,drawbox=x=0:y=0:w=1080:h=1920:color=black@0.10:t=fill"
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

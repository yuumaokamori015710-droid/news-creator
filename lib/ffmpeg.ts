import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { appConfig } from "./config";

export function resolveFfmpegPath() {
  const configuredPath = appConfig.ffmpegPath;
  if (configuredPath !== "ffmpeg" && commandExists(configuredPath)) return configuredPath;

  const localBinary = path.join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  return fs.existsSync(localBinary) ? localBinary : configuredPath;
}

export async function getMediaDurationSeconds(filePath: string) {
  const result = await runFfmpeg(["-hide_banner", "-i", filePath], true);
  const durationMatch = result.stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!durationMatch) return null;
  const [, hours, minutes, seconds] = durationMatch;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function normalizeFfmpegError(error: unknown) {
  const message = error instanceof Error ? error.message : "FFmpeg failed.";
  if (message.includes("ENOENT")) {
    return "FFmpegが見つかりません。プロジェクト依存のffmpeg-staticを入れるか、.envのFFMPEG_PATHにffmpeg.exeのパスを設定してください。";
  }
  if (message.includes("EFTYPE")) {
    return "FFmpegの実行ファイルが壊れている可能性があります。npm installを再実行してください。";
  }
  return message;
}

export function runFfmpeg(args: string[], allowFailure = false) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(resolveFfmpegPath(), args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || allowFailure) {
        resolve({ stdout, stderr });
      } else {
        reject(Object.assign(new Error(stderr || `Command exited with code ${code}`), { stdout, stderr, code }));
      }
    });
  });
}

function commandExists(command: string) {
  return path.isAbsolute(command) && fs.existsSync(command);
}

import fs from "node:fs";
import path from "node:path";
import { storage } from "./config";
import type { SubtitleCue } from "./types";

export function makeSubtitleCues(text: string, durationSeconds: number): SubtitleCue[] {
  const phrases = splitIntoPhrases(text);
  const safeDuration = Math.max(durationSeconds || estimateDuration(text), phrases.length * 1.2);
  const totalWords = phrases.reduce((sum, phrase) => sum + phrase.split(/\s+/).length, 0);
  let cursor = 0;
  return phrases.map((phrase, index) => {
    const weight = phrase.split(/\s+/).length / Math.max(totalWords, 1);
    const cueDuration = Math.max(1.1, safeDuration * weight);
    const cue = {
      index: index + 1,
      start: cursor,
      end: Math.min(safeDuration, cursor + cueDuration),
      text: phrase
    };
    cursor = cue.end;
    return cue;
  });
}

export function saveSubtitles(projectId: string, cues: SubtitleCue[]) {
  fs.mkdirSync(storage.subtitles, { recursive: true });
  const srtPath = path.join(storage.subtitles, `${projectId}.srt`);
  const assPath = path.join(storage.subtitles, `${projectId}.ass`);
  fs.writeFileSync(srtPath, toSrt(cues), "utf8");
  fs.writeFileSync(assPath, toAss(cues), "utf8");
  return { srtPath, assPath };
}

export function estimateDuration(text: string) {
  return Math.ceil((text.split(/\s+/).filter(Boolean).length / 145) * 60);
}

function splitIntoPhrases(text: string) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const phrases: string[] = [];
  let current: string[] = [];
  for (const word of words) {
    current.push(word);
    const joined = current.join(" ");
    if (current.length >= 5 || /[.!?]$/.test(word) || joined.length > 34) {
      phrases.push(joined);
      current = [];
    }
  }
  if (current.length) phrases.push(current.join(" "));
  return phrases;
}

function toSrt(cues: SubtitleCue[]) {
  return cues
    .map((cue) => `${cue.index}\n${formatSrt(cue.start)} --> ${formatSrt(cue.end)}\n${cue.text}\n`)
    .join("\n");
}

function toAss(cues: SubtitleCue[]) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,74,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,1,0,0,0,100,100,0,0,1,5,1,2,86,86,260,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  return header + cues.map((cue) => `Dialogue: 0,${formatAss(cue.start)},${formatAss(cue.end)},Default,,0,0,0,,${cue.text}`).join("\n");
}

function formatSrt(seconds: number) {
  const ms = Math.floor((seconds % 1) * 1000);
  const whole = Math.floor(seconds);
  const s = whole % 60;
  const m = Math.floor(whole / 60) % 60;
  const h = Math.floor(whole / 3600);
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, "0")}`;
}

function formatAss(seconds: number) {
  const cs = Math.floor((seconds % 1) * 100);
  const whole = Math.floor(seconds);
  const s = whole % 60;
  const m = Math.floor(whole / 60) % 60;
  const h = Math.floor(whole / 3600);
  return `${h}:${pad(m)}:${pad(s)}.${String(cs).padStart(2, "0")}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

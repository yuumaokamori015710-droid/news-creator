import fs from "node:fs";
import path from "node:path";
import { storage } from "./config";
import { createAsset, listAssets } from "./db";
import type { Project } from "./types";

export function ensureFallbackAssets(project: Project) {
  const existing = listAssets(project.id);
  if (existing.length) return existing;
  fs.mkdirSync(storage.assets, { recursive: true });
  const svgPath = path.join(storage.assets, `${project.id}-background.svg`);
  const title = escapeXml(project.news?.titleEn || "Japan News");
  const category = escapeXml(project.news?.category || "News");
  fs.writeFileSync(
    svgPath,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#102a2a"/>
      <stop offset="0.52" stop-color="#f3efe4"/>
      <stop offset="1" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#g)"/>
  <rect x="72" y="132" width="936" height="210" rx="28" fill="rgba(0,0,0,.48)"/>
  <text x="104" y="218" font-family="Arial, sans-serif" font-size="42" fill="#ffffff" font-weight="700">${category}</text>
  <text x="104" y="292" font-family="Arial, sans-serif" font-size="54" fill="#ffffff" font-weight="700">${title}</text>
  <circle cx="870" cy="1540" r="220" fill="rgba(255,255,255,.16)"/>
  <circle cx="210" cy="1560" r="128" fill="rgba(15,118,110,.32)"/>
</svg>`,
    "utf8"
  );
  return [
    createAsset({
      projectId: project.id,
      type: "generated",
      source: "Local fallback",
      sourceUrl: "local://generated-background",
      localPath: svgPath,
      author: "App generated",
      license: "Generated local fallback; review before publishing commercially",
      searchKeyword: project.searchKeywords || "Japan news"
    })
  ];
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] || char);
}

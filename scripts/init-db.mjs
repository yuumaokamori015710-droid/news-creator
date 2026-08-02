import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const dataDir = path.join(root, "data");
const dbPath = path.join(dataDir, "app.db");
fs.mkdirSync(dataDir, { recursive: true });
for (const dir of ["audio", "assets", "subtitles", "videos"]) {
  fs.mkdirSync(path.join(root, "storage", dir), { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec(`
CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY,
  titleJa TEXT NOT NULL,
  titleEn TEXT NOT NULL,
  summaryJa TEXT NOT NULL,
  category TEXT NOT NULL,
  sourceName TEXT NOT NULL,
  sourceUrl TEXT NOT NULL,
  publishedAt TEXT NOT NULL,
  importanceScore INTEGER NOT NULL,
  videoSuitabilityScore INTEGER NOT NULL,
  selectionReason TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  selectedNewsId TEXT NOT NULL,
  status TEXT NOT NULL,
  shortsTitle TEXT NOT NULL DEFAULT '',
  scriptEn TEXT NOT NULL DEFAULT '',
  scriptJa TEXT NOT NULL DEFAULT '',
  pronunciationGuide TEXT NOT NULL DEFAULT '',
  descriptionEn TEXT NOT NULL DEFAULT '',
  hashtags TEXT NOT NULL DEFAULT '',
  searchKeywords TEXT NOT NULL DEFAULT '',
  estimatedDuration REAL NOT NULL DEFAULT 0,
  wordCount INTEGER NOT NULL DEFAULT 0,
  audioPath TEXT,
  transcription TEXT,
  subtitlePath TEXT,
  videoPath TEXT,
  errorMessage TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  sourceUrl TEXT NOT NULL,
  localPath TEXT NOT NULL,
  author TEXT NOT NULL,
  license TEXT NOT NULL,
  searchKeyword TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_updatedAt ON projects(updatedAt);
CREATE INDEX IF NOT EXISTS idx_media_assets_projectId ON media_assets(projectId);
`);

const now = new Date().toISOString();
const rows = [
  ["mock-economy-yen", "円相場、輸出企業と家計への影響に注目", "Japan Watches the Yen's Impact on Business and Households", "円相場の変動を受け、輸出企業の業績や輸入品価格への影響が注目されています。", "経済", "MVP mock feed", "https://www.boj.or.jp/", now, 86, 78, "海外視聴者にも日本経済との関係が伝わりやすい話題です。", now],
  ["mock-tech-robotics", "日本企業、介護現場向けロボット導入を拡大", "Japanese Companies Expand Robots for Elder Care", "人手不足が続く介護現場で、移動補助や見守りを支援するロボットの導入が広がっています。", "科学技術", "MVP mock feed", "https://www.meti.go.jp/", now, 81, 91, "日本らしい技術と社会課題を同時に扱えます。", now],
  ["mock-culture-tourism", "訪日観光、地方都市への関心が高まる", "Foreign Visitors Show More Interest in Regional Japan", "訪日旅行者の間で、地方都市や自然体験への関心が高まっています。", "文化", "MVP mock feed", "https://www.jnto.go.jp/", now, 76, 88, "海外向けShortsと相性がよい安全な話題です。", now]
];
const insert = db.prepare(`INSERT OR REPLACE INTO news_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const row of rows) insert.run(...row);
console.log(`Initialized ${dbPath}`);

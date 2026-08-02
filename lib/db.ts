import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dataDir, dbPath, storage } from "./config";
import { mockNews } from "./mockNews";
import { collectPublicNews } from "./newsProviders";
import type { MediaAsset, NewsItem, Project } from "./types";

let db: DatabaseSync | null = null;

function openDb() {
  if (db) return db;
  fs.mkdirSync(dataDir, { recursive: true });
  Object.values(storage).forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  initDb(db);
  return db;
}

export function initDb(database = openDb()) {
  database.exec(`
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
      updatedAt TEXT NOT NULL,
      FOREIGN KEY(selectedNewsId) REFERENCES news_items(id)
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
      searchKeyword TEXT NOT NULL,
      FOREIGN KEY(projectId) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_projects_updatedAt ON projects(updatedAt);
    CREATE INDEX IF NOT EXISTS idx_media_assets_projectId ON media_assets(projectId);
  `);
  seedNews(database);
}

export function seedNews(database = openDb()) {
  const insert = database.prepare(`
    INSERT OR REPLACE INTO news_items (
      id, titleJa, titleEn, summaryJa, category, sourceName, sourceUrl, publishedAt,
      importanceScore, videoSuitabilityScore, selectionReason, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const item of mockNews) {
    insert.run(
      item.id,
      item.titleJa,
      item.titleEn,
      item.summaryJa,
      item.category,
      item.sourceName,
      item.sourceUrl,
      item.publishedAt,
      item.importanceScore,
      item.videoSuitabilityScore,
      item.selectionReason,
      item.createdAt
    );
  }
}

export function listNews(): NewsItem[] {
  return openDb()
    .prepare("SELECT * FROM news_items ORDER BY createdAt DESC, importanceScore DESC, videoSuitabilityScore DESC, publishedAt DESC LIMIT 5")
    .all() as NewsItem[];
}

export function getNews(id: string): NewsItem | null {
  return (openDb().prepare("SELECT * FROM news_items WHERE id = ?").get(id) as NewsItem | undefined) ?? null;
}

export async function refreshNews(): Promise<NewsItem[]> {
  const collected = await collectPublicNews().catch((error) => {
    console.warn("Public news collection failed. Falling back to mock news.", error);
    return [];
  });
  upsertNews(collected.length ? collected : mockNews);
  return listNews();
}

export function upsertNews(items: NewsItem[], database = openDb()) {
  const insert = database.prepare(`
    INSERT OR REPLACE INTO news_items (
      id, titleJa, titleEn, summaryJa, category, sourceName, sourceUrl, publishedAt,
      importanceScore, videoSuitabilityScore, selectionReason, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const item of items) {
    insert.run(
      item.id,
      item.titleJa,
      item.titleEn,
      item.summaryJa,
      item.category,
      item.sourceName,
      item.sourceUrl,
      item.publishedAt,
      item.importanceScore,
      item.videoSuitabilityScore,
      item.selectionReason,
      item.createdAt
    );
  }
}

export function createProject(newsId: string): Project {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  openDb()
    .prepare(
      "INSERT INTO projects (id, selectedNewsId, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)"
    )
    .run(id, newsId, "NEWS_SELECTED", now, now);
  return getProject(id)!;
}

export function listProjects(): Project[] {
  return openDb()
    .prepare(
      `SELECT p.*, n.id as n_id, n.titleJa, n.titleEn, n.summaryJa, n.category, n.sourceName, n.sourceUrl,
              n.publishedAt, n.importanceScore, n.videoSuitabilityScore, n.selectionReason, n.createdAt as n_createdAt
       FROM projects p JOIN news_items n ON n.id = p.selectedNewsId
       ORDER BY p.updatedAt DESC`
    )
    .all()
    .map((row) => hydrateProject(row as Record<string, unknown>));
}

export function getProject(id: string): Project | null {
  const row = openDb()
    .prepare(
      `SELECT p.*, n.id as n_id, n.titleJa, n.titleEn, n.summaryJa, n.category, n.sourceName, n.sourceUrl,
              n.publishedAt, n.importanceScore, n.videoSuitabilityScore, n.selectionReason, n.createdAt as n_createdAt
       FROM projects p JOIN news_items n ON n.id = p.selectedNewsId WHERE p.id = ?`
    )
    .get(id);
  return row ? hydrateProject(row as Record<string, unknown>) : null;
}

export function updateProject(id: string, fields: Partial<Project>) {
  const allowed = [
    "status",
    "shortsTitle",
    "scriptEn",
    "scriptJa",
    "pronunciationGuide",
    "descriptionEn",
    "hashtags",
    "searchKeywords",
    "estimatedDuration",
    "wordCount",
    "audioPath",
    "transcription",
    "subtitlePath",
    "videoPath",
    "errorMessage"
  ];
  const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
  if (!entries.length) return getProject(id);
  const updates = entries.map(([key]) => `${key} = ?`).join(", ");
  openDb()
    .prepare(`UPDATE projects SET ${updates}, updatedAt = ? WHERE id = ?`)
    .run(...entries.map(([, value]) => value ?? null), new Date().toISOString(), id);
  return getProject(id);
}

export function createAsset(asset: Omit<MediaAsset, "id">): MediaAsset {
  const id = crypto.randomUUID();
  openDb()
    .prepare(
      "INSERT INTO media_assets (id, projectId, type, source, sourceUrl, localPath, author, license, searchKeyword) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(id, asset.projectId, asset.type, asset.source, asset.sourceUrl, asset.localPath, asset.author, asset.license, asset.searchKeyword);
  return { id, ...asset };
}

export function listAssets(projectId: string): MediaAsset[] {
  return openDb().prepare("SELECT * FROM media_assets WHERE projectId = ?").all(projectId) as MediaAsset[];
}

function hydrateProject(row: Record<string, unknown>): Project {
  return {
    ...(row as unknown as Project),
    news: {
      id: row.n_id as string,
      titleJa: row.titleJa as string,
      titleEn: row.titleEn as string,
      summaryJa: row.summaryJa as string,
      category: row.category as string,
      sourceName: row.sourceName as string,
      sourceUrl: row.sourceUrl as string,
      publishedAt: row.publishedAt as string,
      importanceScore: row.importanceScore as number,
      videoSuitabilityScore: row.videoSuitabilityScore as number,
      selectionReason: row.selectionReason as string,
      createdAt: row.n_createdAt as string
    }
  };
}

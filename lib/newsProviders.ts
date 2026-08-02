import crypto from "node:crypto";
import type { NewsItem } from "./types";

type RawNews = {
  title: string;
  url: string;
  publishedAt?: string;
  sourceName: string;
  category?: string;
  summary?: string;
};

const FEEDS = {
  nhk: [
    "https://www.nhk.or.jp/rss/news/cat0.xml",
    "https://www.nhk.or.jp/rss/news/cat1.xml",
    "https://www.nhk.or.jp/rss/news/cat2.xml",
    "https://www.nhk.or.jp/rss/news/cat4.xml",
    "https://www.nhk.or.jp/rss/news/cat5.xml"
  ],
  boj: ["https://www.boj.or.jp/rss/whatsnew.xml"],
  jmaTopics: "https://www.jma.go.jp/jma/press/topics.html",
  tdnet: "https://www.release.tdnet.info/inbs/I_list_001_"
};

export async function collectPublicNews(): Promise<NewsItem[]> {
  const raw = (
    await Promise.allSettled([
      collectRssFeeds(FEEDS.nhk, "NHK NEWS WEB"),
      collectRssFeeds(FEEDS.boj, "日本銀行"),
      collectJmaTopics(),
      collectTdnet()
    ])
  ).flatMap((result) => (result.status === "fulfilled" ? result.value : []));

  return pickBalancedTopFive(rankAndNormalize(dedupe(raw)));
}

async function collectRssFeeds(urls: string[], sourceName: string): Promise<RawNews[]> {
  const settled = await Promise.allSettled(
    urls.map(async (url) => {
      const xml = await fetchText(url);
      return parseRss(xml).map((item) => ({
        ...item,
        sourceName,
        category: inferCategory(item.title, sourceName)
      }));
    })
  );
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

async function collectJmaTopics(): Promise<RawNews[]> {
  const html = await fetchText(FEEDS.jmaTopics);
  const rows = [...html.matchAll(/<li>\s*<a href="([^"]+)">([^<]+)<\/a>/g)].slice(0, 12);
  return rows.map((match) => {
    const url = new URL(match[1], FEEDS.jmaTopics).toString();
    const title = decodeHtml(stripTags(match[2]));
    return {
      title,
      url,
      sourceName: "気象庁",
      category: "防災・気象",
      summary: "気象庁の公式新着情報です。災害、防災、気象に関する一次情報として確認できます。"
    };
  });
}

async function collectTdnet(): Promise<RawNews[]> {
  const today = new Date();
  const dateKey = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const pageUrl = `${FEEDS.tdnet}${dateKey}.html`;
  const html = await fetchText(pageUrl);
  const anchors = [...html.matchAll(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/g)]
    .map((match) => ({ url: new URL(match[1], pageUrl).toString(), title: decodeHtml(stripTags(match[2])) }))
    .filter((item) => item.title.length > 8 && /決算|業績|配当|自己株|買収|提携|子会社|上方|下方|修正|IR|開示/.test(item.title))
    .slice(0, 15);

  return anchors.map((item) => ({
    title: item.title,
    url: item.url,
    sourceName: "TDnet",
    category: "企業IR",
    summary: "東京証券取引所の適時開示情報閲覧サービスで公開されている企業開示です。"
  }));
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "JapanNewsShortsStudio/0.1 (+local MVP)"
      }
    });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseRss(xml: string): RawNews[] {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/g)].map((match) => {
    const itemXml = match[0];
    const title = readXml(itemXml, "title");
    const url = readXml(itemXml, "link");
    const publishedAt = readXml(itemXml, "pubDate") || readXml(itemXml, "dc:date");
    const summary = readXml(itemXml, "description");
    return {
      title,
      url,
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
      sourceName: "RSS",
      summary
    };
  }).filter((item) => item.title && item.url);
}

function readXml(xml: string, tagName: string) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match ? decodeHtml(stripCdata(match[1]).trim()) : "";
}

function rankAndNormalize(items: RawNews[]): NewsItem[] {
  const now = new Date().toISOString();
  return items
    .map((item) => {
      const category = item.category || inferCategory(item.title, item.sourceName);
      const importanceScore = scoreImportance(item.title, item.sourceName, category);
      const videoSuitabilityScore = scoreVideoSuitability(item.title, category);
      const publishedAt = item.publishedAt || now;
      return {
        id: stableId(item.sourceName, item.url || item.title),
        titleJa: item.title,
        titleEn: makeTitleEn(item.title, item.sourceName),
        summaryJa: item.summary || `${item.sourceName}の公開情報です。記事本文は保存せず、出典リンクを確認して台本化します。`,
        category,
        sourceName: item.sourceName,
        sourceUrl: item.url,
        publishedAt,
        importanceScore,
        videoSuitabilityScore,
        selectionReason: makeSelectionReason(item.sourceName, category, importanceScore, videoSuitabilityScore),
        createdAt: now
      } satisfies NewsItem;
    })
    .sort((a, b) => (b.importanceScore + b.videoSuitabilityScore) - (a.importanceScore + a.videoSuitabilityScore));
}

function pickBalancedTopFive(items: NewsItem[]) {
  const selected: NewsItem[] = [];
  const sourceCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();

  for (const item of items) {
    if (selected.length >= 5) break;
    const sourceCount = sourceCounts.get(item.sourceName) ?? 0;
    const categoryCount = categoryCounts.get(item.category) ?? 0;
    if (sourceCount >= 3 || categoryCount >= 3) continue;
    selected.push(item);
    sourceCounts.set(item.sourceName, sourceCount + 1);
    categoryCounts.set(item.category, categoryCount + 1);
  }

  for (const item of items) {
    if (selected.length >= 5) break;
    if (selected.some((selectedItem) => selectedItem.id === item.id)) continue;
    selected.push(item);
  }

  return selected;
}

function dedupe(items: RawNews[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeTitle(item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferCategory(title: string, sourceName: string) {
  if (sourceName.includes("日銀")) return "経済";
  if (sourceName.includes("TDnet")) return "企業IR";
  if (sourceName.includes("気象")) return "防災・気象";
  if (/地震|大雨|台風|警報|津波|気象|災害/.test(title)) return "防災・気象";
  if (/株|円|市場|金利|物価|決算|景気|賃上げ|日銀|経済/.test(title)) return "経済";
  if (/政府|首相|閣議|国会|法案|選挙/.test(title)) return "政治";
  if (/企業|開発|AI|半導体|技術|研究|宇宙/.test(title)) return "科学技術";
  if (/野球|サッカー|五輪|スポーツ/.test(title)) return "スポーツ";
  return "社会";
}

function scoreImportance(title: string, sourceName: string, category: string) {
  let score = 62;
  if (sourceName.includes("NHK")) score += 16;
  if (sourceName.includes("日銀") || sourceName.includes("気象庁")) score += 12;
  if (sourceName.includes("TDnet")) score += 7;
  if (/地震|津波|大雨|台風|警報|死亡|事故|逮捕|首相|日銀|金利|物価|円/.test(title)) score += 12;
  if (category === "経済" || category === "防災・気象") score += 5;
  return clamp(score, 45, 98);
}

function scoreVideoSuitability(title: string, category: string) {
  let score = 66;
  if (/地震|台風|大雨|円|株|AI|半導体|観光|スポーツ|宇宙|ロボット/.test(title)) score += 13;
  if (category === "企業IR") score -= 6;
  if (title.length <= 42) score += 5;
  if (title.length > 80) score -= 8;
  return clamp(score, 45, 95);
}

function makeTitleEn(title: string, sourceName: string) {
  return `Japan update from ${sourceName}: ${title}`.slice(0, 120);
}

function makeSelectionReason(sourceName: string, category: string, importanceScore: number, videoSuitabilityScore: number) {
  return `${sourceName}の公開情報です。${category}カテゴリで、重要度${importanceScore}・動画化しやすさ${videoSuitabilityScore}として候補化しました。`;
}

function stableId(sourceName: string, value: string) {
  return `${sourceName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 14)}`;
}

function normalizeTitle(title: string) {
  return title.replace(/\s+/g, "").replace(/[【】「」『』（）()]/g, "").toLowerCase();
}

function stripCdata(value: string) {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

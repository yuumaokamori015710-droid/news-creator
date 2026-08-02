import crypto from "node:crypto";
import type { NewsItem } from "./types";

type RawNews = {
  title: string;
  url: string;
  publishedAt?: string;
  sourceName: string;
  category?: string;
  summary?: string;
  articleText?: string;
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

  const enriched = await enrichWithArticleText(dedupe(raw).slice(0, 30));
  return pickBalancedTopFive(rankAndNormalize(enriched));
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

async function enrichWithArticleText(items: RawNews[]) {
  const settled = await Promise.allSettled(
    items.map(async (item) => {
      const articleText = await fetchArticleText(item.url).catch(() => "");
      return {
        ...item,
        articleText,
        summary: summarizeArticleJa(item, articleText)
      };
    })
  );
  return settled.map((result, index) => (result.status === "fulfilled" ? result.value : items[index]));
}

async function fetchArticleText(url: string) {
  if (/\.pdf(?:$|\?)/i.test(url)) return "";
  const html = await fetchText(url);
  return extractReadableText(html);
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
        titleEn: makeTitleEn(item),
        summaryJa: item.summary || `${item.sourceName}の公開情報です。記事本文の取得に失敗したため、一覧情報と出典リンクをもとに台本化します。`,
        category,
        sourceName: item.sourceName,
        sourceUrl: item.url,
        publishedAt,
        importanceScore,
        videoSuitabilityScore,
        selectionReason: makeSelectionReason(item, category, importanceScore, videoSuitabilityScore),
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
  if (category === "経済" || category === "企業IR") score += 10;
  if (category === "防災・気象") score += 2;
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

function summarizeArticleJa(item: RawNews, articleText: string) {
  const baseText = normalizeWhitespace([item.title, item.summary, articleText].filter(Boolean).join("。"));
  const sentences = splitJapaneseSentences(baseText)
    .filter((sentence) => sentence.length >= 18 && sentence.length <= 180)
    .filter((sentence) => !/(関連記事|動画|シェア|リンク|このページ|Copyright|JavaScript|閉じる|JUST IN|ニュースランキング|アクセスランキング)/i.test(sentence));
  const relevantSentences = sentences.filter((sentence) => isRelevantSentence(sentence, item));
  const sourceSentences = relevantSentences.length ? relevantSentences : sentences;
  const numericSentences = sourceSentences.filter((sentence) => extractQuantitativeHighlights(sentence).length > 0);
  const picked = uniqueByText([...numericSentences.slice(0, 2), ...sourceSentences.slice(0, 4), ...sentences.slice(0, 2)]).slice(0, 4);
  const summaryText = picked.join("");
  const highlights = extractQuantitativeHighlights(summaryText || baseText).slice(0, 5);

  if (!picked.length) {
    return `${item.summary || `${item.sourceName}の公開情報です。`} 記事本文から十分な本文を抽出できませんでした。具体的な数字: ${highlights.length ? highlights.join("、") : "記事内で確認できる主要数値は限定的です。"}`;
  }

  return [
    `記事本文要約: ${picked.join("")}`,
    `具体的な数字: ${highlights.length ? highlights.join("、") : "記事内で確認できる主要数値は限定的です。"}`,
    `確認ポイント: ${makeJapaneseWatchPoint(item, picked.join(""))}`
  ].join(" ");
}

function extractReadableText(html: string) {
  const jsonBodies = [...html.matchAll(/"articleBody"\s*:\s*"((?:\\.|[^"\\])*)"/g)]
    .map((match) => unescapeJsonString(match[1]));
  const metaDescriptions = [...html.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/gi)]
    .map((match) => decodeHtml(match[1]));
  const scopedHtml = html.match(/<article[\s\S]*?<\/article>/i)?.[0] || html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html;
  const stripped = decodeHtml(
    scopedHtml
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<br\s*\/?>/gi, "。")
      .replace(/<\/p>|<\/li>|<\/h[1-6]>/gi, "。")
      .replace(/<[^>]*>/g, " ")
  );
  return normalizeWhitespace([...jsonBodies, ...metaDescriptions, stripped].filter(Boolean).join("。"));
}

function splitJapaneseSentences(text: string) {
  return normalizeWhitespace(text)
    .split(/(?<=[。！？])\s*/)
    .map((sentence) => sentence.replace(/^\d+\s*\/\s*\d+\s*/, "").trim())
    .filter(Boolean);
}

function extractQuantitativeHighlights(text: string) {
  const patterns = [
    /震度\s*\d+/g,
    /台風\s*\d+\s*号/g,
    /\d+(?:\.\d+)?\s*(?:兆円|億円|万円|円|ドル|％|%|ポイント|pt|万人|人|件|社|度|メートル|キロ|回|倍)/g,
    /\d+(?:\.\d+)?\s*(?:円|ドル|％|%|ポイント|pt)?\s*(?:→|から|より|〜|～|-)\s*\d+(?:\.\d+)?\s*(?:円|ドル|％|%|ポイント|pt)?/g
  ];
  return uniqueByText(patterns.flatMap((pattern) => text.match(pattern) ?? []))
    .filter((value) => !/^\d{4}年$|^\d{1,2}月$|^\d{1,2}日$/.test(value))
    .slice(0, 8);
}

function makeJapaneseWatchPoint(item: RawNews, text: string) {
  const combined = `${item.title} ${item.category} ${text}`;
  if (/円|為替|ドル/.test(combined)) return "為替水準、輸出企業の採算、輸入物価、政府・日銀のけん制発言。";
  if (/日銀|金利|物価|賃金/.test(combined)) return "日銀の政策期待、長期金利、銀行株、グロース株への逆風。";
  if (/決算|業績|上方|下方|配当|自社株/.test(combined)) return "企業業績の上振れ・下振れ、海外投資家の日本株需給。";
  if (/AI|半導体|ロボット|技術/.test(combined)) return "半導体関連、設備投資、AIテーマ株への波及。";
  if (/観光|訪日|旅行|ホテル/.test(combined)) return "小売、鉄道、ホテル、外食などインバウンド関連消費。";
  if (/気象|台風|大雨|地震|災害/.test(combined)) return "物流、工場稼働、保険、消費マインドへの短期影響。";
  return "日本企業決算、ドル円、海外投資家需給、日経平均の方向感。";
}

function isRelevantSentence(sentence: string, item: RawNews) {
  const titleWords = item.title.match(/[一-龥ぁ-んァ-ヶA-Za-z0-9]{2,}/g) ?? [];
  if (titleWords.some((word) => sentence.includes(word))) return true;
  const combined = `${item.title} ${item.category}`;
  if (/円|為替|ドル/.test(combined)) return /円|為替|ドル|介入|日銀|財務省/.test(sentence);
  if (/地震|台風|気象|災害|大雨|警報/.test(combined)) return /地震|台風|気象|災害|大雨|警報|震度|津波|気温|避難/.test(sentence);
  if (/決算|業績|配当|自社株/.test(combined)) return /決算|業績|配当|自社株|売上|利益|投資/.test(sentence);
  if (/観光|訪日|旅行/.test(combined)) return /観光|訪日|旅行|宿泊|消費|地域|ホテル/.test(sentence);
  return false;
}

function makeTitleEn(item: RawNews) {
  const text = `${item.category} ${item.title} ${item.summary}`;
  if (/円|為替|ドル/.test(text)) return "Yen Moves Put Japanese Stocks and Households in Focus";
  if (/日銀|金利|物価|賃金/.test(text)) return "Bank of Japan Watch Moves Back Into Focus";
  if (/決算|業績|上方|下方|配当|自社株/.test(text)) return "Japanese Earnings Put Investors on Alert";
  if (/AI|半導体/.test(text)) return "Japan Tech News Links Back to the AI and Chip Trade";
  if (/ロボット|介護/.test(text)) return "Japan Tests Robots Against a Real Labor Shortage";
  if (/観光|訪日|旅行|ホテル/.test(text)) return "Inbound Tourism Keeps Spreading Across Japan";
  if (/気象|台風|大雨|地震|災害/.test(text)) return "Japan Weather Alerts Raise Economic Disruption Risk";
  if (/政治|政府|首相|国会/.test(text)) return "Japan Politics Adds a New Policy Risk";
  return `Japan News Update from ${item.sourceName}`;
}

function makeSelectionReason(item: RawNews, category: string, importanceScore: number, videoSuitabilityScore: number) {
  const bodyStatus = item.articleText ? "記事本文を取得して要約済み" : "一覧情報中心";
  const numbers = extractQuantitativeHighlights(`${item.title} ${item.summary || ""}`).slice(0, 3);
  return `${item.sourceName}の公開情報です。${bodyStatus}。${category}カテゴリで、重要度${importanceScore}・動画化しやすさ${videoSuitabilityScore}として候補化しました。${numbers.length ? `主な数字: ${numbers.join("、")}。` : ""}`;
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

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").replace(/。+/g, "。").trim();
}

function uniqueByText(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.replace(/\s+/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function unescapeJsonString(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replace(/\\"/g, '"').replace(/\\n/g, " ");
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

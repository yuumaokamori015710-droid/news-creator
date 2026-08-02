import type { NewsItem } from "./types";

export type ScriptTone = "simple" | "natural" | "shorter" | "impact" | "objective";

export function generateScript(news: NewsItem, tone: ScriptTone = "simple") {
  const topic = news.titleEn.replace(/\.$/, "");
  const impactLine =
    tone === "impact"
      ? "It shows how quickly daily life and Japan's economy can change."
      : "It matters because the issue can affect daily life and how people outside Japan understand the country.";
  const objectiveLine =
    tone === "objective"
      ? "Officials and companies are watching the situation, but the full impact is still unclear."
      : "Many people are watching what happens next.";
  const scriptEn = [
    `Here is a quick story from Japan: ${topic}.`,
    news.summaryJa.includes("介護")
      ? "Companies are testing support robots in elder care, where workers are in short supply."
      : news.summaryJa.includes("訪日")
        ? "More visitors are looking beyond Tokyo, Kyoto, and Osaka, and choosing regional cities and nature trips."
        : "People are watching how this change may affect companies, prices, and families.",
    impactLine,
    objectiveLine,
    "The key point is simple, but the details should still be checked before posting.",
    "That is today's Japan news in simple English."
  ].join(" ");

  const easyScript = tone === "shorter" ? trimToWords(scriptEn, 65) : trimToWords(scriptEn, 80);
  const words = easyScript.split(/\s+/).filter(Boolean);
  const estimatedDuration = Math.ceil((words.length / 145) * 60);
  const searchKeywords = [
    news.category,
    "Japan news",
    topic,
    "Tokyo street",
    "Japanese city",
    "newspaper headline",
    "vertical video background"
  ];

  return {
    shortsTitle: topic,
    scriptEn: easyScript,
    scriptJa: `日本のニュースです。「${news.titleJa}」。${news.summaryJa} この話題は、海外の視聴者にも日本の今を理解する手がかりになります。`,
    pronunciationGuide: makePronunciationGuide(easyScript),
    descriptionEn: `${topic}. A short Japan news update in simple English. Source: ${news.sourceName} ${news.sourceUrl}`,
    hashtags: "#JapanNews #EnglishNews #LearnEnglish #Shorts #Japan",
    searchKeywords: searchKeywords.join(", "),
    wordCount: words.length,
    estimatedDuration
  };
}

function trimToWords(text: string, maxWords: number) {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? text : `${words.slice(0, maxWords).join(" ")}.`;
}

function makePronunciationGuide(script: string) {
  const candidates = Array.from(new Set(script.match(/\b[A-Z][a-zA-Z'-]{4,}\b/g) ?? [])).slice(0, 6);
  if (!candidates.length) return "Read slowly. Keep each sentence clear and short.";
  return candidates.map((word) => `${word}: say it slowly and clearly`).join("\n");
}

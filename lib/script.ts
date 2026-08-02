import type { NewsItem } from "./types";

export type ScriptTone = "simple" | "natural" | "shorter" | "impact" | "objective";

export function generateScript(news: NewsItem, tone: ScriptTone = "simple") {
  const topic = news.titleEn.replace(/\.$/, "");
  const hook = makeHook(news, tone);
  const intro = "Welcome to Japan News Studio, where one minute is enough to see what Japan is really dealing with.";
  const newsBody = makeNewsBody(news, tone);
  const economicImpact = makeEconomicImpact(news, tone);
  const cynicalClose = makeCynicalClose(news);
  const cta = "Like, subscribe, and tell me in the comments whether this is smart policy, or just expensive paperwork.";
  const scriptEn = [
    hook,
    intro,
    newsBody,
    economicImpact,
    cynicalClose,
    cta
  ].join("\n\n");

  const easyScript = normalizeScriptLength(scriptEn, tone);
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
    scriptJa: makeJapaneseTranslation(news),
    pronunciationGuide: makePronunciationGuide(easyScript),
    descriptionEn: `${topic}. A one-minute Japan news update in simple English. Source: ${news.sourceName} ${news.sourceUrl}`,
    hashtags: "#JapanNews #EnglishNews #LearnEnglish #Shorts #Japan",
    searchKeywords: searchKeywords.join(", "),
    wordCount: words.length,
    estimatedDuration
  };
}

function makeHook(news: NewsItem, tone: ScriptTone) {
  const topic = news.titleEn.replace(/\.$/, "");
  if (tone === "objective") return `Japan has a fresh headline, and the quiet version is still not exactly comfortable: ${topic}.`;
  if (tone === "impact") return `Japan just gave us another reminder that boring headlines can move real money: ${topic}.`;
  return `Japan has a new headline, and yes, it may be more important than it sounds: ${topic}.`;
}

function makeNewsBody(news: NewsItem, tone: ScriptTone) {
  const topic = news.titleEn.replace(/\.$/, "");
  const base =
    news.summaryJa.includes("介護")
      ? "The story is about support robots and elder care. Japan has a serious shortage of care workers, while the number of older people keeps rising. That makes new tools attractive, but also risky. A robot can help with monitoring, lifting, and simple communication. It cannot replace trust, patience, or human judgment."
      : news.summaryJa.includes("訪日")
        ? "The story is about inbound tourism moving beyond the most famous cities. More visitors are looking at regional towns, nature routes, and local food. That can spread money outside Tokyo, Kyoto, and Osaka. It also creates pressure on transport, hotels, language support, and the people who actually live there."
        : `The story is about ${topic}. The report says this issue is drawing attention in Japan right now. In plain English, it can affect companies, households, local governments, and how people overseas understand Japan. The details are still developing, so the source should be checked before posting.`;
  if (tone === "shorter") return base.split(". ").slice(0, 4).join(". ") + ".";
  return base;
}

function makeEconomicImpact(news: NewsItem, tone: ScriptTone) {
  if (tone === "objective") {
    return "Economically, the impact is still uncertain. The key questions are who pays, who benefits, and whether the change improves productivity or simply moves costs from one place to another.";
  }
  if (tone === "impact") {
    return "Economically, this matters because small changes in Japan can become big signals. Labor costs, consumer demand, investment plans, and public budgets can all shift when this kind of issue becomes normal.";
  }
  return "For the economy, the question is simple. Does this make Japan more productive, more attractive, or more expensive? Businesses will look for opportunity, consumers will watch prices, and taxpayers may get the bill.";
}

function makeCynicalClose(news: NewsItem) {
  if (news.summaryJa.includes("介護")) return "So yes, the future may have robots, but somehow the paperwork will still be done by humans.";
  if (news.summaryJa.includes("訪日")) return "Everyone loves local tourism, right up until the last train is full and the hotel price looks like a stock chart.";
  return "Japan is trying to solve tomorrow's problem with today's budget, which is basically every economy's favorite magic trick.";
}

function makeJapaneseTranslation(news: NewsItem) {
  return [
    `① 冒頭: 日本で新しいニュースが出ました。しかも、見た目よりずっと重要かもしれません。「${news.titleJa}」。`,
    "② 決まり文句: Welcome to Japan News Studio。1分で、日本で本当に起きていることを英語で見ていきます。",
    `③ ニュースの内容: 内容はこうです。${news.summaryJa} これは単なる見出しではなく、企業、自治体、家庭、そして海外から見た日本の理解にも関わる話です。投稿前には必ず元記事で細部を確認してください。`,
    "④ 経済への影響: 経済面では、生産性、消費、価格、公共予算に影響する可能性があります。誰が負担し、誰が利益を得るのかが大きなポイントです。",
    "⑤ シニカルな締め: 日本は今日の予算で明日の問題を解こうとしています。まあ、それはだいたいどの国も好きな手品です。",
    "⑥ 最後の決まり文句: 高評価、チャンネル登録、そしてコメントで意見を教えてください。これは賢い政策なのか、それとも高い書類仕事なのか。"
  ].join("\n\n");
}

function normalizeScriptLength(text: string, tone: ScriptTone) {
  const targetMax = tone === "shorter" ? 190 : 190;
  const targetMin = tone === "shorter" ? 118 : 136;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > targetMax) return trimAtSentence(text, targetMax);
  if (words.length >= targetMin) return text;
  return `${text}\n\nOne more thing: when Japan changes slowly, the world often notices late. Markets, workers, and voters usually notice first.`;
}

function trimAtSentence(text: string, maxWords: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const limited = words.slice(0, maxWords).join(" ");
  const lastStop = Math.max(limited.lastIndexOf("."), limited.lastIndexOf("?"), limited.lastIndexOf("!"));
  return lastStop > limited.length * 0.78 ? limited.slice(0, lastStop + 1) : `${limited}.`;
}

function makePronunciationGuide(script: string) {
  const candidates = Array.from(new Set(script.match(/\b[A-Z][a-zA-Z'-]{4,}\b/g) ?? [])).slice(0, 6);
  if (!candidates.length) return "Read slowly. Keep each sentence clear and short.";
  return candidates.map((word) => `${word}: say it slowly and clearly`).join("\n");
}

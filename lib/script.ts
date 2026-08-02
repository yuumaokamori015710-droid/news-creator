import type { NewsItem } from "./types";

export type ScriptTone = "simple" | "natural" | "shorter" | "impact" | "objective";

type MarketSignal = {
  item: string;
  score: string;
  direction: string;
  reason: string;
};

export function generateScript(news: NewsItem, tone: ScriptTone = "simple") {
  const topic = news.titleEn.replace(/\.$/, "");
  const hook = makeHook(news, tone);
  const intro = "Welcome to Japan News Studio. One minute to see what Japan is really dealing with.";
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
  const category = news.category.toLowerCase();
  const context = news.summaryJa;
  const base =
    context.includes("介護")
      ? "The story is about support robots and elder care. Japan has a serious shortage of care workers, while the number of older people keeps rising. That makes new tools attractive, but also risky. A robot can help with monitoring, lifting, and simple communication. It cannot replace trust, patience, or human judgment."
      : context.includes("訪日")
        ? "The story is about inbound tourism moving beyond the most famous cities. More visitors are looking at regional towns, nature routes, and local food. That can spread money outside Tokyo, Kyoto, and Osaka. It also creates pressure on transport, hotels, language support, and the people who actually live there."
        : category.includes("weather") || context.includes("気象") || context.includes("災害")
          ? `The story is about ${topic}. Weather warnings are not just safety information. They can disrupt trains, factories, deliveries, travel plans, and local shopping. For a one-minute update, the key is to say where the warning applies, what people are being told to check, and which daily systems could slow down first.`
          : category.includes("markets") || context.includes("円") || context.includes("株") || context.includes("決算")
            ? `The story is about ${topic}. This is market news, but it is not only for traders. Exchange rates, earnings, and stock prices can change import costs, export profits, household prices, and investor mood. The practical question is which side gets help first, and which side quietly pays for it later.`
            : `The story is about ${topic}. The report says this issue is drawing attention in Japan right now. In plain English, name the people affected, the money involved, and the part of daily life that could change. That makes the update more concrete than simply repeating the headline. The details are still developing, so the source should be checked before posting.`;
  if (tone === "shorter") return base.split(". ").slice(0, 4).join(". ") + ".";
  return base;
}

function makeEconomicImpact(news: NewsItem, tone: ScriptTone) {
  const signals = pickMarketSignals(news).slice(0, 2);
  const signalText = signals
    .map((signal) => `${signal.item} ${signal.score} ${signal.direction}: ${signal.reason}`)
    .join("; ");
  if (tone === "objective") {
    return `Economically, watch these scorecard items: ${signalText}. The question is whether profits, inflation, rates, or investor demand change first.`;
  }
  if (tone === "impact") {
    return `Economically, the moving parts are specific: ${signalText}. If one shifts hard, this can become a Nikkei, yen, or sector trade quickly.`;
  }
  return `For the economy, focus on what moves: ${signalText}.`;
}

function makeCynicalClose(news: NewsItem) {
  if (news.summaryJa.includes("介護")) return "So yes, the future may have robots, but somehow the paperwork will still be done by humans.";
  if (news.summaryJa.includes("訪日")) return "Everyone loves local tourism, right up until the last train is full and the hotel price looks like a stock chart.";
  return "Japan is trying to solve tomorrow's problem with today's budget, which is basically every economy's favorite magic trick.";
}

function makeJapaneseTranslation(news: NewsItem) {
  const signals = pickMarketSignals(news)
    .map((signal) => `${signal.item}（${signal.score}）は${signal.direction}方向。理由は${signal.reason}。`)
    .join(" ");
  return [
    `① 冒頭: 日本で新しいニュースが出ました。しかも、見た目よりずっと重要かもしれません。「${news.titleJa}」。`,
    "② 決まり文句: Welcome to Japan News Studio。1分で、日本で本当に起きていることを英語で見ていきます。",
    `③ ニュースの内容: 内容はこうです。${news.summaryJa} ここでは、誰に影響するのか、どのお金が動くのか、生活や企業活動のどこが変わるのかまで具体的に伝えます。単なる見出しの紹介で終わらせず、投稿前には元記事で細部を確認します。`,
    `④ 経済への影響: スコア表で特に動きそうなのはここです。${signals}`,
    "⑤ シニカルな締め: 日本は今日の予算で明日の問題を解こうとしています。まあ、それはだいたいどの国も好きな手品です。",
    "⑥ 最後の決まり文句: 高評価、チャンネル登録、そしてコメントで意見を教えてください。これは賢い政策なのか、それとも高い書類仕事なのか。"
  ].join("\n\n");
}

function pickMarketSignals(news: NewsItem): MarketSignal[] {
  const text = `${news.category} ${news.titleJa} ${news.titleEn} ${news.summaryJa}`.toLowerCase();
  if (matches(text, ["円", "ドル", "為替", "yen", "currency", "import", "export", "輸出", "輸入"])) {
    return [
      { item: "Dollar-yen", score: "8 out of 15", direction: "first", reason: "currency news can hit exporters, import prices, and intervention risk" },
      { item: "Japanese earnings", score: "8 out of 10", direction: "next", reason: "the yen changes profit guidance" },
      { item: "Nikkei futures technicals", score: "3 out of 5", direction: "after that", reason: "index traders usually react through futures before the real economy catches up" }
    ];
  }
  if (matches(text, ["ai", "半導体", "chip", "semiconductor", "technology", "robot", "ロボット", "tech"])) {
    return [
      { item: "U.S. stocks, S&P and NASDAQ", score: "17 out of 20", direction: "first", reason: "AI earnings are already strong" },
      { item: "SOX semiconductors", score: "11 out of 15", direction: "next", reason: "chip and automation demand can reprice suppliers" },
      { item: "Japanese earnings", score: "8 out of 10", direction: "after that", reason: "investors will ask which Japanese companies can turn the theme into profit" }
    ];
  }
  if (matches(text, ["日銀", "boj", "金利", "rate", "yield", "物価", "inflation", "賃金", "wage"])) {
    return [
      { item: "Bank of Japan", score: "4 out of 10", direction: "first", reason: "inflation or wages can shift policy expectations" },
      { item: "U.S. 10-year yield", score: "3 out of 10", direction: "next", reason: "higher yields pressure equities" },
      { item: "Dollar-yen", score: "8 out of 15", direction: "after that", reason: "rate gaps are one of the cleanest channels into the currency" }
    ];
  }
  if (matches(text, ["決算", "earnings", "tdnet", "profit", "sales", "revenue", "企業"])) {
    return [
      { item: "Japanese earnings", score: "8 out of 10", direction: "first", reason: "guidance is the direct channel into prices" },
      { item: "Foreign investor flows", score: "3 out of 5", direction: "next", reason: "overseas investors may adjust Japan exposure" },
      { item: "Nikkei futures technicals", score: "3 out of 5", direction: "after that", reason: "earnings surprises often show up quickly in futures" }
    ];
  }
  if (matches(text, ["観光", "訪日", "tourism", "travel", "hotel", "visitor", "消費"])) {
    return [
      { item: "Japanese earnings", score: "8 out of 10", direction: "first", reason: "retail, rail, and hotel profits can react" },
      { item: "Dollar-yen", score: "8 out of 15", direction: "next", reason: "the yen changes how cheap Japan feels" },
      { item: "Foreign investor flows", score: "3 out of 5", direction: "after that", reason: "tourism strength can support the Japan reopening narrative" }
    ];
  }
  if (matches(text, ["気象", "台風", "地震", "災害", "weather", "jma", "alert", "rain"])) {
    return [
      { item: "VIX", score: "4 out of 5", direction: "first", reason: "disaster headlines can lift risk awareness" },
      { item: "Japanese earnings", score: "8 out of 10", direction: "next", reason: "transport and factories can face disruption" },
      { item: "Nikkei futures technicals", score: "3 out of 5", direction: "after that", reason: "traders may price temporary supply-chain or demand shocks" }
    ];
  }
  if (matches(text, ["中東", "war", "security", "geopolitical", "地政学", "energy", "oil"])) {
    return [
      { item: "Geopolitics", score: "2 out of 5", direction: "first", reason: "fresh headlines can raise the risk discount" },
      { item: "U.S. 10-year yield", score: "3 out of 10", direction: "next", reason: "safe-haven and inflation trades affect yields" },
      { item: "Dollar-yen", score: "8 out of 15", direction: "after that", reason: "risk-off moves often pass through the currency market" }
    ];
  }
  return [
    { item: "Japanese earnings", score: "8 out of 10", direction: "first", reason: "profits are the bridge from news to markets" },
    { item: "Dollar-yen", score: "8 out of 15", direction: "next", reason: "currency changes costs and margins" },
    { item: "Foreign investor flows", score: "3 out of 5", direction: "after that", reason: "global investors decide whether the story makes Japan more or less attractive" }
  ];
}

function matches(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function normalizeScriptLength(text: string, tone: ScriptTone) {
  const targetMax = tone === "shorter" ? 230 : 230;
  const targetMin = tone === "shorter" ? 118 : 136;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > targetMax) return trimAtSectionBoundaries(text, targetMax);
  if (words.length >= targetMin) return text;
  return `${text}\n\nOne more thing: when Japan changes slowly, the world often notices late. Markets, workers, and voters usually notice first.`;
}

function trimAtSectionBoundaries(text: string, maxWords: number) {
  const sections = text.split("\n\n");
  const trimmed = sections.map((section, index) => {
    const words = section.split(/\s+/).filter(Boolean);
    const limits = [28, 22, 72, 68, 22, 24];
    return words.length <= limits[index] ? section : `${words.slice(0, limits[index]).join(" ")}.`;
  });
  const trimmedText = trimmed.join("\n\n");
  const words = trimmedText.split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? trimmedText : text;
}

function makePronunciationGuide(script: string) {
  const candidates = Array.from(new Set(script.match(/\b[A-Z][a-zA-Z'-]{4,}\b/g) ?? [])).slice(0, 6);
  if (!candidates.length) return "Read slowly. Keep each sentence clear and short.";
  return candidates.map((word) => `${word}: say it slowly and clearly`).join("\n");
}

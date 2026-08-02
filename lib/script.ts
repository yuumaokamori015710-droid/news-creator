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
  const numbers = extractQuantitativeHighlights(context);
  const numberLine = numbers.length
    ? `Concrete figures: ${numbers.slice(0, 4).map(formatQuantityForEnglish).join(", ")}.`
    : "No clean market level appears in the extracted text.";
  const base =
    context.includes("介護")
      ? `The article says Japan is using robots against a real elder-care labor shortage. ${numberLine} The question is whether robots reduce costs and staff pressure, or just add another expensive system.`
      : context.includes("訪日")
        ? `The article says inbound tourism is spreading beyond the famous cities. ${numberLine} Visitor spending can lift hotels, railways, restaurants, and regional shops, while also pushing up local costs.`
        : category.includes("weather") || context.includes("気象") || context.includes("災害")
          ? `The article is about ${topic}. Weather warnings are not just safety information. ${numberLine} They can disrupt trains, factories, deliveries, travel, and shopping.`
          : category.includes("markets") || context.includes("円") || context.includes("株") || context.includes("決算")
            ? `The article is about ${topic}. ${numberLine} The market channel is direct: the yen moves first, then exporters, import prices, households, and investor mood.`
            : `The article is about ${topic}. ${numberLine} The key is who is affected, what money moves, and which part of daily life or company activity changes first.`;
  if (tone === "shorter") return base.split(". ").slice(0, 4).join(". ") + ".";
  return base;
}

function makeEconomicImpact(news: NewsItem, tone: ScriptTone) {
  const signals = pickMarketSignals(news).slice(0, 2);
  const nikkei = assessNikkeiImpact(news);
  const signalText = signals
    .map((signal) => `${signal.item} ${signal.score} ${signal.direction}: ${signal.reason}`)
    .join("; ");
  if (tone === "objective") {
    return `Economically, watch: ${signalText}. Nikkei bias: ${nikkei.direction}, confidence ${nikkei.confidence}, because ${nikkei.reason}.`;
  }
  if (tone === "impact") {
    return `Economically, watch: ${signalText}. Nikkei bias: ${nikkei.direction}, confidence ${nikkei.confidence}, because ${nikkei.reason}.`;
  }
  return `For the economy, watch: ${signalText}. Nikkei bias: ${nikkei.direction}, confidence ${nikkei.confidence}, because ${nikkei.reason}.`;
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
  const nikkei = assessNikkeiImpact(news);
  const numbers = extractQuantitativeHighlights(news.summaryJa);
  return [
    `① 冒頭: 日本で新しいニュースが出ました。しかも、見た目よりずっと重要かもしれません。「${news.titleJa}」。`,
    "② 決まり文句: Welcome to Japan News Studio。1分で、日本で本当に起きていることを英語で見ていきます。",
    `③ ニュースの内容: 内容はこうです。${news.summaryJa} ${numbers.length ? `具体的な数字は、${numbers.slice(0, 4).join("、")}です。` : "記事内で確認できる主要数値は限定的です。"}`,
    `④ 経済への影響: スコア表で特に動きそうなのはここです。${signals} 最終的な日経平均への方向感は「${nikkei.direction}」、確信度は${nikkei.confidence}です。理由は${nikkei.reason}。`,
    "⑤ シニカルな締め: 日本は今日の予算で明日の問題を解こうとしています。まあ、それはだいたいどの国も好きな手品です。",
    "⑥ 最後の決まり文句: 高評価、チャンネル登録、そしてコメントで意見を教えてください。これは賢い政策なのか、それとも高い書類仕事なのか。"
  ].join("\n\n");
}

function extractQuantitativeHighlights(text: string) {
  const patterns = [
    /震度\s*\d+/g,
    /台風\s*\d+\s*号/g,
    /\d+(?:\.\d+)?\s*(?:兆円|億円|万円|円|ドル|％|%|ポイント|pt|万人|人|件|社|度|メートル|キロ|回|倍)/g,
    /\d+(?:\.\d+)?\s*(?:円|ドル|％|%|ポイント|pt)?\s*(?:→|から|より|〜|～|-)\s*\d+(?:\.\d+)?\s*(?:円|ドル|％|%|ポイント|pt)?/g
  ];
  return Array.from(new Set(patterns.flatMap((pattern) => text.match(pattern) ?? [])))
    .filter((value) => !/^\d{4}年$|^\d{1,2}月$|^\d{1,2}日$/.test(value))
    .slice(0, 8);
}

function formatQuantityForEnglish(value: string) {
  return value
    .replace(/震度\s*(\d+)/g, "seismic intensity $1")
    .replace(/台風\s*(\d+)\s*号/g, "Typhoon No. $1")
    .replace(/(\d+(?:\.\d+)?)\s*兆円/g, "$1 trillion yen")
    .replace(/(\d+(?:\.\d+)?)\s*億円/g, "$1 hundred million yen")
    .replace(/(\d+(?:\.\d+)?)\s*万円/g, "$1 ten-thousand yen")
    .replace(/(\d+(?:\.\d+)?)\s*円/g, "$1 yen")
    .replace(/(\d+(?:\.\d+)?)\s*ドル/g, "$1 dollars")
    .replace(/(\d+(?:\.\d+)?)\s*万人/g, "$1 ten-thousand people")
    .replace(/(\d+(?:\.\d+)?)\s*人/g, "$1 people")
    .replace(/(\d+(?:\.\d+)?)\s*社/g, "$1 companies")
    .replace(/(\d+(?:\.\d+)?)\s*件/g, "$1 cases")
    .replace(/(\d+(?:\.\d+)?)\s*度/g, "$1 degrees Celsius");
}

function assessNikkeiImpact(news: NewsItem) {
  const text = `${news.category} ${news.titleJa} ${news.titleEn} ${news.summaryJa}`.toLowerCase();
  const yenMove = inferYenMove(text);
  if (yenMove === "stronger") {
    return {
      direction: "slight downside",
      confidence: "medium",
      reason: "a stronger yen can pressure exporters, even if it helps import costs and households"
    };
  }
  if (yenMove === "weaker") {
    return {
      direction: "slight upside",
      confidence: "medium",
      reason: "a weaker yen supports exporter earnings, but intervention risk caps the upside"
    };
  }
  if (matches(text, ["日銀", "利上げ", "タカ派", "金利上昇", "boj", "rate hike", "hawkish"])) {
    return { direction: "downside", confidence: "medium", reason: "higher rate expectations usually hurt growth stocks and valuation multiples" };
  }
  if (matches(text, ["AI", "半導体", "上方", "増益", "好決算", "自社株", "増配", "robot", "semiconductor"])) {
    return { direction: "upside", confidence: "medium", reason: "tech demand or stronger earnings can support index-heavy Japanese names" };
  }
  if (matches(text, ["下方", "減益", "赤字", "減配", "大雨", "台風", "地震", "災害", "地政学", "war"])) {
    return { direction: "downside", confidence: "medium", reason: "earnings damage, disruption, or risk-off sentiment can weigh on the index" };
  }
  if (matches(text, ["訪日", "観光", "旅行", "ホテル", "消費"])) {
    return { direction: "modest upside", confidence: "low to medium", reason: "inbound demand can help domestic consumption stocks, but the index impact is narrower" };
  }
  return { direction: "neutral to slightly mixed", confidence: "low", reason: "the article does not yet show a strong channel into index earnings, rates, or the yen" };
}

function inferYenMove(text: string) {
  if (matches(text, ["円高", "yen strengthens", "stronger yen"])) return "stronger";
  if (matches(text, ["円安是正", "協調介入", "市場介入", "為替介入"])) return "stronger";
  if (matches(text, ["円安", "yen weakens", "weaker yen"])) return "weaker";
  const arrow = text.match(/(\d+(?:\.\d+)?)\s*円?\s*(?:→|から|より|-)\s*(\d+(?:\.\d+)?)\s*円/);
  if (!arrow) return "unknown";
  const from = Number(arrow[1]);
  const to = Number(arrow[2]);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return "unknown";
  return to < from ? "stronger" : "weaker";
}

function pickMarketSignals(news: NewsItem): MarketSignal[] {
  const text = `${news.category} ${news.titleJa} ${news.titleEn} ${news.summaryJa}`.toLowerCase();
  if (matches(text, ["円", "ドル", "為替", "yen", "currency", "import", "export", "輸出", "輸入"])) {
    return [
      { item: "Dollar-yen", score: "8/15", direction: "first", reason: "exporters, import prices, and intervention risk move fast" },
      { item: "Japanese earnings", score: "8/10", direction: "next", reason: "the yen changes profit guidance" },
      { item: "Nikkei futures technicals", score: "3/5", direction: "after that", reason: "futures react before the real economy catches up" }
    ];
  }
  if (matches(text, ["AI", "半導体", "chip", "semiconductor", "technology", "robot", "ロボット", "tech"])) {
    return [
      { item: "U.S. stocks, S&P and NASDAQ", score: "17/20", direction: "first", reason: "AI earnings are already strong" },
      { item: "SOX semiconductors", score: "11/15", direction: "next", reason: "chip demand can reprice suppliers" },
      { item: "Japanese earnings", score: "8/10", direction: "after that", reason: "investors ask who turns the theme into profit" }
    ];
  }
  if (matches(text, ["日銀", "boj", "金利", "rate", "yield", "物価", "inflation", "賃金", "wage"])) {
    return [
      { item: "Bank of Japan", score: "4/10", direction: "first", reason: "inflation or wages shift policy expectations" },
      { item: "U.S. 10-year yield", score: "3/10", direction: "next", reason: "higher yields pressure equities" },
      { item: "Dollar-yen", score: "8/15", direction: "after that", reason: "rate gaps hit currencies" }
    ];
  }
  if (matches(text, ["決算", "earnings", "tdnet", "profit", "sales", "revenue", "企業"])) {
    return [
      { item: "Japanese earnings", score: "8/10", direction: "first", reason: "guidance directly moves prices" },
      { item: "Foreign investor flows", score: "3/5", direction: "next", reason: "overseas investors adjust Japan exposure" },
      { item: "Nikkei futures technicals", score: "3/5", direction: "after that", reason: "earnings surprises hit futures quickly" }
    ];
  }
  if (matches(text, ["気象", "台風", "地震", "災害", "weather", "jma", "alert", "rain"])) {
    return [
      { item: "VIX", score: "4/5", direction: "first", reason: "disaster headlines lift risk awareness" },
      { item: "Japanese earnings", score: "8/10", direction: "next", reason: "transport and factories can be disrupted" },
      { item: "Nikkei futures technicals", score: "3/5", direction: "after that", reason: "traders price temporary shocks" }
    ];
  }
  if (matches(text, ["観光", "訪日", "tourism", "travel", "hotel", "visitor", "消費"])) {
    return [
      { item: "Japanese earnings", score: "8/10", direction: "first", reason: "retail, rail, and hotel profits can react" },
      { item: "Dollar-yen", score: "8/15", direction: "next", reason: "the yen changes how cheap Japan feels" },
      { item: "Foreign investor flows", score: "3/5", direction: "after that", reason: "tourism supports the Japan narrative" }
    ];
  }
  if (matches(text, ["中東", "war", "security", "geopolitical", "地政学", "energy", "oil"])) {
    return [
      { item: "Geopolitics", score: "2/5", direction: "first", reason: "fresh headlines raise the risk discount" },
      { item: "U.S. 10-year yield", score: "3/10", direction: "next", reason: "safe-haven and inflation trades affect yields" },
      { item: "Dollar-yen", score: "8/15", direction: "after that", reason: "risk-off moves through currencies" }
    ];
  }
  return [
    { item: "Japanese earnings", score: "8/10", direction: "first", reason: "profits connect news to markets" },
    { item: "Dollar-yen", score: "8/15", direction: "next", reason: "currency changes costs and margins" },
    { item: "Foreign investor flows", score: "3/5", direction: "after that", reason: "global investors adjust Japan exposure" }
  ];
}

function matches(text: string, keywords: string[]) {
  return keywords.some((keyword) => {
    if (/^[a-z0-9]{1,2}$/i.test(keyword)) return new RegExp(`\\b${keyword}\\b`, "i").test(text);
    return text.includes(keyword.toLowerCase());
  });
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

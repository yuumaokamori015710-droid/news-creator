import type { NewsItem } from "./types";

export type ScriptTone = "simple" | "natural" | "shorter" | "impact" | "objective";

type MarketSignal = {
  item: string;
  labelJa: string;
  reason: string;
  reasonJa: string;
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
  const context = cleanJapaneseSummary(news.summaryJa);
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
    .map((signal) => `${signal.item}: ${signal.reason}`)
    .join("; ");
  if (tone === "objective") {
    return `Economically, watch ${signalText}. For the Nikkei Average, the bias is ${nikkei.direction}, with ${nikkei.confidence} confidence, because ${nikkei.reason}.`;
  }
  if (tone === "impact") {
    return `Economically, watch ${signalText}. For the Nikkei Average, the bias is ${nikkei.direction}, with ${nikkei.confidence} confidence, because ${nikkei.reason}.`;
  }
  return `For the economy, watch ${signalText}. For the Nikkei Average, the bias is ${nikkei.direction}, with ${nikkei.confidence} confidence, because ${nikkei.reason}.`;
}

function makeCynicalClose(news: NewsItem) {
  if (news.summaryJa.includes("介護")) return "So yes, the future may have robots, but somehow the paperwork will still be done by humans.";
  if (news.summaryJa.includes("訪日")) return "Everyone loves local tourism, right up until the last train is full and the hotel price looks like a stock chart.";
  return "Japan is trying to solve tomorrow's problem with today's budget, which is basically every economy's favorite magic trick.";
}

function makeJapaneseTranslation(news: NewsItem) {
  const signals = pickMarketSignals(news)
    .slice(0, 2)
    .map((signal) => `${signal.labelJa}。${signal.reasonJa}。`)
    .join("");
  const nikkei = assessNikkeiImpact(news);
  const summary = cleanJapaneseSummary(news.summaryJa);
  return [
    `① 冒頭: 日本で新しいニュースが出ました。しかも、見た目よりずっと重要かもしれません。「${news.titleJa}」。`,
    "② 決まり文句: Welcome to Japan News Studio。1分で、日本で本当に起きていることを英語で見ていきます。",
    `③ ニュースの内容: 内容はこうです。${summary}`,
    `④ 経済への影響: 特に見たいのは${signals} 日経平均への方向感は「${nikkei.directionJa}」です。確信度は${nikkei.confidenceJa}。理由は${nikkei.reasonJa}。`,
    "⑤ シニカルな締め: 日本は今日の予算で明日の問題を解こうとしています。まあ、それはだいたいどの国も好きな手品です。",
    "⑥ 最後の決まり文句: 高評価、チャンネル登録、そしてコメントで意見を教えてください。これは賢い政策なのか、それとも高い書類仕事なのか。"
  ].join("\n\n");
}

function cleanJapaneseSummary(summary: string) {
  return summary
    .replace(/記事本文要約[:：]\s*/g, "")
    .replace(/具体的な数字[:：][^。]*。?/g, "")
    .replace(/確認ポイント[:：][^。]*。?/g, "")
    .replace(/【NHK】/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
      directionJa: "やや下振れ",
      confidence: "medium",
      confidenceJa: "中くらい",
      reason: "a stronger yen can pressure exporters, even if it helps import costs and households",
      reasonJa: "円高方向に振れると、輸入コストや家計にはプラスでも、日経平均の比重が大きい輸出企業には逆風になりやすいからです"
    };
  }
  if (yenMove === "weaker") {
    return {
      direction: "slight upside",
      directionJa: "やや上振れ",
      confidence: "medium",
      confidenceJa: "中くらい",
      reason: "a weaker yen supports exporter earnings, but intervention risk caps the upside",
      reasonJa: "円安は輸出企業の利益を押し上げやすい一方、介入警戒が上値を抑えやすいからです"
    };
  }
  if (matches(text, ["日銀", "利上げ", "タカ派", "金利上昇", "boj", "rate hike", "hawkish"])) {
    return {
      direction: "downside",
      directionJa: "下振れ",
      confidence: "medium",
      confidenceJa: "中くらい",
      reason: "higher rate expectations usually hurt growth stocks and valuation multiples",
      reasonJa: "金利上昇期待はグロース株や株価のバリュエーションに逆風になりやすいからです"
    };
  }
  if (matches(text, ["AI", "半導体", "上方", "増益", "好決算", "自社株", "増配", "robot", "semiconductor"])) {
    return {
      direction: "upside",
      directionJa: "上振れ",
      confidence: "medium",
      confidenceJa: "中くらい",
      reason: "tech demand or stronger earnings can support index-heavy Japanese names",
      reasonJa: "半導体や好決算の材料は、日経平均への寄与が大きい主力株を支えやすいからです"
    };
  }
  if (matches(text, ["下方", "減益", "赤字", "減配", "大雨", "台風", "地震", "災害", "地政学", "war"])) {
    return {
      direction: "downside",
      directionJa: "下振れ",
      confidence: "medium",
      confidenceJa: "中くらい",
      reason: "earnings damage, disruption, or risk-off sentiment can weigh on the index",
      reasonJa: "企業活動の停止やリスク回避ムードが、指数全体の重しになりやすいからです"
    };
  }
  if (matches(text, ["訪日", "観光", "旅行", "ホテル", "消費"])) {
    return {
      direction: "modest upside",
      directionJa: "小幅に上振れ",
      confidence: "low to medium",
      confidenceJa: "低めから中くらい",
      reason: "inbound demand can help domestic consumption stocks, but the index impact is narrower",
      reasonJa: "インバウンド消費は内需株には追い風ですが、日経平均全体への波及はやや限定的だからです"
    };
  }
  return {
    direction: "neutral to slightly mixed",
    directionJa: "中立からややまちまち",
    confidence: "low",
    confidenceJa: "低め",
    reason: "the article does not yet show a strong channel into index earnings, rates, or the yen",
    reasonJa: "企業業績、金利、為替のどれに効くかがまだはっきりしないからです"
  };
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
      { item: "dollar-yen", labelJa: "ドル円の動き", reason: "exporters, import prices, and intervention risk move fast", reasonJa: "為替が動くと、輸出企業の採算、輸入物価、介入警戒がすぐに動きます" },
      { item: "Japanese corporate earnings", labelJa: "日本企業の業績見通し", reason: "the yen changes profit guidance", reasonJa: "円高・円安は企業の利益見通しに直接効きやすいです" },
      { item: "Nikkei futures", labelJa: "日経先物", reason: "futures react before the real economy catches up", reasonJa: "現物株より先に短期筋が反応しやすいです" }
    ];
  }
  if (matches(text, ["AI", "半導体", "chip", "semiconductor", "technology", "robot", "ロボット", "tech"])) {
    return [
      { item: "U.S. tech stocks and NASDAQ", labelJa: "米国ハイテク株とNASDAQ", reason: "AI earnings are already strong", reasonJa: "AI関連の決算が強いと、日本の半導体・電子部品株にも連想買いが入りやすいです" },
      { item: "semiconductor stocks", labelJa: "半導体関連株", reason: "chip demand can reprice suppliers", reasonJa: "半導体需要の見方が変わると、関連銘柄の評価が動きやすいです" },
      { item: "Japanese corporate earnings", labelJa: "日本企業の業績", reason: "investors ask who turns the theme into profit", reasonJa: "テーマだけでなく、実際に利益へつながる企業が買われやすいです" }
    ];
  }
  if (matches(text, ["日銀", "boj", "金利", "rate", "yield", "物価", "inflation", "賃金", "wage"])) {
    return [
      { item: "Bank of Japan expectations", labelJa: "日銀の政策期待", reason: "inflation or wages shift policy expectations", reasonJa: "物価や賃金の材料は、利上げ期待に直結しやすいです" },
      { item: "long-term yields", labelJa: "長期金利", reason: "higher yields pressure equities", reasonJa: "金利が上がると株式の割高感が意識されやすくなります" },
      { item: "dollar-yen", labelJa: "ドル円", reason: "rate gaps hit currencies", reasonJa: "日米金利差の見方が為替に出やすいです" }
    ];
  }
  if (matches(text, ["決算", "earnings", "tdnet", "profit", "sales", "revenue", "企業"])) {
    return [
      { item: "Japanese corporate earnings", labelJa: "日本企業の決算と業績見通し", reason: "guidance directly moves prices", reasonJa: "上方修正や下方修正は株価に直接反映されやすいです" },
      { item: "foreign investor flows", labelJa: "海外投資家の日本株需給", reason: "overseas investors adjust Japan exposure", reasonJa: "海外勢が日本株を増やすか減らすかで指数の方向感が変わります" },
      { item: "Nikkei futures", labelJa: "日経先物", reason: "earnings surprises hit futures quickly", reasonJa: "決算サプライズは先物にも早く出やすいです" }
    ];
  }
  if (matches(text, ["気象", "台風", "地震", "災害", "weather", "jma", "alert", "rain"])) {
    return [
      { item: "risk sentiment", labelJa: "投資家のリスク回避姿勢", reason: "disaster headlines lift risk awareness", reasonJa: "災害や警報は短期的にリスク回避を強めやすいです" },
      { item: "Japanese corporate earnings", labelJa: "日本企業の短期業績", reason: "transport and factories can be disrupted", reasonJa: "物流や工場稼働が止まると、一部企業の業績に影響します" },
      { item: "Nikkei futures", labelJa: "日経先物", reason: "traders price temporary shocks", reasonJa: "短期の不安材料は先物から反応しやすいです" }
    ];
  }
  if (matches(text, ["観光", "訪日", "tourism", "travel", "hotel", "visitor", "消費"])) {
    return [
      { item: "domestic consumption stocks", labelJa: "内需・消費関連株", reason: "retail, rail, and hotel profits can react", reasonJa: "小売、鉄道、ホテル、外食の売上に効きやすいです" },
      { item: "dollar-yen", labelJa: "ドル円", reason: "the yen changes how cheap Japan feels", reasonJa: "円安なら訪日客にとって日本が割安に見えやすいです" },
      { item: "foreign investor flows", labelJa: "海外投資家の日本株需給", reason: "tourism supports the Japan narrative", reasonJa: "日本株への見方が少し明るくなりやすいです" }
    ];
  }
  if (matches(text, ["中東", "war", "security", "geopolitical", "地政学", "energy", "oil"])) {
    return [
      { item: "geopolitical risk", labelJa: "地政学リスク", reason: "fresh headlines raise the risk discount", reasonJa: "地政学リスクが高まると株式のリスク許容度が下がりやすいです" },
      { item: "long-term yields", labelJa: "長期金利", reason: "safe-haven and inflation trades affect yields", reasonJa: "安全資産需要やインフレ懸念が金利を動かしやすいです" },
      { item: "dollar-yen", labelJa: "ドル円", reason: "risk-off moves through currencies", reasonJa: "リスク回避局面では為替にも動きが出やすいです" }
    ];
  }
  return [
    { item: "Japanese corporate earnings", labelJa: "日本企業の業績", reason: "profits connect news to markets", reasonJa: "最終的には企業利益に効くかどうかが株価を左右します" },
    { item: "dollar-yen", labelJa: "ドル円", reason: "currency changes costs and margins", reasonJa: "為替はコストと利益率に効きやすいです" },
    { item: "foreign investor flows", labelJa: "海外投資家の日本株需給", reason: "global investors adjust Japan exposure", reasonJa: "海外勢の資金配分が指数を動かすことがあります" }
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

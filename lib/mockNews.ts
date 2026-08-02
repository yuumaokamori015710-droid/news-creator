import type { NewsItem } from "./types";

const now = new Date();

export const mockNews: NewsItem[] = [
  {
    id: "mock-economy-yen",
    titleJa: "円相場、輸出企業と家計への影響に注目",
    titleEn: "Japan Watches the Yen's Impact on Business and Households",
    summaryJa:
      "円相場の変動を受け、輸出企業の業績や輸入品価格への影響が注目されています。家計では食品や燃料など身近な価格への波及も焦点です。",
    category: "経済",
    sourceName: "MVP mock feed",
    sourceUrl: "https://www.boj.or.jp/",
    publishedAt: now.toISOString(),
    importanceScore: 86,
    videoSuitabilityScore: 78,
    selectionReason: "海外視聴者にも日本経済との関係が伝わりやすく、30秒で説明しやすい話題です。",
    createdAt: now.toISOString()
  },
  {
    id: "mock-tech-robotics",
    titleJa: "日本企業、介護現場向けロボット導入を拡大",
    titleEn: "Japanese Companies Expand Robots for Elder Care",
    summaryJa:
      "人手不足が続く介護現場で、移動補助や見守りを支援するロボットの導入が広がっています。高齢化社会への対応として注目されています。",
    category: "科学技術",
    sourceName: "MVP mock feed",
    sourceUrl: "https://www.meti.go.jp/",
    publishedAt: now.toISOString(),
    importanceScore: 81,
    videoSuitabilityScore: 91,
    selectionReason: "日本らしい技術と社会課題を同時に扱え、背景素材も用意しやすい候補です。",
    createdAt: now.toISOString()
  },
  {
    id: "mock-culture-tourism",
    titleJa: "訪日観光、地方都市への関心が高まる",
    titleEn: "Foreign Visitors Show More Interest in Regional Japan",
    summaryJa:
      "訪日旅行者の間で、大都市だけでなく地方都市や自然体験への関心が高まっています。地域経済への効果も期待されています。",
    category: "文化",
    sourceName: "MVP mock feed",
    sourceUrl: "https://www.jnto.go.jp/",
    publishedAt: now.toISOString(),
    importanceScore: 76,
    videoSuitabilityScore: 88,
    selectionReason: "海外向けShortsと相性がよく、明るく安全なトーンで動画化できます。",
    createdAt: now.toISOString()
  },
  {
    id: "mock-weather-jma",
    titleJa: "気象庁、防災気象情報の確認を呼びかけ",
    titleEn: "Japan Meteorological Agency Urges People to Check Weather Alerts",
    summaryJa:
      "大雨や台風の季節に向けて、気象庁は最新の防災気象情報を確認するよう呼びかけています。避難判断に関わる一次情報として重要です。",
    category: "防災・気象",
    sourceName: "MVP mock feed",
    sourceUrl: "https://www.jma.go.jp/",
    publishedAt: now.toISOString(),
    importanceScore: 79,
    videoSuitabilityScore: 84,
    selectionReason: "公的機関の一次情報に近いテーマで、短い注意喚起動画にしやすい候補です。",
    createdAt: now.toISOString()
  },
  {
    id: "mock-ir-earnings",
    titleJa: "上場企業の決算発表、海外投資家も注目",
    titleEn: "Japanese Earnings Announcements Draw Investor Attention",
    summaryJa:
      "上場企業の決算発表では、業績見通しや投資計画が注目されています。日本経済の現在地を英語で説明する題材になります。",
    category: "企業IR",
    sourceName: "MVP mock feed",
    sourceUrl: "https://www.jpx.co.jp/",
    publishedAt: now.toISOString(),
    importanceScore: 74,
    videoSuitabilityScore: 72,
    selectionReason: "経済ニュースとして扱いやすく、海外視聴者向けに背景説明を加えやすい候補です。",
    createdAt: now.toISOString()
  }
];

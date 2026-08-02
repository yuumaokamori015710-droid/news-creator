import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Japan News Shorts Studio",
  description: "A local MVP for creating daily English YouTube Shorts from Japan news."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import "./lab.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ai-interview-lab-k1004.kay-winner08.chatgpt.site"),
  title: "AI 面试练习室 · Interview Lab",
  description: "2464 道 AI 面试题，专题学习、模拟练习和个人复习记录。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}

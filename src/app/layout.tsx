import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vive Gamer - AI描画バトル",
  description: "AIと対戦するマルチプレイヤー描画ゲーム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

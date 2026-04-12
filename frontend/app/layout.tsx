import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "二輪四輪オフマップ",
  description: "バイク・クルマのオフ会・ミーティングが見つかるサイト",
  openGraph: {
    title: "二輪四輪オフマップ",
    description: "オフ会・イベントがすぐ見つかる。全国自動収集・SNS登録不要・無料",
    url: "https://24offmap.jp",
    siteName: "二輪四輪オフマップ",
    images: [
      {
        url: "https://24offmap.jp/og-image.jpg",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: "二輪四輪オフマップ",
    description: "オフ会・イベントがすぐ見つかる。全国自動収集・SNS登録不要・無料",
    images: ["https://24offmap.jp/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}

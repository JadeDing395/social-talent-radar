import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MakerSignature } from "@/components/BrandHeader";
import { RadarScanProvider } from "@/components/RadarScanContext";
import UserIdInitializer from "@/components/UserIdInitializer";
import PlatformBodyAttr from "@/components/PlatformBodyAttr";
import StripInjectedThemeNodes from "@/components/StripInjectedThemeNodes";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Talent Radar · 跨平台美术人才发现",
  description: "基于 ArtStation / 微博 / 小红书 + AI 的游戏美术招聘工具",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col antialiased"
        style={{ backgroundColor: "var(--color-bg)", color: "var(--color-fg)" }}
        suppressHydrationWarning
      >
        {/* client component, 模块顶层副作用会在 React hydrate 之前同步执行,
            清理浏览器主题扩展（Phoenix Theme 等）注入的占位节点。 */}
        <StripInjectedThemeNodes />
        <UserIdInitializer />
        <PlatformBodyAttr />
        <RadarScanProvider>
          {children}
          <MakerSignature />
        </RadarScanProvider>
      </body>
    </html>
  );
}

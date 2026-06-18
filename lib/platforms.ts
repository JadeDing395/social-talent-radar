/**
 * 平台元数据中枢 —— 所有 UI / 路由 / API 引用都从这里读，避免硬编码。
 */

import type { Platform } from "./types";

export interface PlatformMeta {
  id: Platform;
  label: string;
  shortLabel: string;
  route: string;
  apiPrefix: string;
  color: {
    brand: string;
    brandDark: string;
    brandSoft: string;  // 极浅背景（按钮 hover / chip 底色）
    ring: string;       // focus ring 用的 rgba（10% 透明度）
  };
  requiresLogin: "qr" | "none";
  badge: { bg: string; fg: string; label: string };
  tagline: string;      // 扫描页副标题用
}

export const PLATFORMS: Record<Platform, PlatformMeta> = {
  artstation: {
    id: "artstation",
    label: "ArtStation",
    shortLabel: "AS",
    route: "/artstation",
    apiPrefix: "/api/artstation",
    color: {
      brand: "#0d4f3c",
      brandDark: "#083828",
      brandSoft: "#ecf3ef",
      ring: "rgba(13, 79, 60, 0.35)",
    },
    requiresLogin: "none",
    badge: { bg: "#dceee5", fg: "#0d4f3c", label: "AS" },
    tagline: "全球画师社区 · 公开 API · 无需登录",
  },
  github: {
    id: "github",
    label: "GitHub",
    shortLabel: "GH",
    route: "/github",
    apiPrefix: "/api/github",
    color: {
      brand: "#24292f",
      brandDark: "#0d1117",
      brandSoft: "#f0f3f6",
      ring: "rgba(36, 41, 47, 0.35)",
    },
    requiresLogin: "none",
    badge: { bg: "#eaeef2", fg: "#24292f", label: "GH" },
    tagline: "开源开发者 · 官方 REST API · Token 可选",
  },
  bilibili: {
    id: "bilibili",
    label: "Bilibili",
    shortLabel: "B站",
    route: "/bilibili",
    apiPrefix: "/api/bilibili",
    color: {
      brand: "#00a1d6",
      brandDark: "#007aa3",
      brandSoft: "#e7f7fc",
      ring: "rgba(0, 161, 214, 0.35)",
    },
    requiresLogin: "none",
    badge: { bg: "#dff4fb", fg: "#007aa3", label: "B站" },
    tagline: "视频创作者 · 公开 Web API · 无需登录",
  },
  behance: {
    id: "behance",
    label: "Behance",
    shortLabel: "BE",
    route: "/behance",
    apiPrefix: "/api/behance",
    color: {
      brand: "#1769ff",
      brandDark: "#0f4fc4",
      brandSoft: "#edf4ff",
      ring: "rgba(23, 105, 255, 0.35)",
    },
    requiresLogin: "none",
    badge: { bg: "#e2edff", fg: "#0f4fc4", label: "BE" },
    tagline: "设计作品社区 · Adobe API · 需 Client ID",
  },
};

export const PLATFORM_LIST: PlatformMeta[] = [
  PLATFORMS.artstation,
  PLATFORMS.github,
  PLATFORMS.bilibili,
  PLATFORMS.behance,
];

/** 候选人库（聚合页）的中性主题 —— 不属于任何单一平台 */
export const NEUTRAL_THEME = {
  brand: "#0f172a",      // slate-900
  brandDark: "#020617",  // slate-950
  brandSoft: "#f1f5f9",  // slate-100
  ring: "rgba(15, 23, 42, 0.25)",
};

/** 根据 pathname 判断当前在哪个平台页（用于 layout 注入 data-platform） */
export function getPlatformByPathname(pathname: string): Platform | null {
  if (pathname.startsWith("/artstation") || pathname === "/radar") return "artstation";
  if (pathname.startsWith("/github")) return "github";
  if (pathname.startsWith("/bilibili")) return "bilibili";
  if (pathname.startsWith("/behance")) return "behance";
  return null;
}

export function getPlatformMeta(id: Platform): PlatformMeta {
  return PLATFORMS[id];
}

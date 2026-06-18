/**
 * 多平台共用的归一化候选人类型。
 * 各平台 puppeteer 模块抓完原始数据后转成 NormalizedCandidate，再喂给评分层。
 */

import type { Platform } from "./types";

export interface NormalizedPost {
  text: string;
  topics: string[];
  imageUrls: string[];
  engagement: number; // 点赞 + 评论 + 转发 / 收藏，用于挑高质量图喂 vision
  url?: string;
  publishTime?: string;
}

export interface NormalizedCandidate {
  platform: Platform;
  platformUserId: string;
  name: string;
  avatarUrl: string | null;
  profileUrl: string;
  bio: string | null;
  location: string | null;
  ipLocation: string | null;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  verified: boolean;
  verifiedReason: string | null;
  posts: NormalizedPost[];
  rawGender?: string | null;
}

// 登录态检查响应

export interface LoginStatus {
  loggedIn: boolean;
  qrDataUrl?: string;       // base64 二维码截图
  loginUrl?: string;        // 登录页 URL（用户也可在外部浏览器手动登录）
  message?: string;
}

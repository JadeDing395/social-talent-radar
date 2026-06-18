/**
 * Bilibili 适配器 —— 公开 web API，无需 Puppeteer 和登录。
 */

import type { NormalizedCandidate, NormalizedPost, LoginStatus } from "./social-types";
import type { PlatformAdapter } from "./scan-handler";

const BILI_API = "https://api.bilibili.com";

const BILI_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://www.bilibili.com",
  Accept: "application/json",
};

let lastError: { status: number; body?: string; url?: string } | null = null;

interface BiliSearchUser {
  mid: number;
  uname: string;
  upic: string;
  usign: string;
  fans: number;
  videos: number;
  official_verify?: { type: number; desc: string };
}

interface BiliUserCard {
  mid: string;
  name: string;
  face: string;
  sign: string;
  fans: number;
  attention: number;
  level_info?: { current_level: number };
  official?: { type: number; title: string; desc: string };
}

interface BiliVideo {
  aid: number;
  bvid: string;
  title: string;
  description: string;
  pic: string;
  play: number;
  coin: number;
  like: number;
  comment: number;
  tag?: string;
}

async function searchUsers(query: string, maxUsers = 20): Promise<BiliSearchUser[]> {
  const url = `${BILI_API}/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(query)}&page=1&page_size=${Math.min(maxUsers, 50)}`;
  try {
    const res = await fetch(url, { headers: BILI_HEADERS, signal: AbortSignal.timeout(12000) });
    if (!res.ok) { lastError = { status: res.status, url }; return []; }
    const data = await res.json() as { data?: { result?: BiliSearchUser[] } };
    return data?.data?.result ?? [];
  } catch (err) {
    lastError = { status: 0, body: String(err), url };
    return [];
  }
}

async function fetchUserCard(mid: number): Promise<BiliUserCard | null> {
  const url = `${BILI_API}/x/web-interface/card?mid=${mid}&photo=1`;
  try {
    const res = await fetch(url, { headers: BILI_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { card?: BiliUserCard } };
    return data?.data?.card ?? null;
  } catch { return null; }
}

async function fetchVideos(mid: number, limit = 10): Promise<BiliVideo[]> {
  const url = `${BILI_API}/x/space/arc/search?mid=${mid}&ps=${limit}&pn=1&order=pubdate`;
  try {
    const res = await fetch(url, { headers: BILI_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json() as { data?: { list?: { vlist?: BiliVideo[] } } };
    return data?.data?.list?.vlist ?? [];
  } catch { return []; }
}

function toNormalizedCandidate(user: BiliSearchUser, card: BiliUserCard | null, videos: BiliVideo[]): NormalizedCandidate {
  const official = card?.official ?? (user.official_verify?.type === 0 ? user.official_verify : undefined);
  const posts: NormalizedPost[] = videos.map(v => ({
    text: [v.title, v.description?.slice(0, 150)].filter(Boolean).join(" — "),
    topics: v.tag ? v.tag.split(",").map(t => t.trim()) : [],
    imageUrls: v.pic ? [v.pic] : [],
    engagement: (v.play || 0) / 100 + (v.like || 0) + (v.coin || 0) * 2,
    url: `https://www.bilibili.com/video/${v.bvid}`,
  }));
  const officialDesc = typeof official === "object" && official ? (official as { desc?: string }).desc ?? (official as { title?: string }).title ?? "" : "";
  return {
    platform: "bilibili",
    platformUserId: String(user.mid),
    name: user.uname,
    avatarUrl: user.upic || null,
    profileUrl: `https://space.bilibili.com/${user.mid}`,
    bio: user.usign || card?.sign || null,
    location: null,
    ipLocation: null,
    followers: card?.fans ?? user.fans ?? null,
    following: card ? Number(card.attention) : null,
    postsCount: user.videos ?? null,
    verified: !!official,
    verifiedReason: officialDesc || null,
    posts,
    rawGender: null,
  };
}

async function searchAndFetch(query: string, opts: { perQuery: number; postsLimit: number }): Promise<NormalizedCandidate[]> {
  const users = await searchUsers(query, opts.perQuery * 2);
  const out: NormalizedCandidate[] = [];
  for (const u of users.slice(0, opts.perQuery)) {
    const [card, videos] = await Promise.all([
      fetchUserCard(u.mid),
      fetchVideos(u.mid, opts.postsLimit),
    ]);
    out.push(toNormalizedCandidate(u, card, videos));
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
  }
  return out;
}

export const bilibiliAdapter: PlatformAdapter = {
  platform: "bilibili",
  checkLogin: async (): Promise<LoginStatus> => ({
    loggedIn: true,
    message: "Bilibili 公开 API，无需登录",
  }),
  searchAndFetch,
  getLastError: () => lastError,
  delayBetweenQueries: [1000, 2000],
};

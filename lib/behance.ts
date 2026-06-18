/**
 * Behance 适配器 —— Adobe 官方 API。
 * 需要配置 BEHANCE_CLIENT_ID 环境变量（behance.net/dev 免费注册）。
 */

import type { NormalizedCandidate, NormalizedPost, LoginStatus } from "./social-types";
import type { PlatformAdapter } from "./scan-handler";

const BEHANCE_API = "https://api.behance.net/v2";
const CLIENT_ID = process.env.BEHANCE_CLIENT_ID;

let lastError: { status: number; body?: string; url?: string } | null = null;

interface BehanceUser {
  id: number;
  username: string;
  display_name: string;
  url: string;
  avatar_url: string;
  location: string | null;
  occupation: string | null;
  stats?: { followers: number; following: number; appreciations: number };
  fields?: string[];
  links?: { website?: string };
}

interface BehanceProject {
  id: number;
  name: string;
  url: string;
  covers?: { "202"?: string; "404"?: string };
  fields: string[];
  stats?: { views: number; appreciations: number };
  description?: string;
}

async function apiFetch<T>(path: string): Promise<T | null> {
  if (!CLIENT_ID) return null;
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BEHANCE_API}${path}${sep}client_id=${CLIENT_ID}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) { lastError = { status: res.status, url }; return null; }
    return await res.json() as T;
  } catch (err) {
    lastError = { status: 0, body: String(err), url };
    return null;
  }
}

async function searchUsers(query: string, maxUsers = 20): Promise<BehanceUser[]> {
  const data = await apiFetch<{ users?: BehanceUser[] }>(`/users?q=${encodeURIComponent(query)}&per_page=${Math.min(maxUsers, 20)}`);
  return data?.users ?? [];
}

async function fetchProjects(username: string, limit = 12): Promise<BehanceProject[]> {
  const data = await apiFetch<{ projects?: BehanceProject[] }>(`/users/${username}/projects?per_page=${limit}`);
  return data?.projects ?? [];
}

function toNormalizedCandidate(user: BehanceUser, projects: BehanceProject[]): NormalizedCandidate {
  const posts: NormalizedPost[] = projects.map(p => ({
    text: [p.name, p.description?.slice(0, 150)].filter(Boolean).join(" — "),
    topics: p.fields ?? [],
    imageUrls: p.covers ? [p.covers["404"] ?? p.covers["202"] ?? ""].filter(Boolean) : [],
    engagement: (p.stats?.views ?? 0) / 100 + (p.stats?.appreciations ?? 0),
    url: p.url,
  }));
  return {
    platform: "behance",
    platformUserId: String(user.id),
    name: user.display_name,
    avatarUrl: user.avatar_url || null,
    profileUrl: user.url,
    bio: [user.occupation, user.links?.website].filter(Boolean).join(" | ") || null,
    location: user.location,
    ipLocation: null,
    followers: user.stats?.followers ?? null,
    following: user.stats?.following ?? null,
    postsCount: null,
    verified: false,
    verifiedReason: user.fields?.join(", ") ?? null,
    posts,
    rawGender: null,
  };
}

async function searchAndFetch(query: string, opts: { perQuery: number; postsLimit: number }): Promise<NormalizedCandidate[]> {
  const users = await searchUsers(query, opts.perQuery);
  const out: NormalizedCandidate[] = [];
  for (const u of users) {
    const projects = await fetchProjects(u.username, opts.postsLimit);
    out.push(toNormalizedCandidate(u, projects));
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
  }
  return out;
}

export const behanceAdapter: PlatformAdapter = {
  platform: "behance",
  checkLogin: async (): Promise<LoginStatus> => {
    if (!CLIENT_ID) {
      return { loggedIn: false, message: "请配置 BEHANCE_CLIENT_ID（behance.net/dev 免费注册）" };
    }
    return { loggedIn: true, message: "Behance API 已配置" };
  },
  searchAndFetch,
  getLastError: () => lastError,
  delayBetweenQueries: [500, 1000],
};

/**
 * GitHub 适配器 —— 官方 REST API，无需 Puppeteer。
 * 支持 Personal Access Token（可选，提升限速 60→5000 req/h）。
 */

import type { NormalizedCandidate, NormalizedPost, LoginStatus } from "./social-types";
import type { PlatformAdapter } from "./scan-handler";

const GITHUB_API = "https://api.github.com";
const TOKEN = process.env.GITHUB_TOKEN;

function headers() {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "TalentCompass/1.0",
  };
  if (TOKEN) h["Authorization"] = `Bearer ${TOKEN}`;
  return h;
}

let lastError: { status: number; body?: string; url?: string } | null = null;

interface GHUser {
  login: string;
  avatar_url: string;
  html_url: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  company: string | null;
  blog: string | null;
  followers: number;
  following: number;
  public_repos: number;
  email: string | null;
}

interface GHRepo {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
}

async function searchUsers(query: string, maxUsers = 20): Promise<GHUser[]> {
  const url = `${GITHUB_API}/search/users?q=${encodeURIComponent(query)}&per_page=${Math.min(maxUsers, 30)}&sort=followers`;
  try {
    const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(12000) });
    if (!res.ok) {
      lastError = { status: res.status, body: await res.text().catch(() => ""), url };
      return [];
    }
    const data = await res.json() as { items?: { login: string }[] };
    return (data.items ?? []).map(u => ({ login: u.login } as GHUser));
  } catch (err) {
    lastError = { status: 0, body: String(err), url };
    return [];
  }
}

async function fetchUser(login: string): Promise<GHUser | null> {
  const url = `${GITHUB_API}/users/${login}`;
  try {
    const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(10000) });
    if (!res.ok) { lastError = { status: res.status, url }; return null; }
    return await res.json() as GHUser;
  } catch { return null; }
}

async function fetchRepos(login: string, limit = 10): Promise<GHRepo[]> {
  const url = `${GITHUB_API}/users/${login}/repos?sort=stars&per_page=${limit}`;
  try {
    const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const repos = await res.json() as GHRepo[];
    return Array.isArray(repos) ? repos : [];
  } catch { return []; }
}

function toNormalizedCandidate(user: GHUser, repos: GHRepo[]): NormalizedCandidate {
  const bio = [user.bio, user.company, user.blog].filter(Boolean).join(" | ");
  const posts: NormalizedPost[] = repos.map(r => ({
    text: [r.name, r.description, r.language].filter(Boolean).join(" — "),
    topics: r.topics ?? [],
    imageUrls: [],
    engagement: r.stargazers_count + r.forks_count,
    url: r.html_url,
  }));
  return {
    platform: "github",
    platformUserId: user.login,
    name: user.name ?? user.login,
    avatarUrl: user.avatar_url,
    profileUrl: user.html_url,
    bio: bio || null,
    location: user.location,
    ipLocation: null,
    followers: user.followers,
    following: user.following,
    postsCount: user.public_repos,
    verified: false,
    verifiedReason: null,
    posts,
    rawGender: null,
  };
}

async function searchAndFetch(query: string, opts: { perQuery: number; postsLimit: number }): Promise<NormalizedCandidate[]> {
  const users = await searchUsers(query, opts.perQuery * 2);
  const out: NormalizedCandidate[] = [];
  for (const u of users.slice(0, opts.perQuery)) {
    const [user, repos] = await Promise.all([
      fetchUser(u.login),
      fetchRepos(u.login, opts.postsLimit),
    ]);
    if (!user) continue;
    out.push(toNormalizedCandidate(user, repos));
    await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
  }
  return out;
}

export const githubAdapter: PlatformAdapter = {
  platform: "github",
  checkLogin: async (): Promise<LoginStatus> => ({
    loggedIn: true,
    message: TOKEN ? "已配置 GitHub Token（5000 req/h）" : "公开 API（60 req/h），可配置 GITHUB_TOKEN 提升限速",
  }),
  searchAndFetch,
  getLastError: () => lastError,
  delayBetweenQueries: [300, 800],
};

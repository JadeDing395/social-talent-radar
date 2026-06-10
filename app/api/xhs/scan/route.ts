import { NextRequest } from "next/server";
import { handleScan, corsOptionsResponse, PlatformAdapter } from "@/lib/scan-handler";
import * as xhs from "@/lib/xhs-puppeteer";
import type { NormalizedCandidate } from "@/lib/social-types";

const adapter: PlatformAdapter = {
  platform: "xiaohongshu",
  checkLogin: xhs.checkLoginStatus,
  delayBetweenQueries: [2000, 4000],
  async searchAndFetch(query, opts) {
    const users = await xhs.searchUsers(query, {});
    const out: NormalizedCandidate[] = [];
    for (const u of users.slice(0, opts.perQuery)) {
      try {
        const { user, notes } = await xhs.fetchProfileWithNotes(u.userId, opts.postsLimit);
        const merged = user ?? u;
        out.push(xhs.toNormalizedCandidate(merged, notes));
        await xhs.delay(1500, 3000);
      } catch (err) {
        if (/风控|captcha|verify/i.test(String(err))) throw err;
      }
    }
    return out;
  },
  getLastError: xhs.getLastPostError,
};

export const OPTIONS = corsOptionsResponse;

export async function POST(req: NextRequest) {
  return handleScan(req, adapter);
}

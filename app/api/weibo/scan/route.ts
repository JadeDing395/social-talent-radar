import { NextRequest } from "next/server";
import { handleScan, corsOptionsResponse, PlatformAdapter } from "@/lib/scan-handler";
import * as wb from "@/lib/weibo-puppeteer";
import type { NormalizedCandidate } from "@/lib/social-types";

const adapter: PlatformAdapter = {
  platform: "weibo",
  checkLogin: wb.checkLoginStatus,
  delayBetweenQueries: [800, 1500],
  async searchAndFetch(query, opts) {
    const users = await wb.searchUsers(query, { sort: "hot" });
    const out: NormalizedCandidate[] = [];
    for (const u of users.slice(0, opts.perQuery)) {
      try {
        const [profile, posts] = await Promise.all([
          wb.fetchProfile(u.uid),
          wb.fetchRecentPosts(u.uid, opts.postsLimit),
        ]);
        const merged = profile ?? u;
        out.push(wb.toNormalizedCandidate(merged, posts));
        await wb.delay(600, 1200);
      } catch {
        // 单个失败不阻断整批
      }
    }
    return out;
  },
  getLastError: wb.getLastPostError,
};

export const OPTIONS = corsOptionsResponse;

export async function POST(req: NextRequest) {
  return handleScan(req, adapter);
}

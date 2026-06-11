import { NextRequest } from "next/server";
import { handleScan, corsOptionsResponse, PlatformAdapter } from "@/lib/scan-handler";
import * as xhs from "@/lib/xhs-puppeteer";

const adapter: PlatformAdapter = {
  platform: "xiaohongshu",
  checkLogin: xhs.checkLoginStatus,
  delayBetweenQueries: [2000, 4000],
  async searchAndFetch(query, opts) {
    // 小红书用户主页改版后 __INITIAL_STATE__ 为空,逐个抓主页既慢又拿不到数据(会拖到超时)。
    // 搜索 notes API 已返回作者 + 笔记方向(作品信号),直接用搜索数据评分,秒出结果。
    const users = await xhs.searchUsers(query, {});
    return users.slice(0, opts.perQuery).map((u) => xhs.toNormalizedCandidate(u, []));
  },
  getLastError: xhs.getLastPostError,
};

export const OPTIONS = corsOptionsResponse;

export async function POST(req: NextRequest) {
  return handleScan(req, adapter);
}

/**
 * 平台无关的扫描流水线核心：
 *  1. AI 解析岗位 → 搜索词
 *  2. 调用平台 puppeteer.searchUsers → 拿候选人列表
 *  3. 逐个 fetchProfile + fetchPosts → 归一化
 *  4. 调用 claude.scoreCandidate (含 vision)
 *  5. NDJSON 流式回写前端
 *
 * 平台差异通过传入 PlatformAdapter 注入；微博/小红书各自的 route 只需要写薄薄一层。
 */

import { NextRequest } from "next/server";
import { expandPosition, scoreCandidate, ScoreOutput } from "./claude";
import {
  AiClientConfig,
  ScanParams,
  RadarResult,
  PositionBrief,
} from "./scoring-config";
import { readDB } from "./db";
import { getUserIdFromRequest } from "./userIdentity";
import { recordUsage } from "./usage";
import type { Platform } from "./types";
import type { NormalizedCandidate, LoginStatus } from "./social-types";

export interface PlatformAdapter {
  platform: Platform;
  /** 检查登录态 */
  checkLogin: () => Promise<LoginStatus>;
  /** 搜索一批用户，返回归一化候选人；adapter 内部处理 profile/posts 拼接，
   *  这样可以最大化复用各自的接口形态而不用拆得太细 */
  searchAndFetch: (query: string, opts: { perQuery: number; postsLimit: number }) => Promise<NormalizedCandidate[]>;
  /** 抓取最后一次错误的接口响应（便于把抓取层错误透传给前端） */
  getLastError: () => { status: number; body?: string; url?: string } | null;
  /** 每页/每查询间的节流毫秒 */
  delayBetweenQueries: [number, number];
}

interface ScanBody extends ScanParams {
  minScore: number;
  targetCount: number;
  aiConfig?: AiClientConfig;
  rescanIntervalDays?: number;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Radar-User-Id",
};

export function corsOptionsResponse() {
  return new Response(null, { status: 204, headers: CORS });
}

function send(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, obj: object) {
  controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
}

export async function handleScan(req: NextRequest, adapter: PlatformAdapter): Promise<Response> {
  const userId = getUserIdFromRequest(req);
  let body: ScanBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: CORS });
  }

  const {
    position, jd, artStyles = [], tools = [], themes = [],
    education, experience, region, weights, minScore = 0, targetCount = 10,
    aiConfig, rescanIntervalDays = 90,
  } = body;

  const desired = Math.min(50, Math.max(3, Math.floor(Number(targetCount) || 10)));

  const scanParams: ScanParams = {
    platform: adapter.platform, position, jd, artStyles, tools, themes,
    education, experience, region, weights,
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (obj: object) => send(controller, encoder, obj);

      try {
        // 0) 检查登录
        emit({ type: "status", message: `正在检查${adapter.platform === "weibo" ? "微博" : adapter.platform === "xiaohongshu" ? "小红书" : "ArtStation"}登录态...` });
        const login = await adapter.checkLogin();
        if (!login.loggedIn) {
          emit({ type: "login_required", message: login.message ?? "未登录" });
          emit({
            type: "done", fetched: 0, analyzed: 0, kept: 0, target: desired,
            filteredRegion: 0, filteredScore: 0, errored: 0, minScore,
          });
          return;
        }

        // 1) AI 解析岗位
        emit({ type: "status", message: `AI 正在理解岗位「${position}」...` });
        const positionBrief: PositionBrief = await expandPosition(
          userId, adapter.platform, position, jd, artStyles, tools, themes, aiConfig,
        );
        emit({ type: "position_brief", brief: positionBrief });
        emit({
          type: "status",
          message: `已生成 ${positionBrief.search_queries.length} 条搜索词，开始抓取...`,
        });

        // 2) 候选人收集 + 已入库去重
        const existingDb = readDB(userId);
        const existingMap = new Map<string, number>();
        for (const c of existingDb.candidates) {
          if (c.source !== adapter.platform || !c.platformUserId) continue;
          const ts = new Date(c.updatedAt || c.createdAt || 0).getTime();
          existingMap.set(c.platformUserId, ts);
        }
        const intervalMs = Math.max(0, rescanIntervalDays) * 86400000;
        const cutoffMs = Date.now() - intervalMs;
        let skippedExisting = 0;

        const seen = new Set<string>();
        const candidates: NormalizedCandidate[] = [];

        const isAlreadyInLibrary = (c: NormalizedCandidate): boolean => {
          const lastTs = existingMap.get(c.platformUserId);
          if (lastTs === undefined) return false;
          if (rescanIntervalDays === 0) return true;
          return lastTs >= cutoffMs;
        };

        const HARD_CAP = Math.min(80, desired * 6);
        const perQueryTarget = Math.max(3, Math.ceil(desired / Math.max(1, positionBrief.search_queries.length)));

        for (const q of positionBrief.search_queries) {
          if (candidates.length >= HARD_CAP) break;
          try {
            emit({ type: "status", message: `搜索：「${q}」...`, total: candidates.length });
            const batch = await adapter.searchAndFetch(q, { perQuery: perQueryTarget * 2, postsLimit: 15 });
            let newC = 0, skipC = 0;
            for (const c of batch) {
              if (seen.has(c.platformUserId)) continue;
              seen.add(c.platformUserId);
              if (isAlreadyInLibrary(c)) {
                skippedExisting++;
                skipC++;
                continue;
              }
              candidates.push(c);
              newC++;
              if (candidates.length >= HARD_CAP) break;
            }
            const skipNote = skipC > 0 ? `（跳过已入库 ${skipC}）` : "";
            emit({
              type: "status",
              message: `「${q}」召回 ${batch.length} 人${skipNote}，累计 ${candidates.length} 人`,
              total: candidates.length,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            emit({ type: "status", message: `搜索词「${q}」失败：${msg.slice(0, 120)}` });
            if (/风控|captcha|verify/i.test(msg)) {
              emit({ type: "error", message: `${adapter.platform === "weibo" ? "微博" : adapter.platform === "xiaohongshu" ? "小红书" : "ArtStation"} 抓取被风控阻断：${msg}` });
              break;
            }
          }
          await new Promise((r) =>
            setTimeout(r, Math.random() * (adapter.delayBetweenQueries[1] - adapter.delayBetweenQueries[0]) + adapter.delayBetweenQueries[0]),
          );
        }

        if (candidates.length === 0) {
          const last = adapter.getLastError();
          const errMsg = last
            ? `${adapter.platform} 接口返回 HTTP ${last.status}: ${(last.body ?? "").slice(0, 200)}`
            : "搜索全部 0 召回。可能 puppeteer session 未拿到登录态。";
          emit({ type: "error", message: errMsg });
          emit({
            type: "done", fetched: 0, analyzed: 0, kept: 0, target: desired,
            filteredRegion: 0, filteredScore: 0, errored: 0, minScore, skippedExisting,
          });
          return;
        }

        emit({ type: "status", message: `已抓取 ${candidates.length} 人，开始 AI 评分...`, total: candidates.length });

        // 3) 评分循环
        let analyzed = 0, kept = 0, filteredRegion = 0, filteredScore = 0, errored = 0;

        for (const candidate of candidates) {
          if (kept >= desired) break;
          try {
            const scoring: ScoreOutput = await scoreCandidate(
              userId, candidate, scanParams, positionBrief, aiConfig,
            );
            analyzed++;

            // 推 usage_delta（前端实时更新本次扫描 token 累计）
            // recordUsage 已经在 claude.ts 内部累加到磁盘；这里只是把粗略 delta 推前端
            // 用一次 0 调用绕过：实际上前端的"本次扫描"只能由 SSE 推
            // 由于 scoreCandidate 一次会调多个内部 API（其实是单次），我们简单地把这次的
            // 输入/输出 token 数从 lastDelta 拿…但 claude.ts 没暴露。这里采用近似：每次评分
            // 推一个固定的提示让前端 +1 calls，然后 TokenUsagePanel 主动拉 /api/usage 算精确值
            emit({ type: "usage_delta", input: 0, output: 0 });

            if (scoring.region_confidence === "非中国区域" && region && region !== "不限") {
              filteredRegion++;
            }
            const passed = scoring.total_score >= minScore;
            if (passed) kept++;
            else filteredScore++;

            const result: RadarResult = {
              platform: candidate.platform,
              platform_user_id: candidate.platformUserId,
              username: candidate.platformUserId,
              name: candidate.name,
              profile_url: candidate.profileUrl,
              avatar_url: candidate.avatarUrl,
              location: candidate.location,
              ip_location: candidate.ipLocation,
              region_confidence: scoring.region_confidence,
              headline: candidate.bio,
              recent_works: candidate.posts.slice(0, 10).map((p) => p.text || "(无文字)"),
              recent_work_images: candidate.posts.flatMap((p) => p.imageUrls).slice(0, 6),
              followers_count: candidate.followers,
              posts_count: candidate.postsCount,
              verified: candidate.verified,
              verified_reason: candidate.verifiedReason,
              passed,
              position_name: position,
              inferred_position: scoring.inferred_position,
              total_score: scoring.total_score,
              score_level: scoring.score_level,
              score_breakdown: scoring.score_breakdown,
              pros: scoring.pros,
              cons: scoring.cons,
              art_evaluation: scoring.art_evaluation,
              vision_used: scoring.vision_used,
              contact: scoring.contact,
              available_for_work: scoring.open_to_opportunity === "明确看机会",
              open_to_opportunity: scoring.open_to_opportunity,
              current_project: scoring.current_project,
              suggested_tags: scoring.suggested_tags ?? [],
            };
            emit({ type: "result", data: result });
            emit({
              type: "progress",
              current: analyzed,
              total: candidates.length,
              kept,
              filteredRegion,
              filteredScore,
            });
          } catch (err) {
            analyzed++;
            errored++;
            const msg = err instanceof Error ? err.message : String(err);
            emit({ type: "status", message: `${candidate.name} 评分失败：${msg.slice(0, 100)}` });
          }
        }

        emit({
          type: "done",
          fetched: candidates.length,
          analyzed,
          kept,
          target: desired,
          filteredRegion,
          filteredScore,
          errored,
          minScore,
          skippedExisting,
        });
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS,
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

// 把未用的 recordUsage import 标记掉（避免 unused 警告）
void recordUsage;

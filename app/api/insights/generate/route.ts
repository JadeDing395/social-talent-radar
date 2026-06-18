import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AiClientConfig } from "@/lib/scoring-config";
import { inferProtocol } from "@/lib/models";
import { getUserIdFromRequest } from "@/lib/userIdentity";
import { recordUsage } from "@/lib/usage";

export interface InsightsSummaryInput {
  total: number;
  newThisMonth: number;
  avgScore: number;
  highMatch: number;
  available: number;
  platforms: { label: string; count: number }[];
  topSkills: { name: string; count: number }[];
  scoreDistribution: { label: string; count: number }[];
  stages: { name: string; count: number }[];
  aiConfig?: AiClientConfig;
}

export interface GeneratedInsights {
  market_summary: string;
  skill_signals: string[];
  channel_analysis: string;
  quality_assessment: string;
  action_items: string[];
  risk_notes: string;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Radar-User-Id",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  const body = await req.json() as InsightsSummaryInput;
  const { aiConfig, ...stats } = body;

  const model = aiConfig?.model ?? process.env.MODEL ?? "claude-sonnet-4-6";
  const protocol = aiConfig?.protocol ?? inferProtocol(model);
  const baseURL = aiConfig?.baseURL ?? process.env.ANTHROPIC_BASE_URL;
  const apiKey = aiConfig?.apiKey ?? process.env.LITELLM_API_KEY ?? "";

  const platformStr = stats.platforms.map(p => `${p.label}(${p.count}人)`).join("、") || "暂无";
  const skillStr = stats.topSkills.slice(0, 12).map(s => `${s.name}(${s.count})`).join("、") || "暂无";
  const stageStr = stats.stages.map(s => `${s.name}:${s.count}人`).join("、") || "暂无";

  const prompt = `你是一位经验丰富的人才招募分析师。请根据以下候选人库数据，生成一份简洁专业的人才市场洞察报告。

## 候选人库概况
- 总候选人：${stats.total} 人
- 近 30 天新增：${stats.newThisMonth} 人
- 平均 AI 评分：${stats.avgScore} 分（满分100）
- 高匹配候选人（≥80分）：${stats.highMatch} 人（占比 ${stats.total ? Math.round(stats.highMatch / stats.total * 100) : 0}%）
- 明确求职开放：${stats.available} 人
- 数据来源平台：${platformStr}
- 评分分布：${stats.scoreDistribution.map(d => `${d.label}:${d.count}人`).join("、")}
- 流程阶段：${stageStr}
- 高频技能/标签：${skillStr}

请直接输出 JSON（不要 markdown 代码块），格式如下：
{
  "market_summary": "2-3句话的市场总结，基于数据说话，对候选人质量、规模、覆盖度做整体判断",
  "skill_signals": ["技能信号1（基于高频标签推断当前市场人才热度与供需）", "技能信号2", "技能信号3", "技能信号4"],
  "channel_analysis": "1-2句话的渠道分析：哪个平台候选人质量最高或供给最丰富，建议的渠道优先级",
  "quality_assessment": "1-2句话：评分漏斗健康度，当前候选人池的高匹配转化率是否正常，是否有明显质量问题",
  "action_items": ["优先行动1（具体可执行，如扩大某渠道搜索范围）", "优先行动2", "优先行动3"],
  "risk_notes": "1句话的风险提示：数据量局限性、潜在偏差或需要人工核实的事项"
}`;

  try {
    let text = "";

    if (protocol === "anthropic") {
      const client = new Anthropic({ baseURL, apiKey });
      const resp = await client.messages.create({
        model,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });
      recordUsage(userId, model, resp.usage.input_tokens, resp.usage.output_tokens, aiConfig?.customPricing);
      text = resp.content.find(b => b.type === "text")?.text ?? "";
    } else {
      const client = new OpenAI({ baseURL: baseURL ? baseURL + "/v1" : undefined, apiKey });
      const resp = await client.chat.completions.create({
        model,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });
      if (resp.usage) {
        recordUsage(userId, model, resp.usage.prompt_tokens, resp.usage.completion_tokens, aiConfig?.customPricing);
      }
      text = resp.choices[0]?.message?.content ?? "";
    }

    // 提取第一个完整的 JSON 对象（处理 markdown 代码块和多余文字）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ ok: false, error: "AI 未返回有效 JSON，请重试" }, { status: 500, headers: CORS });
    }
    let insights: GeneratedInsights;
    try {
      insights = JSON.parse(jsonMatch[0]) as GeneratedInsights;
    } catch {
      // 尝试修复截断的 JSON（补全末尾）
      return NextResponse.json({ ok: false, error: "JSON 解析失败，可能是输出被截断，请重试" }, { status: 500, headers: CORS });
    }
    return NextResponse.json({ ok: true, insights }, { headers: CORS });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500, headers: CORS });
  }
}

"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { Candidate } from "@/lib/types";
import { PLATFORM_LIST, PLATFORMS } from "@/lib/platforms";
import type { Platform } from "@/lib/types";
import { Users, TrendingUp, Award, Zap, Star, Target, Activity, Sparkles, RefreshCw, ChevronRight } from "lucide-react";
import { loadAiConfig } from "@/components/AiSettingsModal";
import { gsap } from "gsap";
import { useCountUp, useStaggerIn } from "@/lib/useGsapAnimations";

interface GeneratedInsights {
  market_summary: string;
  skill_signals: string[];
  channel_analysis: string;
  quality_assessment: string;
  action_items: string[];
  risk_notes: string;
}

// ─── 数据获取 ───────────────────────────────────────────────────────────────

async function fetchCandidates(): Promise<Candidate[]> {
  try {
    const res = await fetch("/api/candidates?limit=1000", { credentials: "include" });
    if (!res.ok) return [];
    const data = await res.json() as { candidates?: Candidate[] };
    return data.candidates ?? [];
  } catch { return []; }
}

async function fetchStages(): Promise<{ id: number; name: string }[]> {
  try {
    const res = await fetch("/api/stages", { credentials: "include" });
    if (!res.ok) return [];
    return await res.json() as { id: number; name: string }[];
  } catch { return []; }
}

// ─── 图表组件 ────────────────────────────────────────────────────────────────

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <Empty text="扫描候选人后显示" />;
  let cum = -Math.PI / 2;
  const slices = data.filter(d => d.value > 0).map(d => {
    const angle = (d.value / total) * 2 * Math.PI;
    const start = cum; cum += angle;
    const r = 60;
    const x1 = 70 + r * Math.cos(start), y1 = 70 + r * Math.sin(start);
    const x2 = 70 + r * Math.cos(cum), y2 = 70 + r * Math.sin(cum);
    return { ...d, path: `M70,70 L${x1},${y1} A${r},${r} 0 ${angle > Math.PI ? 1 : 0},1 ${x2},${y2} Z` };
  });
  return (
    <div className="flex items-center gap-5">
      <svg width="140" height="140" className="flex-shrink-0">
        {slices.map(s => <path key={s.label} d={s.path} fill={s.color} className="hover:opacity-75 transition-opacity cursor-default" />)}
        <circle cx="70" cy="70" r="32" fill="white" />
        <text x="70" y="66" textAnchor="middle" fontSize="15" fill="#0f172a" fontWeight="700">{total}</text>
        <text x="70" y="80" textAnchor="middle" fontSize="9" fill="#94a3b8">总人数</text>
      </svg>
      <div className="space-y-2 flex-1 min-w-0">
        {slices.map(s => (
          <div key={s.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-sm text-slate-600 truncate">{s.label}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-sm font-semibold text-slate-900">{s.value}</span>
              <span className="text-[10px] text-slate-400 w-8 text-right">{Math.round(s.value / total * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreHistogram({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const bars = container.querySelectorAll<HTMLElement>("[data-gsap-bar]");
    bars.forEach((bar) => {
      const pct = parseFloat(bar.dataset.gsapBar ?? "0");
      gsap.fromTo(bar, { width: "0%" }, { width: `${pct}%`, duration: 0.9, delay: 0.2, ease: "power2.out" });
    });
  }, [data]);

  return (
    <div className="space-y-0" ref={containerRef}>
      {data.map((d, i) => (
        <div key={d.label} className={`flex items-center gap-3 py-2 ${i < data.length - 1 ? "border-b border-slate-50" : ""}`}>
          <div className="flex items-center gap-2 w-28 flex-shrink-0">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-xs text-slate-500">{d.label}</span>
          </div>
          <div className="flex-1 h-5 bg-slate-50 rounded-full overflow-hidden">
            <div className="h-full rounded-full flex items-center justify-end pr-2"
              data-gsap-bar={Math.max((d.value / max) * 100, d.value > 0 ? 8 : 0).toFixed(1)}
              style={{ width: "0%", backgroundColor: d.color }}>
            </div>
          </div>
          <div className="w-12 text-right flex-shrink-0">
            <span className="text-sm font-medium text-slate-700">{d.value}</span>
            {total > 0 && <span className="text-[10px] text-slate-400 ml-1">{Math.round(d.value / total * 100)}%</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillsChart({ skills }: { skills: { name: string; count: number; color: string }[] }) {
  if (skills.length === 0) return <Empty text="入库候选人后显示技能分布" />;
  const max = Math.max(...skills.map(s => s.count), 1);
  return (
    <div className="space-y-1.5">
      {skills.slice(0, 15).map((s, i) => (
        <div key={s.name} className="flex items-center gap-2.5">
          <span className="text-[10px] text-slate-400 w-4 text-right flex-shrink-0">{i + 1}</span>
          <span className="text-xs text-slate-600 w-24 truncate flex-shrink-0">{s.name}</span>
          <div className="flex-1 h-4 bg-slate-50 rounded overflow-hidden">
            <div className="h-full rounded transition-all duration-700"
              style={{ width: `${(s.count / max) * 100}%`, backgroundColor: s.color + "99" }} />
          </div>
          <span className="text-xs font-medium text-slate-600 w-4 text-right flex-shrink-0">{s.count}</span>
        </div>
      ))}
    </div>
  );
}

function TrendLine({ weeks }: { weeks: { label: string; newCount: number; cumulative: number }[] }) {
  if (weeks.every(w => w.cumulative === 0)) return <Empty text="入库候选人后显示趋势" />;
  const maxCum = Math.max(...weeks.map(w => w.cumulative), 1);
  const maxNew = Math.max(...weeks.map(w => w.newCount), 1);
  const W = 400, H = 100, padL = 8, padR = 8, padT = 8, padB = 20;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const xStep = innerW / (weeks.length - 1 || 1);

  const cumPoints = weeks.map((w, i) => `${padL + i * xStep},${padT + innerH - (w.cumulative / maxCum) * innerH}`).join(" ");
  const newBars = weeks.map((w, i) => ({
    x: padL + i * xStep - 6,
    y: padT + innerH - (w.newCount / maxNew) * innerH * 0.4,
    h: (w.newCount / maxNew) * innerH * 0.4,
    label: w.label,
    newCount: w.newCount,
    cumulative: w.cumulative,
  }));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }}>
        {newBars.map((b, i) => (
          <rect key={i} x={Math.max(b.x, 0)} y={b.y} width={12} height={b.h}
            fill="#6366f122" rx="2" className="hover:fill-indigo-200 transition-colors cursor-default">
            <title>{b.label}: 新增{b.newCount} / 累计{b.cumulative}</title>
          </rect>
        ))}
        <polyline points={cumPoints} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {weeks.map((w, i) => (
          <circle key={i} cx={padL + i * xStep} cy={padT + innerH - (w.cumulative / maxCum) * innerH}
            r="3" fill="white" stroke="#6366f1" strokeWidth="1.5" className="cursor-default">
            <title>{w.label}: 累计{w.cumulative}人</title>
          </circle>
        ))}
        {weeks.filter((_, i) => i === 0 || i === weeks.length - 1 || i % 4 === 0).map((w, _, arr) => {
          const origIdx = weeks.indexOf(w);
          return (
            <text key={w.label} x={padL + origIdx * xStep} y={H - 4}
              textAnchor="middle" fontSize="8" fill="#94a3b8">{w.label}</text>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 mt-1 px-1">
        <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-indigo-500 rounded inline-block" /><span className="text-[10px] text-slate-400">累计入库</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-indigo-100 rounded-sm inline-block" /><span className="text-[10px] text-slate-400">每周新增</span></div>
      </div>
    </div>
  );
}

function Funnel({ stages }: { stages: { label: string; value: number; color: string }[] }) {
  const maxVal = Math.max(...stages.map(s => s.value), 1);
  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const next = stages[i + 1];
        const rate = next && s.value > 0 ? Math.round(next.value / s.value * 100) : null;
        return (
          <div key={s.label}>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="h-8 rounded-md flex items-center px-3 transition-all duration-500"
                style={{ width: `${Math.max((s.value / maxVal) * 100, 12)}%`, backgroundColor: s.color + "22", minWidth: "3rem" }}>
                <span className="text-xs font-medium truncate" style={{ color: s.color }}>{s.label}</span>
              </div>
              <span className="text-sm font-bold text-slate-800 tabular-nums">{s.value}</span>
            </div>
            {rate !== null && (
              <div className="flex items-center gap-1 pl-3 mb-0.5">
                <ChevronRight size={10} className="text-slate-300" />
                <span className="text-[10px] text-slate-400">转化率 {rate}%</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-slate-300 text-sm text-center py-8">{text}</div>;
}

// KPI 卡片：GSAP stagger 入场 + 数字从 0 滚动到目标值
function KpiCard({ icon: Icon, label, value, sub, color, delay }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string; value: number | string; sub: string; color: string; delay: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    gsap.fromTo(card,
      { autoAlpha: 0, y: 16, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, delay, ease: "power2.out" },
    );
  }, [delay]);

  useEffect(() => {
    const el = numRef.current;
    if (!el || typeof value !== "number" || value === 0) return;
    const obj = { v: 0 };
    const t = gsap.to(obj, {
      v: value,
      duration: 1.2,
      delay: delay + 0.2,
      ease: "power2.out",
      onUpdate: () => { el.textContent = Math.round(obj.v).toString(); },
    });
    return () => { t.kill(); };
  }, [value, delay]);

  return (
    <div ref={cardRef} style={{ opacity: 0 }}
      className="bg-white rounded-xl border border-slate-100 p-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: color + "18" }}>
          <Icon size={12} style={{ color }} />
        </div>
        <span className="text-[10px] text-slate-400 font-medium leading-tight">{label}</span>
      </div>
      <div ref={numRef} className="text-xl font-bold text-slate-900 tabular-nums">
        {typeof value === "number" ? 0 : value}
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}

function KpiStrip({ kpis }: { kpis: { total: number; newMonth: number; avgScore: number; highMatch: number; highMatchRate: number; available: number; favorites: number; withContact: number } }) {
  const items = [
    { icon: Users, label: "总候选人", value: kpis.total, sub: "已入库", color: "#6366f1" },
    { icon: TrendingUp, label: "本月新增", value: kpis.newMonth, sub: "近30天", color: "#10b981" },
    { icon: Award, label: "平均评分", value: kpis.avgScore, sub: "满分100", color: "#f59e0b" },
    { icon: Target, label: "高度匹配", value: kpis.highMatch, sub: "≥80分", color: "#10b981" },
    { icon: Zap, label: "匹配率", value: `${kpis.highMatchRate}%`, sub: "高匹配占比", color: "#6366f1" },
    { icon: Activity, label: "求职开放", value: kpis.available, sub: "有意向", color: "#00a1d6" },
    { icon: Star, label: "已收藏", value: kpis.favorites, sub: "重点关注", color: "#f59e0b" },
    { icon: Target, label: "有联系方式", value: kpis.withContact, sub: "可触达", color: "#8b5cf6" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
      {items.map((item, i) => (
        <KpiCard key={item.label} {...item} delay={i * 0.06} value={typeof item.value === "string" ? item.value : item.value} />
      ))}
    </div>
  );
}

// ─── AI 洞察面板 ──────────────────────────────────────────────────────────────

function AiInsightsPanel({ onGenerate, insights, generating, error }: {
  onGenerate: () => void;
  insights: GeneratedInsights | null;
  generating: boolean;
  error: string;
}) {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-6 text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Sparkles size={16} className="text-indigo-300" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI 市场洞察</h2>
            <p className="text-[11px] text-slate-400">基于候选人库数据，AI 生成招募情报摘要</p>
          </div>
        </div>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 text-xs font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={generating ? "animate-spin" : ""} />
          {generating ? "生成中..." : insights ? "重新生成" : "生成洞察"}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-300 text-xs">{error}</div>
      )}

      {!insights && !generating && !error && (
        <div className="border border-white/10 rounded-xl p-5 text-center">
          <Sparkles size={24} className="text-indigo-400 mx-auto mb-2 opacity-50" />
          <p className="text-slate-400 text-sm">点击「生成洞察」，AI 将分析你的候选人库</p>
          <p className="text-slate-500 text-xs mt-1">涵盖市场供需、渠道效果、技能热度、行动建议</p>
        </div>
      )}

      {generating && (
        <div className="border border-white/10 rounded-xl p-5 text-center">
          <div className="flex justify-center gap-1.5 mb-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-slate-400 text-sm">AI 正在分析候选人数据...</p>
        </div>
      )}

      {insights && !generating && (
        <div className="space-y-4">
          {/* 市场总结 */}
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-[11px] text-indigo-300 font-medium mb-1.5 uppercase tracking-wide">市场概况</p>
            <p className="text-sm text-slate-200 leading-relaxed">{insights.market_summary}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {/* 技能信号 */}
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-[11px] text-emerald-300 font-medium mb-2 uppercase tracking-wide">技能信号</p>
              <ul className="space-y-1.5">
                {insights.skill_signals.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="text-emerald-400 mt-0.5 flex-shrink-0">→</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 质量评估 */}
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-[11px] text-amber-300 font-medium mb-2 uppercase tracking-wide">渠道 & 质量</p>
              <p className="text-xs text-slate-300 leading-relaxed mb-2">{insights.channel_analysis}</p>
              <p className="text-xs text-slate-300 leading-relaxed">{insights.quality_assessment}</p>
            </div>
          </div>

          {/* 行动建议 */}
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-[11px] text-sky-300 font-medium mb-2 uppercase tracking-wide">优先行动项</p>
            <div className="space-y-2">
              {insights.action_items.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-xs text-slate-200 leading-relaxed">{a}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 风险提示 */}
          <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl px-4 py-2.5 flex items-start gap-2">
            <span className="text-amber-400 text-xs mt-0.5 flex-shrink-0">⚠</span>
            <p className="text-xs text-amber-200/80">{insights.risk_notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stages, setStages] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<GeneratedInsights | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    Promise.all([fetchCandidates(), fetchStages()]).then(([cs, ss]) => {
      setCandidates(cs);
      setStages(ss);
      setLoading(false);
    });
  }, []);

  // ── 指标计算 ──────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const total = candidates.length;
    const now = Date.now();
    const ago30 = now - 30 * 86400000;
    const newMonth = candidates.filter(c => new Date(c.createdAt).getTime() > ago30).length;
    const scored = candidates.filter(c => c.rating > 0);
    const avgScore = scored.length ? Math.round(scored.reduce((s, c) => s + c.rating, 0) / scored.length) : 0;
    const highMatch = candidates.filter(c => c.rating >= 80).length;
    const available = candidates.filter(c => c.available).length;
    const favorites = candidates.filter(c => c.favorite).length;
    const withContact = candidates.filter(c => c.email || c.phone || c.portfolio).length;
    const highMatchRate = total > 0 ? Math.round(highMatch / total * 100) : 0;
    return { total, newMonth, avgScore, highMatch, available, favorites, withContact, highMatchRate };
  }, [candidates]);

  const platformData = useMemo(() => {
    return PLATFORM_LIST.map(p => ({
      label: p.label,
      value: candidates.filter(c => c.source === p.id).length,
      color: PLATFORMS[p.id as Platform].color.brand,
    })).concat([{
      label: "手动",
      value: candidates.filter(c => !c.source || c.source === "manual").length,
      color: "#94a3b8",
    }]).filter(d => d.value > 0);
  }, [candidates]);

  const scoreData = useMemo(() => [
    { label: "高度匹配 ≥80", min: 80, max: 101, color: "#10b981" },
    { label: "较高匹配 60-79", min: 60, max: 80, color: "#6366f1" },
    { label: "可关注 40-59", min: 40, max: 60, color: "#f59e0b" },
    { label: "偏低 20-39", min: 20, max: 40, color: "#f97316" },
    { label: "低匹配 <20", min: 0, max: 20, color: "#ef4444" },
  ].map(b => ({
    ...b,
    value: candidates.filter(c => c.rating >= b.min && c.rating < b.max).length,
  })), [candidates]);

  const skillData = useMemo(() => {
    const freq: Record<string, { count: number; source: string }> = {};
    for (const c of candidates) {
      for (const skill of c.skills ?? []) {
        if (!skill.trim()) continue;
        if (!freq[skill]) freq[skill] = { count: 0, source: c.source ?? "manual" };
        freq[skill].count++;
      }
    }
    return Object.entries(freq)
      .map(([name, d]) => ({
        name,
        count: d.count,
        color: d.source && PLATFORMS[d.source as Platform]
          ? PLATFORMS[d.source as Platform].color.brand
          : "#6366f1",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [candidates]);

  const weeklyData = useMemo(() => {
    const now = new Date();
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      const label = `${end.getMonth() + 1}/${end.getDate()}`;
      const newCount = candidates.filter(c => {
        const t = new Date(c.createdAt).getTime();
        return t >= start.getTime() && t < end.getTime();
      }).length;
      return { label, newCount, start: start.getTime() };
    }).reverse();
    let cumulative = 0;
    return weeks.map(w => {
      cumulative += w.newCount;
      return { ...w, cumulative };
    });
  }, [candidates]);

  const funnelData = useMemo(() => {
    const stageMap = Object.fromEntries(stages.map(s => [s.id, s.name]));
    const inProgress = candidates.filter(c => {
      const name = stageMap[c.stageId] ?? "";
      return name.includes("面试") || name.includes("offer") || name.includes("意向");
    }).length;
    return [
      { label: "全部候选人", value: candidates.length, color: "#6366f1" },
      { label: "高匹配 ≥80", value: kpis.highMatch, color: "#10b981" },
      { label: "已收藏", value: kpis.favorites, color: "#f59e0b" },
      { label: "求职开放", value: kpis.available, color: "#00a1d6" },
      { label: "有联系方式", value: kpis.withContact, color: "#8b5cf6" },
    ].filter(d => d.value > 0);
  }, [candidates, stages, kpis]);

  // ── AI 生成 ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenError("");
    try {
      const aiConfig = loadAiConfig();
      const body = {
        total: kpis.total,
        newThisMonth: kpis.newMonth,
        avgScore: kpis.avgScore,
        highMatch: kpis.highMatch,
        available: kpis.available,
        platforms: platformData.map(p => ({ label: p.label, count: p.value })),
        topSkills: skillData.map(s => ({ name: s.name, count: s.count })),
        scoreDistribution: scoreData.map(s => ({ label: s.label, count: s.value })),
        stages: stages.map(s => ({ name: s.name, count: candidates.filter(c => c.stageId === s.id).length })),
        aiConfig,
      };
      const res = await fetch("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await res.json() as { ok: boolean; insights?: GeneratedInsights; error?: string };
      if (data.ok && data.insights) {
        setAiInsights(data.insights);
      } else {
        setGenError(data.error ?? "生成失败，请检查 AI 配置");
      }
    } catch (e) {
      setGenError(String(e));
    } finally {
      setGenerating(false);
    }
  }, [kpis, platformData, skillData, scoreData, stages, candidates]);

  // ── 渲染 ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8 space-y-7">
      {/* 标题 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">人才情报中心</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            基于候选人库的多维数据分析 · 共 {kpis.total} 人
          </p>
        </div>
        {kpis.total > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Activity size={12} />
            实时更新
          </div>
        )}
      </div>

      {/* KPI 条 */}
      <KpiStrip kpis={kpis} />

      {/* 趋势 + 漏斗 */}
      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">入库趋势（近12周）</h2>
          <TrendLine weeks={weeklyData} />
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">招募漏斗</h2>
          {funnelData.length > 0 ? <Funnel stages={funnelData} /> : <Empty text="入库候选人后显示" />}
        </div>
      </div>

      {/* 平台分布 + 评分分布 */}
      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">平台来源分布</h2>
          <DonutChart data={platformData} />
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">AI 评分分布</h2>
          <ScoreHistogram data={scoreData} />
        </div>
      </div>

      {/* 技能情报 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-800">技能情报 TOP 15</h2>
          <span className="text-[11px] text-slate-400">颜色代表主要来源平台</span>
        </div>
        {skillData.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-x-8">
            <SkillsChart skills={skillData.slice(0, 8)} />
            <SkillsChart skills={skillData.slice(8, 15)} />
          </div>
        ) : (
          <Empty text="入库候选人后自动提取技能标签" />
        )}
      </div>

      {/* AI 洞察 */}
      <AiInsightsPanel
        onGenerate={handleGenerate}
        insights={aiInsights}
        generating={generating}
        error={genError}
      />

      {/* 空状态提示 */}
      {kpis.total === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
          <Activity size={32} className="mx-auto mb-3 text-slate-200" />
          <p className="text-slate-400 text-sm font-medium">暂无候选人数据</p>
          <p className="text-slate-300 text-xs mt-1">先在「扫描」页面搜索候选人并入库</p>
        </div>
      )}
    </main>
  );
}

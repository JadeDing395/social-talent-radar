"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RadarResult, ScoreWeights, DEFAULT_WEIGHTS } from "@/lib/scoring-config";
import type { Platform } from "@/lib/types";
import { PLATFORMS } from "@/lib/platforms";

interface Props {
  result: RadarResult;
  weights?: ScoreWeights;
  /** 可选;若未传则使用 result.platform 自身的平台(混排场景) */
  platform?: Platform;
}

const LEVEL_STYLES: Record<string, string> = {
  "高度匹配": "bg-emerald-100 text-emerald-800",
  "较高匹配": "bg-amber-50 text-amber-800",
  "可关注": "bg-amber-100 text-amber-800",
  "低匹配": "bg-slate-100 text-slate-500",
};

const REGION_STYLES: Record<string, string> = {
  "确认中国区域": "bg-red-100 text-red-700",
  "疑似中国区域": "bg-orange-100 text-orange-700",
  "非中国区域": "bg-slate-100 text-slate-500",
};

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 text-slate-500 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "var(--color-brand)" }} />
      </div>
      <span className="w-10 text-right text-slate-600 font-medium">{value}/{max}</span>
    </div>
  );
}

export default function RadarResultCard({ result, weights = DEFAULT_WEIGHTS, platform }: Props) {
  const activePlatform: Platform = platform ?? result.platform;
  const totalMax =
    weights.jd + weights.keyword + weights.experience +
    weights.education + weights.openness + weights.followers;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const apiPath = `${PLATFORMS[activePlatform].apiPrefix}/save`;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (res.ok || res.status === 409) {
        setSaved(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "保存失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div className="flex gap-4">
        {result.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.avatar_url} alt={result.name} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center font-bold flex-shrink-0"
            style={{ backgroundColor: PLATFORMS[activePlatform].badge.bg, color: PLATFORMS[activePlatform].badge.fg }}
          >
            {result.name[0]}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={result.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-900 hover:text-slate-700"
            >
              {result.name}
            </a>
            {result.verified && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded text-white"
                style={{ backgroundColor: PLATFORMS[activePlatform].color.brand }}
                title={result.verified_reason ?? "已认证"}
              >
                ✓ 认证
              </span>
            )}
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: PLATFORMS[activePlatform].badge.bg, color: PLATFORMS[activePlatform].badge.fg }}
            >
              {PLATFORMS[activePlatform].label}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${REGION_STYLES[result.region_confidence]}`}>
              {result.region_confidence}
            </span>
          </div>
          {result.headline && (
            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{result.headline}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
            {typeof result.followers_count === "number" && (
              <span className="tabular-nums">👥 {result.followers_count.toLocaleString()} 粉</span>
            )}
            {typeof result.posts_count === "number" && (
              <span className="tabular-nums">📝 {result.posts_count.toLocaleString()}</span>
            )}
            {result.ip_location && <span>📍 {result.ip_location}</span>}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-3xl font-bold tabnum" style={{ color: "var(--color-brand)" }}>{result.total_score}</div>
          <div className="text-[10px] text-slate-400">/ {totalMax}</div>
          <span className={`mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-medium ${LEVEL_STYLES[result.score_level]}`}>
            {result.score_level}
          </span>
        </div>
      </div>

      {/* 作品图网格（vision 用过的） */}
      {result.recent_work_images.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {result.recent_work_images.slice(0, 4).map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              className="w-full aspect-square object-cover rounded-lg border border-slate-200"
              loading="lazy"
            />
          ))}
        </div>
      )}

      <div className="mt-4 space-y-1.5">
        <ScoreBar label="JD 匹配度" value={result.score_breakdown.jd_match} max={weights.jd} />
        <ScoreBar label="关键词匹配" value={result.score_breakdown.keyword_match} max={weights.keyword} />
        <ScoreBar label="背景经验" value={result.score_breakdown.experience_match} max={weights.experience} />
        <ScoreBar label="教育与履历" value={result.score_breakdown.education_match} max={weights.education} />
        <ScoreBar label="开放度" value={result.score_breakdown.openness} max={weights.openness} />
        <ScoreBar label="粉丝影响力" value={result.score_breakdown.followers} max={weights.followers} />
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="text-emerald-700">
          <span className="font-semibold">+ </span>{result.pros}
        </div>
        <div className="text-rose-600">
          <span className="font-semibold">− </span>{result.cons}
        </div>
        <div className="text-slate-600 italic">"{result.art_evaluation}"</div>
        {result.vision_used && (
          <div className="text-[10px] text-slate-400">👁 本次评分参考了候选人的作品图</div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="space-y-0.5">
          {result.contact && <div>📞 {result.contact}</div>}
          {result.current_project && <div>🏢 {result.current_project}</div>}
          <div className="text-[10px] text-slate-400">{result.open_to_opportunity}</div>
        </div>
        <div className="flex gap-2">
          <a
            href={result.profile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            主页
          </a>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium ${
              saved ? "bg-emerald-100 text-emerald-700" : "text-white disabled:opacity-60"
            }`}
            style={!saved ? { backgroundColor: "var(--color-brand)" } : undefined}
          >
            {saved ? "✓ 已入库" : saving ? "..." : "入库"}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}

      {result.suggested_tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {result.suggested_tags.map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              #{t}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

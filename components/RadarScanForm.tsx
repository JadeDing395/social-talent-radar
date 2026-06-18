"use client";

import { useState, useEffect } from "react";
import ChipSelect from "./ChipSelect";
import type { Platform } from "@/lib/types";
import { DEFAULT_EDUCATION, EDUCATION_OPTIONS, normalizeEducation, type ICP } from "@/lib/icp-shared";
import { useRadarScan, ScanFormSnapshot } from "./RadarScanContext";
import {
  CATEGORY_PRESETS,
  ScoreWeights,
  DEFAULT_WEIGHTS,
  DIMENSION_DEFINITIONS,
  type PositionCategory,
} from "@/lib/scoring-config";
import { loadAiConfig } from "./AiSettingsModal";
import { PLATFORMS } from "@/lib/platforms";
import SectionCard, { ActionCard } from "./SectionCard";

interface Props {
  selectedPlatforms: Platform[];
  unloggedInPlatforms: Platform[];
  appliedIcp?: ICP | null;
}

const OTHER_POSITION = "其他（自定义）";

const POSITION_OPTIONS: Record<PositionCategory, string[]> = {
  art: [
    "原画师 / 角色原画", "场景原画 / 概念设计", "插画师",
    "Q版/二次元立绘", "3D 角色 / 3D 场景", "动效 / 特效",
    "美术指导 / 主美",
  ],
  tech: [
    "前端工程师", "后端工程师", "全栈工程师",
    "图形程序员 / TA", "游戏客户端工程师", "服务端工程师", "数据工程师",
  ],
  design: [
    "UI/UX 设计师", "视觉设计师", "品牌设计师",
    "交互设计师", "游戏 UI 设计师",
  ],
  content: [
    "视频创作者 / UP 主", "内容运营", "游戏博主",
    "教程创作者", "社区运营",
  ],
  general: [
    "产品经理", "游戏策划", "项目经理",
    "运营", "市场推广", "商务拓展",
  ],
};

const ART_STYLES = ["二次元", "国风/古风", "写实", "Q版/卡通", "赛博朋克", "奇幻", "MOBA 写实", "国漫"];
const TOOLS = ["Photoshop", "Procreate", "Clip Studio", "Blender", "ZBrush", "Maya", "3ds Max", "Substance Painter"];
// 当前类型下的快捷关键词建议
const KEYWORD_OPTIONS: Record<PositionCategory, string[]> = {
  art: [
    "原神", "鸣潮", "崩坏", "王者荣耀", "明日方舟",
    "约稿", "接稿", "商稿", "二次元", "国风", "写实", "赛博朋克",
  ],
  tech: [
    "React", "Unity", "Unreal", "TypeScript", "Python", "Rust",
    "WebGL", "OpenGL", "DirectX", "游戏引擎", "开源", "求职",
  ],
  design: [
    "Figma", "原型设计", "游戏 UI", "移动端", "Design System",
    "Brand Identity", "Motion Design", "接稿", "作品集",
  ],
  content: [
    "游戏攻略", "游戏评测", "教程", "Vlog", "游戏解说",
    "UP 主", "粉丝互动", "直播",
  ],
  general: [
    "游戏策划", "数值策划", "产品设计", "用户研究",
    "商业分析", "增长", "运营",
  ],
};
const REGIONS = ["中国大陆", "中国区域", "包含港澳台", "亚洲区域", "不限"];

const WEIGHT_STORAGE = "radar-weights";
const FORM_STORAGE = "radar-form-global";
const JD_BY_POSITION_STORAGE = "radar-jd-by-position";

function loadJdMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(JD_BY_POSITION_STORAGE);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveJdForPosition(position: string, jd: string) {
  if (typeof window === "undefined") return;
  try {
    const map = loadJdMap();
    if (jd.trim()) {
      map[position] = jd;
    } else {
      delete map[position];
    }
    localStorage.setItem(JD_BY_POSITION_STORAGE, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Reusable styled inputs */
const fieldClass = "w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400/30 transition-shadow tabular-nums";
const labelClass = "block text-xs font-medium text-slate-700 mb-1.5";

function isPositionCategory(value: unknown): value is PositionCategory {
  return typeof value === "string" && value in CATEGORY_PRESETS;
}

function findCategoryForPosition(position: string): PositionCategory | null {
  for (const cat of Object.keys(POSITION_OPTIONS) as PositionCategory[]) {
    if (POSITION_OPTIONS[cat].includes(position)) return cat;
  }
  return null;
}

export default function RadarScanForm({ selectedPlatforms, unloggedInPlatforms, appliedIcp }: Props) {
  const { isAnyScanning, stopScan, startScan } = useRadarScan();

  const [category, setCategory] = useState<PositionCategory>("art");
  const [position, setPosition] = useState(POSITION_OPTIONS.art[0]);
  const [customPosition, setCustomPosition] = useState("");
  const [jd, setJd] = useState("");
  const [savedJdForCurrentPosition, setSavedJdForCurrentPosition] = useState("");
  const [jdSavedAt, setJdSavedAt] = useState<number | null>(null);
  const [artStyles, setArtStyles] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [education, setEducation] = useState(DEFAULT_EDUCATION);
  const [experience, setExperience] = useState("");
  const [region, setRegion] = useState("中国大陆");
  const [minScore, setMinScore] = useState(60);
  const [targetCount, setTargetCount] = useState(10);
  const [rescanIntervalDays, setRescanIntervalDays] = useState(90);
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [appliedIcpKey, setAppliedIcpKey] = useState("");

  const handleCategoryChange = (newCat: PositionCategory) => {
    setCategory(newCat);
    const preset = CATEGORY_PRESETS[newCat];
    setPosition(POSITION_OPTIONS[newCat][0]);
    setCustomPosition("");
    setArtStyles([]);
    setTools([]);
    setThemes([]);
    setWeights(preset.weights);
  };

  // mount 后从 localStorage 同步表单初值。setState in effect 是 hydration 场景的标准模式,
  // SSR 必须先吐 INITIAL,client 再补真值,无法避免 — 关 lint 警告。
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FORM_STORAGE);
      if (raw) {
        const f = JSON.parse(raw) as Partial<ScanFormSnapshot> & { customPosition?: string };
        const savedCategory = isPositionCategory(f.positionCategory) ? f.positionCategory : "art";
        const savedPosition = f.position ?? POSITION_OPTIONS[savedCategory][0];
        setCategory(savedCategory);
        setPosition(
          POSITION_OPTIONS[savedCategory].includes(savedPosition) || savedPosition === OTHER_POSITION
            ? savedPosition
            : POSITION_OPTIONS[savedCategory][0],
        );
        if (f.customPosition) setCustomPosition(f.customPosition);
        setArtStyles(f.artStyles ?? []);
        setTools(f.tools ?? []);
        setThemes(f.themes ?? []);
        setEducation(normalizeEducation(f.education));
        setExperience(f.experience ?? "");
        setRegion(f.region ?? "中国大陆");
        setMinScore(f.minScore ?? 60);
        setTargetCount(f.targetCount ?? 10);
        setRescanIntervalDays(f.rescanIntervalDays ?? 90);
      }
      const w = localStorage.getItem(WEIGHT_STORAGE);
      if (w) setWeights(JSON.parse(w));
    } catch {
      // ignore
    }
  }, []);

  const effectivePositionKey = position === OTHER_POSITION ? customPosition.trim() : position;
  useEffect(() => {
    if (position !== OTHER_POSITION && !POSITION_OPTIONS[category].includes(position)) {
      setPosition(POSITION_OPTIONS[category][0]);
      setCustomPosition("");
    }
  }, [category, position]);

  useEffect(() => {
    if (!effectivePositionKey) {
      setJd("");
      setSavedJdForCurrentPosition("");
      setJdSavedAt(null);
      return;
    }
    const map = loadJdMap();
    const savedJd = map[effectivePositionKey] ?? "";
    setJd(savedJd);
    setSavedJdForCurrentPosition(savedJd);
    setJdSavedAt(savedJd ? Date.now() : null);
  }, [effectivePositionKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSaveJd = () => {
    if (!effectivePositionKey) {
      alert("请先选定一个岗位");
      return;
    }
    saveJdForPosition(effectivePositionKey, jd);
    setSavedJdForCurrentPosition(jd);
    setJdSavedAt(Date.now());
  };
  const jdDirty = jd.trim() !== savedJdForCurrentPosition.trim();

  const persist = (snapshot: ScanFormSnapshot & { customPosition: string }, nextWeights: ScoreWeights = weights) => {
    try {
      localStorage.setItem(FORM_STORAGE, JSON.stringify(snapshot));
      localStorage.setItem(WEIGHT_STORAGE, JSON.stringify(nextWeights));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!appliedIcp) return;
    const nextKey = JSON.stringify(appliedIcp);
    if (nextKey === appliedIcpKey) return;

    const matchedCategory = findCategoryForPosition(appliedIcp.position);
    const nextCategory = matchedCategory ?? category;
    const nextPosition = matchedCategory ? appliedIcp.position : OTHER_POSITION;
    const nextCustomPosition = nextPosition === OTHER_POSITION ? appliedIcp.position : "";
    const nextPositionKey = nextPosition === OTHER_POSITION ? nextCustomPosition : nextPosition;
    const nextSnapshot: ScanFormSnapshot & { customPosition: string } = {
      position: nextPosition,
      positionCategory: nextCategory,
      customPosition: nextCustomPosition,
      jd: appliedIcp.jd,
      artStyles,
      tools,
      themes: appliedIcp.keywords,
      education: normalizeEducation(appliedIcp.education),
      experience: appliedIcp.experience ?? "",
      region,
      minScore,
      targetCount,
      rescanIntervalDays,
    };

    if (nextPositionKey) saveJdForPosition(nextPositionKey, appliedIcp.jd);
    setCategory(nextCategory);
    setPosition(nextPosition);
    setCustomPosition(nextCustomPosition);
    setJd(appliedIcp.jd);
    setSavedJdForCurrentPosition(appliedIcp.jd);
    setJdSavedAt(Date.now());
    setThemes(appliedIcp.keywords);
    setEducation(normalizeEducation(appliedIcp.education));
    setExperience(appliedIcp.experience ?? "");
    setWeights(appliedIcp.weights);
    persist(nextSnapshot, appliedIcp.weights);
    setAppliedIcpKey(nextKey);
  }, [
    appliedIcp,
    appliedIcpKey,
    artStyles,
    category,
    minScore,
    region,
    rescanIntervalDays,
    targetCount,
    tools,
  ]);

  const totalWeight = weights.jd + weights.keyword + weights.experience + weights.education + weights.openness + weights.followers;
  const weightOk = totalWeight === 100;
  const noPlatformSelected = selectedPlatforms.length === 0;
  const hasUnloggedIn = unloggedInPlatforms.length > 0;

  const handleScan = async () => {
    const effectivePosition = position === OTHER_POSITION ? customPosition.trim() : position;
    if (!effectivePosition) {
      alert("请填入岗位名称");
      return;
    }
    if (!weightOk) {
      alert(`评分权重合计必须等于 100 才能开始扫描,当前合计 ${totalWeight}。请到「评分与目标」调整。`);
      return;
    }
    if (noPlatformSelected) {
      alert("请至少勾选一个扫描渠道");
      return;
    }
    if (hasUnloggedIn) {
      alert(`以下平台还未登录,请先登录或取消勾选:${unloggedInPlatforms.map((p) => PLATFORMS[p].label).join("、")}`);
      return;
    }
    const snapshot: ScanFormSnapshot = {
      position: effectivePosition,
      positionCategory: category,
      jd,
      artStyles,
      tools,
      themes,
      education,
      experience,
      region,
      minScore,
      targetCount,
      rescanIntervalDays,
    };
    persist({ ...snapshot, customPosition });
    const aiConfig = loadAiConfig();
    if (!aiConfig.apiKey) {
      alert("请先在「AI 设置」中填入 API Key");
      return;
    }
    await startScan({ platforms: selectedPlatforms, form: snapshot, weights, aiConfig });
  };

  const updateWeight = (key: keyof ScoreWeights, value: number) => {
    setWeights((w) => ({ ...w, [key]: Math.max(0, Math.min(100, value)) }));
  };

  const [restoredFlash, setRestoredFlash] = useState(false);
  const restoreDefault = () => {
    setWeights(DEFAULT_WEIGHTS);
    setRestoredFlash(true);
    setTimeout(() => setRestoredFlash(false), 2500);
  };

  const DIM_COLORS: Record<keyof ScoreWeights, string> = {
    jd: "var(--color-brand)",
    keyword: "#10b981",
    experience: "#f59e0b",
    education: "#0ea5e9",
    openness: "#8b5cf6",
    followers: "#f43f5e",
  };

  const buttonDisabled = !weightOk || noPlatformSelected || hasUnloggedIn;
  const buttonLabel = noPlatformSelected
    ? "请先勾选扫描渠道"
    : `🔍 开始扫描 (${selectedPlatforms.length} 个平台)`;
  const buttonTooltip = !weightOk
    ? `权重合计需要等于 100(当前 ${totalWeight})`
    : noPlatformSelected
    ? "请至少勾选一个扫描渠道"
    : hasUnloggedIn
    ? `未登录:${unloggedInPlatforms.map((p) => PLATFORMS[p].label).join("、")}`
    : "开始扫描";

  return (
    <div className="space-y-4">
      {/* ─── 基本信息 ─── */}
      <SectionCard title="基本信息" subtitle="岗位、地域、学历、经验,这些是 AI 评分的基础语境">
        {/* 岗位类型选择器 */}
        <div className="mb-5">
          <label className={labelClass}>岗位类型</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_PRESETS) as PositionCategory[]).map((cat) => {
              const preset = CATEGORY_PRESETS[cat];
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                  }`}
                >
                  {preset.label}
                  <span className={`ml-1.5 text-xs ${active ? "text-slate-300" : "text-slate-400"}`}>
                    {preset.description.split("、")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>岗位名称</label>
            <select value={position} onChange={(e) => setPosition(e.target.value)} className={fieldClass}>
              {[...POSITION_OPTIONS[category], OTHER_POSITION].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {position === OTHER_POSITION && (
              <input
                type="text"
                value={customPosition}
                onChange={(e) => setCustomPosition(e.target.value)}
                placeholder="例如：MOBA 角色原画师"
                className={`mt-2 ${fieldClass}`}
              />
            )}
          </div>

          <div>
            <label className={labelClass}>地域</label>
            <select value={region} onChange={(e) => setRegion(e.target.value)} className={fieldClass}>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>学历要求</label>
            <select
              value={education}
              onChange={(e) => setEducation(e.target.value as typeof EDUCATION_OPTIONS[number])}
              className={fieldClass}
            >
              {EDUCATION_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>经验要求（可选）</label>
            <input
              type="text"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="3 年以上 / 5 年以上 / 不限"
              className={fieldClass}
            />
          </div>
        </div>
      </SectionCard>

      {/* ─── JD 描述 ─── */}
      <SectionCard
        title="JD 描述"
        subtitle="可选 · 按岗位独立保存,下次选同岗位自动加载"
        right={
          <div className="flex items-center gap-2">
            {jdSavedAt && !jdDirty && (
              <span className="text-[11px] text-emerald-600 whitespace-nowrap">
                ✓ 已保存到「{effectivePositionKey || "?"}」
              </span>
            )}
            {jdDirty && jd.trim() && (
              <span className="text-[11px] text-amber-600 whitespace-nowrap">● 有未保存改动</span>
            )}
            <button
              type="button"
              onClick={handleSaveJd}
              disabled={!effectivePositionKey || (!jdDirty && !jd.trim())}
              className="text-[11px] px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              保存到此岗位
            </button>
          </div>
        }
      >
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder={`为「${effectivePositionKey || "当前岗位"}」描述要求；保存后下次选这个岗位会自动加载...`}
          rows={3}
          className={fieldClass}
        />
      </SectionCard>

      {/* ─── 风格筛选 ─── */}
      <SectionCard title="关键词筛选" subtitle="多选 chip,留空表示不限">
        <div className="grid grid-cols-1 gap-4">
          {(category === "art" || category === "design") && (
            <>
              <ChipSelect label="风格标签" options={ART_STYLES} value={artStyles} onChange={setArtStyles} allowCustom />
              <ChipSelect label="工具 / 软件" options={TOOLS} value={tools} onChange={setTools} allowCustom />
            </>
          )}
          <ChipSelect
            label="关键词"
            options={KEYWORD_OPTIONS[category]}
            value={themes}
            onChange={setThemes}
            allowCustom
            placeholder="添加自定义关键词..."
          />
        </div>
      </SectionCard>

      {/* ─── 评分与目标 ─── */}
      <SectionCard
        title="评分与目标"
        subtitle="最低分数 / 命中数量 / 重扫间隔 · 评分维度权重可在下方折叠区调整"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>
              最低评分 <span className="text-slate-400 font-normal">(0-{totalWeight})</span>
            </label>
            <input
              type="number"
              min={0}
              max={totalWeight}
              value={minScore}
              onChange={(e) => setMinScore(Math.max(0, Math.min(totalWeight, Number(e.target.value) || 0)))}
              className={fieldClass}
            />
            <p className="text-[11px] text-slate-400 mt-1">低于此分数会被归到「未命中」</p>
          </div>

          <div>
            <label className={labelClass}>
              目标人数 <span className="text-slate-400 font-normal">· 每个平台</span>
            </label>
            <input
              type="number"
              min={3}
              max={50}
              value={targetCount}
              onChange={(e) => setTargetCount(Math.max(3, Math.min(50, Number(e.target.value) || 3)))}
              className={fieldClass}
            />
            <p className="text-[11px] text-slate-400 mt-1">单平台命中达到此数后停止</p>
          </div>

          <div>
            <label className={labelClass}>
              重扫间隔 <span className="text-slate-400 font-normal">(天) · 0 = 永不重扫</span>
            </label>
            <input
              type="number"
              min={0}
              max={365}
              value={rescanIntervalDays}
              onChange={(e) => setRescanIntervalDays(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
              className={fieldClass}
            />
            <p className="text-[11px] text-slate-400 mt-1">已入库且最近扫过的候选人会被跳过</p>
          </div>
        </div>

        {/* 评分维度折叠 — 宽条 Accordion 触发器，视觉上明显可点击 */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setWeightsOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <span
                className="text-slate-400 group-hover:text-slate-600 transition-transform duration-200"
                style={{ transform: weightsOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}
              >
                ▶
              </span>
              <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">评分维度与权重</span>
              <span className="text-[11px] text-slate-400">· 点击展开查看 AI 评分逻辑 / 调整各维度权重</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {weightsOpen && restoredFlash && (
                <span className="text-[11px] text-emerald-600">已恢复默认权重</span>
              )}
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums ${
                  weightOk ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"
                }`}
              >
                {weightOk ? `✓ ${totalWeight}/100` : `${totalWeight}/100 — ${totalWeight > 100 ? "超出" : "还差"} ${Math.abs(100 - totalWeight)}`}
              </span>
            </div>
          </button>
          {weightsOpen && (
            <div className="mt-2 flex justify-end">
              <span className="text-[11px] text-slate-400 mr-2">已自动保存</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); restoreDefault(); }}
                className="text-[11px] px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                恢复默认
              </button>
            </div>
          )}

          {weightsOpen && (
            <div className="mt-3 space-y-3">
              <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
                {DIMENSION_DEFINITIONS.map((d) => {
                  const pct = totalWeight > 0 ? (weights[d.key] / totalWeight) * 100 : 0;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={d.key}
                      title={`${d.name} ${weights[d.key]} 分 (${pct.toFixed(0)}%)`}
                      style={{ width: `${pct}%`, backgroundColor: DIM_COLORS[d.key] }}
                    />
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DIMENSION_DEFINITIONS.map((d) => (
                  <div
                    key={d.key}
                    className="relative border border-slate-200 rounded-lg p-3 pl-4 bg-white"
                    style={{ borderLeftWidth: 3, borderLeftColor: DIM_COLORS[d.key] }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-slate-800">{d.name}</div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={weights[d.key]}
                          onChange={(e) => updateWeight(d.key, Number(e.target.value) || 0)}
                          className="w-14 px-2 py-0.5 text-xs text-right tabular-nums border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-400/30"
                        />
                        <span className="text-[10px] text-slate-400">分</span>
                      </div>
                    </div>
                    <ul className="space-y-0.5">
                      {d.bullets.map((b, i) => (
                        <li key={i} className="text-[11px] text-slate-500 leading-snug">· {b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ─── 浮动操作卡 ─── */}
      <ActionCard>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {isAnyScanning ? (
            <button
              onClick={() => stopScan()}
              className="px-6 py-3 text-sm font-medium text-white rounded-xl bg-slate-400 hover:bg-slate-500 transition-colors"
            >
              ■ 停止全部扫描
            </button>
          ) : (
            <button
              onClick={handleScan}
              disabled={buttonDisabled}
              title={buttonTooltip}
              className={`px-6 py-3 text-sm font-semibold text-white rounded-xl transition-all ${
                buttonDisabled
                  ? "bg-slate-300 cursor-not-allowed"
                  : "shadow-[0_2px_4px_rgba(15,23,42,0.06),0_8px_20px_rgba(15,23,42,0.08)] hover:-translate-y-0.5"
              }`}
              style={!buttonDisabled ? { backgroundColor: "var(--color-brand)" } : undefined}
            >
              {buttonLabel}
            </button>
          )}
          <div className="flex-1 min-w-0 text-right">
            {!weightOk && !isAnyScanning && (
              <p className="text-[11px] text-rose-600">
                权重合计 {totalWeight}/100,请到「评分与目标」调到 100
              </p>
            )}
            {weightOk && noPlatformSelected && !isAnyScanning && (
              <p className="text-[11px] text-amber-600">请至少勾选一个扫描渠道</p>
            )}
            {weightOk && !noPlatformSelected && hasUnloggedIn && !isAnyScanning && (
              <p className="text-[11px] text-amber-600">
                未登录:{unloggedInPlatforms.map((p) => PLATFORMS[p].label).join("、")} — 请先在上方平台卡点「扫码登录」
              </p>
            )}
            {weightOk && !noPlatformSelected && !hasUnloggedIn && !isAnyScanning && (
              <p className="text-[11px] text-slate-400">
                准备就绪 · 将在 {selectedPlatforms.length} 个平台并发抓取
              </p>
            )}
          </div>
        </div>
      </ActionCard>
    </div>
  );
}

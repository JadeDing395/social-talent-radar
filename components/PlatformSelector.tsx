"use client";

import type { Platform } from "@/lib/types";
import { PLATFORM_LIST, PLATFORMS } from "@/lib/platforms";

export interface LoginInfo {
  loggedIn: boolean;
  message?: string;
  checking: boolean;
}

export type LoginByPlatform = Partial<Record<Platform, LoginInfo>>;

interface Props {
  selected: Platform[];
  onChange: (next: Platform[]) => void;
  loginByPlatform: LoginByPlatform;
  onRecheck: (platform: Platform) => void;
}

const STORAGE_KEY = "radar-scan-platforms";

export function loadSelectedPlatforms(): Platform[] {
  if (typeof window === "undefined") return PLATFORM_LIST.map((p) => p.id);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return PLATFORM_LIST.map((p) => p.id);
    const arr = JSON.parse(raw) as Platform[];
    const valid = PLATFORM_LIST.map((p) => p.id);
    const filtered = arr.filter((x) => valid.includes(x));
    return filtered.length > 0 ? filtered : PLATFORM_LIST.map((p) => p.id);
  } catch {
    return PLATFORM_LIST.map((p) => p.id);
  }
}

export function saveSelectedPlatforms(selected: Platform[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  } catch {
    // ignore
  }
}

export function findUnloggedInPlatforms(
  selected: Platform[],
  loginByPlatform: LoginByPlatform,
): Platform[] {
  return selected.filter((p) => {
    if (PLATFORMS[p].requiresLogin === "none") return false;
    return loginByPlatform[p]?.loggedIn !== true;
  });
}

export default function PlatformSelector({ selected, onChange, loginByPlatform, onRecheck }: Props) {
  const toggle = (id: Platform) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">扫描渠道</h3>
        <span className="text-[11px] text-slate-400">可多选并发执行 · 单选时整页主色跟随该平台</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PLATFORM_LIST.map((meta) => {
          const id = meta.id;
          const info = loginByPlatform[id];
          const checked = selected.includes(id);
          const needsLogin = meta.requiresLogin === "qr";
          const isLoggedIn = info?.loggedIn === true;

          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={`
                group relative text-left rounded-2xl p-5 transition-all border
                ${checked
                  ? "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.08)] -translate-y-0.5"
                  : "border-slate-200 bg-white hover:bg-slate-50/60 hover:border-slate-300"}
              `}
              style={
                checked
                  ? {
                      borderColor: meta.color.brand,
                      backgroundColor: meta.color.brandSoft,
                    }
                  : undefined
              }
            >
              {/* 勾选指示器 */}
              <div
                className="absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                style={{
                  borderColor: checked ? meta.color.brand : "#cbd5e1",
                  backgroundColor: checked ? meta.color.brand : "transparent",
                }}
              >
                {checked && <span className="text-white text-[10px] leading-none">✓</span>}
              </div>

              {/* 平台 logo + 名称 */}
              <div className="flex items-center gap-2.5 mb-2 pr-8">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                  style={{ backgroundColor: meta.color.brand }}
                >
                  {meta.shortLabel}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-slate-900 truncate">{meta.label}</div>
                  <div className="text-[11px] text-slate-500 truncate">{meta.tagline}</div>
                </div>
              </div>

              {/* 登录状态行 */}
              <div className="mt-3 pt-3 border-t border-slate-200/70 flex items-center justify-between text-xs h-7">
                {!needsLogin ? (
                  <span className="text-emerald-600 inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    公开 API · 无需登录
                  </span>
                ) : info?.checking ? (
                  <span className="text-slate-400 inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    检测中...
                  </span>
                ) : isLoggedIn ? (
                  <>
                    <span className="text-emerald-600 inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      已登录
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRecheck(id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onRecheck(id);
                        }
                      }}
                      title="重新检测登录状态"
                      className="text-[10px] text-slate-400 hover:text-slate-700 underline cursor-pointer"
                    >
                      重新检测
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-amber-600 inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      未登录
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRecheck(id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onRecheck(id);
                        }
                      }}
                      className="text-[11px] px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      重新检测
                    </span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* LinkedIn/YouTube Roadmap */}
      <div className="mt-4 px-3 py-2.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
        <span className="text-[11px] text-slate-400">
          即将支持：LinkedIn（需官方合作）· YouTube Data API · 站酷 ZCOOL · Pixiv
        </span>
      </div>
    </div>
  );
}

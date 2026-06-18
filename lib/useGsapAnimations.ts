"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

// 数字从 0 滚动到目标值
export function useCountUp(
  value: number,
  options: { duration?: number; delay?: number; prefix?: string; suffix?: string } = {},
) {
  const ref = useRef<HTMLElement>(null);
  const { duration = 1.2, delay = 0 } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || value === 0) return;
    const obj = { val: 0 };
    const tween = gsap.to(obj, {
      val: value,
      duration,
      delay,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = Math.round(obj.val).toString();
      },
    });
    return () => { tween.kill(); };
  }, [value, duration, delay]);

  return ref;
}

// 元素组入场 stagger 动画
export function useStaggerIn(
  deps: unknown[] = [],
  options: { selector?: string; y?: number; duration?: number; stagger?: number; delay?: number } = {},
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { selector = ":scope > *", y = 20, duration = 0.5, stagger = 0.07, delay = 0 } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const els = container.querySelectorAll(selector);
    if (!els.length) return;

    gsap.set(els, { autoAlpha: 0, y });
    const tween = gsap.to(els, {
      autoAlpha: 1,
      y: 0,
      duration,
      stagger,
      delay,
      ease: "power2.out",
    });
    return () => { tween.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}

// 横向条形图宽度从 0 到目标值动画
export function useBarAnimate(deps: unknown[] = [], delay = 0.3) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const bars = container.querySelectorAll<HTMLElement>("[data-bar]");
    if (!bars.length) return;

    bars.forEach((bar) => {
      const target = parseFloat(bar.dataset.bar ?? "0");
      gsap.fromTo(
        bar,
        { width: "0%" },
        { width: `${target}%`, duration: 0.9, delay, ease: "power2.out" },
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}

"use client";

import { useEffect, useRef } from "react";
import { registerGsap, gsap, ScrollTrigger } from "./gsap-register";

// Mock dashboard reveal. Sidebar items cascade in, stat cards swoop from
// different edges, histogram bars grow, and the running-timer pill pulses.
// The timer digit counts up while visible so it feels alive.
export function DashboardReveal() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const timerRef = useRef<HTMLSpanElement | null>(null);
  const earnRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    registerGsap();
    if (!rootRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tweens: gsap.core.Tween[] = [];
    const timelines: gsap.core.Timeline[] = [];
    const triggers: ScrollTrigger[] = [];

    if (titleRef.current && !reduced) {
      const t = gsap.fromTo(
        titleRef.current.querySelectorAll("[data-line]"),
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 0.9,
          ease: "power4.out",
          stagger: 0.12,
          scrollTrigger: {
            trigger: titleRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );
      tweens.push(t);
    }

    if (cardRef.current && !reduced) {
      const card = cardRef.current;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: card,
          start: "top 80%",
          toggleActions: "play none none none",
        },
        defaults: { ease: "power3.out" },
      });
      timelines.push(tl);

      tl.fromTo(card, { y: 80, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 1.0 })
        .fromTo(
          card.querySelectorAll("[data-nav]"),
          { x: -20, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.5, stagger: 0.06 },
          "-=0.5"
        )
        .fromTo(
          card.querySelectorAll("[data-stat]"),
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.08 },
          "-=0.35"
        )
        .fromTo(
          card.querySelectorAll("[data-bar]"),
          { scaleY: 0 },
          {
            scaleY: 1,
            transformOrigin: "bottom",
            duration: 0.8,
            stagger: 0.03,
          },
          "-=0.4"
        )
        .fromTo(
          card.querySelectorAll("[data-pill]"),
          { scale: 0.6, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" },
          "-=0.5"
        );

      // Live timer counting — starts when the card is in view.
      const tick = { s: 8077, d: 187.43 };
      const liveTl = gsap.to(tick, {
        s: "+=300",
        d: "+=6.67",
        duration: 120,
        ease: "none",
        paused: true,
        onUpdate: () => {
          if (timerRef.current) {
            const s = Math.floor(tick.s);
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const ss = s % 60;
            timerRef.current.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
          }
          if (earnRef.current) {
            earnRef.current.textContent = `$${tick.d.toFixed(2)}`;
          }
        },
      });
      tweens.push(liveTl);

      const st = ScrollTrigger.create({
        trigger: card,
        start: "top 85%",
        end: "bottom 15%",
        onEnter: () => liveTl.play(),
        onEnterBack: () => liveTl.play(),
        onLeave: () => liveTl.pause(),
        onLeaveBack: () => liveTl.pause(),
      });
      triggers.push(st);
    }

    return () => {
      // Force any entrance tweens to completion so strict-mode cleanup never
      // leaves elements invisible.
      [...tweens, ...timelines].forEach((t) => {
        if (t.duration() < 100) t.progress(1);
        t.kill();
      });
      triggers.forEach((t) => t.kill());
    };
  }, []);

  return (
    <section ref={rootRef} className="relative bg-[var(--bg-sage)] py-32 md:py-44">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="text-center max-w-[840px] mx-auto mb-16 md:mb-24">
          <h2
            ref={titleRef}
            className="font-[family-name:var(--font-display)] text-[44px] md:text-[72px] font-bold tracking-[-0.03em] leading-[0.98] text-[var(--text-forest)]"
          >
            <span className="block overflow-hidden">
              <span data-line className="inline-block">The dashboard</span>
            </span>
            <span className="block overflow-hidden">
              <span data-line className="inline-block text-[var(--text-olive)]">you'll actually use.</span>
            </span>
          </h2>
          <p className="mt-8 text-[17px] md:text-[19px] text-[var(--text-olive)] leading-[1.55] max-w-[560px] mx-auto">
            No feature bloat, no popups, no upsell. Open the app, see exactly
            where you stand — and get back to work.
          </p>
        </div>

        <div
          ref={cardRef}
          className="relative rounded-[16px] bg-[var(--bg-cream)] shadow-[var(--shadow-dropdown)] overflow-hidden border border-[var(--border-subtle)]"
        >
          <div className="flex flex-col md:flex-row">
            {/* Sidebar */}
            <div className="hidden md:block w-[220px] shrink-0 p-6 border-r border-[var(--border-subtle)] bg-[var(--bg-sage)]">
              <div data-nav className="flex items-center gap-2.5 mb-10">
                <div className="h-6 w-6 rounded bg-[var(--text-forest)] flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">B</span>
                </div>
                <span className="font-[family-name:var(--font-display)] font-bold text-[15px] tracking-tight text-[var(--text-forest)]">
                  BogglTrack
                </span>
              </div>

              <div className="space-y-1.5 text-left">
                {[
                  { label: "Dashboard", active: true },
                  { label: "Timer" },
                  { label: "Calendar" },
                  { label: "Projects" },
                  { label: "Clients" },
                  { label: "Invoices" },
                ].map((item) => (
                  <div
                    data-nav
                    key={item.label}
                    className={`flex items-center gap-2.5 h-9 px-3 rounded-md text-[14px] font-medium ${
                      item.active
                        ? "bg-[var(--bg-cream)] shadow-[var(--shadow-card)] text-[var(--text-forest)]"
                        : "text-[var(--text-olive)]"
                    }`}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Main panel */}
            <div className="flex-1 p-8 md:p-12 text-left">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-[26px] md:text-[28px] font-semibold text-[var(--text-forest)] tracking-tight leading-[1.25]">
                    Dashboard
                  </h3>
                  <p className="text-[14px] text-[var(--text-olive)] mt-1">
                    This week's overview
                  </p>
                </div>
                <div
                  data-pill
                  className="flex items-center gap-3 px-4 py-2 rounded-md bg-[var(--bg-cream)] shadow-[var(--shadow-card)]"
                >
                  <span className="h-2 w-2 rounded-full bg-[var(--accent-olive)] pulse-dot" />
                  <span
                    ref={timerRef}
                    className="font-[family-name:var(--font-display)] text-[16px] font-semibold text-[var(--text-forest)] tabular-nums"
                  >
                    02:14:37
                  </span>
                  <span
                    ref={earnRef}
                    className="text-[14px] text-[var(--text-olive)] tabular-nums font-medium"
                  >
                    $187.43
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                {[
                  { label: "Today", hours: "2.3h", earn: "$187" },
                  { label: "Week", hours: "18.6h", earn: "$1,488" },
                  { label: "Month", hours: "74.2h", earn: "$5,936" },
                ].map((s) => (
                  <div
                    data-stat
                    key={s.label}
                    className="p-5 rounded-[12px] bg-[var(--bg-cream)] shadow-[var(--shadow-card)]"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-olive)]">
                      {s.label}
                    </p>
                    <p className="font-[family-name:var(--font-display)] mt-2 text-[32px] font-semibold text-[var(--text-forest)] tabular-nums leading-none tracking-tight">
                      {s.hours}
                    </p>
                    <p className="mt-2 text-[14px] font-medium text-[var(--text-olive)] tabular-nums">
                      {s.earn}
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-6 rounded-[12px] bg-[var(--bg-cream)] shadow-[var(--shadow-card)]">
                <div className="flex items-end gap-3 h-32 w-full pt-4">
                  {[6, 8, 5, 9, 12, 7, 3].map((h, i) => (
                    <div
                      data-bar
                      key={i}
                      className="flex-1 bg-[var(--text-forest)] rounded-sm"
                      style={{ height: `${(h / 12) * 100}%`, opacity: 0.2 + (h / 12) * 0.8 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

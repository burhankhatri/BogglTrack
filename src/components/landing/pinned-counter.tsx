"use client";

import { useEffect, useRef } from "react";
import { registerGsap, gsap, ScrollTrigger } from "./gsap-register";

// Pinned dark scene. As the user scrolls, a giant dollar number scrubs from
// $0.00 → $5,832.40 and the HH:MM:SS timer scrubs alongside it. Words fly in
// and stack. This is the "every minute counts" moment — dramatic contrast
// against the white page, then releases back to white.
export function PinnedCounter() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const moneyRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<HTMLDivElement | null>(null);
  const word1Ref = useRef<HTMLSpanElement | null>(null);
  const word2Ref = useRef<HTMLSpanElement | null>(null);
  const word3Ref = useRef<HTMLSpanElement | null>(null);
  const captionRef = useRef<HTMLParagraphElement | null>(null);
  const barsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    registerGsap();
    if (!rootRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const pinSpacerDistance = () => window.innerHeight * 2.2;

      if (reduced) {
        if (moneyRef.current) moneyRef.current.textContent = "$5,832.40";
        if (timerRef.current) timerRef.current.textContent = "72:54:30";
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: () => `+=${pinSpacerDistance()}`,
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // Word stack: each word lifts into place.
      tl.from(word1Ref.current, { yPercent: 120, opacity: 0, duration: 1, ease: "power3.out" }, 0)
        .from(word2Ref.current, { yPercent: 120, opacity: 0, duration: 1, ease: "power3.out" }, 0.3)
        .from(word3Ref.current, { yPercent: 120, opacity: 0, duration: 1, ease: "power3.out" }, 0.6);

      // Scrub the money counter.
      const money = { v: 0 };
      tl.to(
        money,
        {
          v: 5832.4,
          duration: 3,
          ease: "power1.inOut",
          onUpdate: () => {
            if (moneyRef.current) {
              moneyRef.current.textContent = `$${money.v
                .toFixed(2)
                .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
            }
          },
        },
        0.2
      );

      // Scrub the timer.
      const t = { s: 0 };
      tl.to(
        t,
        {
          s: 262470,
          duration: 3,
          ease: "power1.inOut",
          onUpdate: () => {
            if (timerRef.current) {
              const sec = Math.floor(t.s);
              const h = Math.floor(sec / 3600);
              const m = Math.floor((sec % 3600) / 60);
              const ss = sec % 60;
              timerRef.current.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
            }
          },
        },
        0.2
      );

      // Histogram bars grow.
      if (barsRef.current) {
        const bars = barsRef.current.querySelectorAll<HTMLDivElement>("[data-bar]");
        tl.from(
          bars,
          {
            scaleY: 0,
            transformOrigin: "bottom",
            duration: 2.2,
            ease: "power2.out",
            stagger: { each: 0.04, from: "start" },
          },
          0.4
        );
      }

      tl.from(
        captionRef.current,
        { y: 20, opacity: 0, duration: 1, ease: "power3.out" },
        1.6
      );

      ScrollTrigger.refresh();
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative bg-[#0A0A0B] text-white overflow-hidden"
      style={{ height: "100vh" }}
    >
      {/* Subtle grid over the dark pane. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage:
            "radial-gradient(ellipse 90% 70% at 50% 50%, black 40%, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 70% at 50% 50%, black 40%, transparent 85%)",
        }}
      />

      <div className="relative max-w-[1400px] mx-auto h-full flex flex-col justify-center items-center px-6 md:px-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[12px] font-semibold tracking-widest uppercase mb-10">
          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] pulse-dot" />
          Live · this month
        </div>

        <div className="font-[family-name:var(--font-display)] text-[44px] md:text-[84px] font-bold leading-[0.95] tracking-[-0.03em] max-w-[900px]">
          <span className="flex flex-wrap justify-center gap-x-4 overflow-hidden">
            <span className="overflow-hidden">
              <span ref={word1Ref} className="inline-block">Every</span>
            </span>
            <span className="overflow-hidden">
              <span ref={word2Ref} className="inline-block">minute</span>
            </span>
            <span className="overflow-hidden">
              <span ref={word3Ref} className="inline-block text-white/60">counts.</span>
            </span>
          </span>
        </div>

        <div
          ref={moneyRef}
          className="mt-10 font-[family-name:var(--font-display)] tabular-nums font-black tracking-[-0.04em] leading-none text-[18vw] md:text-[14vw] bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent"
        >
          $0.00
        </div>

        <div className="mt-6 flex items-center gap-6 text-white/70">
          <div
            ref={timerRef}
            className="font-[family-name:var(--font-display)] tabular-nums text-[24px] md:text-[32px] font-semibold tracking-tight"
          >
            00:00:00
          </div>
          <span className="h-6 w-px bg-white/15" />
          <div className="text-[13px] md:text-[14px] uppercase tracking-[0.24em] font-semibold">
            Tracked · Billed · Paid
          </div>
        </div>

        {/* Bars */}
        <div
          ref={barsRef}
          className="mt-12 flex items-end justify-center gap-1.5 md:gap-2 h-24 md:h-32 w-full max-w-[720px]"
        >
          {[28, 45, 22, 62, 80, 50, 38, 70, 90, 48, 55, 72, 34, 58, 82, 40, 65, 92, 44, 70].map(
            (h, i) => (
              <div
                key={i}
                data-bar
                className="flex-1 rounded-sm bg-white/80"
                style={{ height: `${h}%` }}
              />
            )
          )}
        </div>

        <p
          ref={captionRef}
          className="mt-10 text-[14px] md:text-[15px] text-white/50 max-w-[560px] leading-relaxed"
        >
          Your rate × your time, reconciled in real time. Hit stop, hit invoice,
          get paid. No spreadsheet, no stopwatch, no math.
        </p>
      </div>
    </section>
  );
}

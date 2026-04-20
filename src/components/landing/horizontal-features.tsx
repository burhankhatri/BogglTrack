"use client";

import { useEffect, useRef } from "react";
import {
  Clock,
  DollarSign,
  Calendar,
  FileText,
  Keyboard,
  Cloud,
  type LucideIcon,
} from "lucide-react";
import { registerGsap, gsap, ScrollTrigger } from "./gsap-register";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  kbd?: string;
  demo: "timer" | "money" | "calendar" | "invoice" | "keys" | "sync";
}

const FEATURES: Feature[] = [
  {
    icon: Clock,
    title: "One-click timer",
    body: "Start tracking from anywhere — web, Mac app, or a global hotkey.",
    kbd: "⌘T",
    demo: "timer",
  },
  {
    icon: DollarSign,
    title: "Real-time earnings",
    body: "Hourly rates per project or per client. Dollars tick up as the clock runs.",
    demo: "money",
  },
  {
    icon: Calendar,
    title: "Calendar of truth",
    body: "See every entry laid out by day. Edit, reassign, resume — one click.",
    demo: "calendar",
  },
  {
    icon: FileText,
    title: "Instant invoices",
    body: "Pick a date range, review the auto-generated line items, send a polished PDF.",
    demo: "invoice",
  },
  {
    icon: Keyboard,
    title: "Keyboard-first",
    body: "⌘T starts, ⌘1–4 navigates, ⌘⇧T fires even when the app isn't focused.",
    demo: "keys",
  },
  {
    icon: Cloud,
    title: "Synced everywhere",
    body: "Sign in once — your data is there on every Mac, every browser, every phone.",
    demo: "sync",
  },
];

export function HorizontalFeatures() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    registerGsap();
    if (!rootRef.current || !trackRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (reduced) return;

      const track = trackRef.current!;
      const totalScroll = () => track.scrollWidth - window.innerWidth + 64;

      gsap.to(track, {
        x: () => -totalScroll(),
        ease: "none",
        scrollTrigger: {
          trigger: rootRef.current,
          pin: true,
          scrub: 0.8,
          start: "top top",
          end: () => `+=${totalScroll() + 200}`,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });

      if (titleRef.current) {
        gsap.fromTo(
          titleRef.current,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: titleRef.current,
              start: "top 90%",
              toggleActions: "play none none none",
            },
            onComplete: () => gsap.set(titleRef.current, { clearProps: "transform,opacity" }),
          }
        );
      }

      ScrollTrigger.refresh();
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={rootRef} className="relative bg-[var(--bg-sage)] overflow-hidden">
      {/* Sticky title band that stays while cards pan. */}
      <div className="absolute top-0 left-0 right-0 z-10 px-6 md:px-10 pt-14 md:pt-20 pointer-events-none">
        <div className="max-w-[1400px] mx-auto flex items-end justify-between gap-8">
          <h2
            ref={titleRef}
            className="font-[family-name:var(--font-display)] text-[42px] md:text-[76px] font-bold tracking-[-0.03em] leading-[0.95] text-[var(--text-forest)] max-w-[760px]"
          >
            Six things.
            <br />
            <span className="text-[var(--text-olive)]">Done perfectly.</span>
          </h2>
          <div className="hidden md:flex items-center gap-3 text-[12px] font-bold uppercase tracking-[0.28em] text-[var(--text-olive)]">
            <span className="h-px w-10 bg-[var(--text-olive)]" />
            Scroll →
          </div>
        </div>
      </div>

      <div className="h-screen flex items-center pt-40 md:pt-52 pb-20">
        <div
          ref={trackRef}
          className="flex gap-5 md:gap-8 pl-6 md:pl-16 pr-[40vw] will-change-transform"
        >
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    registerGsap();
    if (!cardRef.current) return;
    const ctx = gsap.context(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;
      const el = cardRef.current!;
      const rx = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3" });
      const ry = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3" });
      const onMove = (e: MouseEvent) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        ry(dx * 8);
        rx(-dy * 8);
      };
      const leave = () => {
        rx(0);
        ry(0);
      };
      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", leave);
      return () => {
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseleave", leave);
      };
    }, cardRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={cardRef}
      className="shrink-0 w-[78vw] sm:w-[60vw] md:w-[520px] h-[460px] md:h-[520px] rounded-[20px] bg-[var(--bg-cream)] shadow-[var(--shadow-dropdown)] border border-[var(--border-subtle)] p-8 md:p-10 flex flex-col justify-between [transform-style:preserve-3d] will-change-transform"
    >
      <div>
        <div className="flex items-center justify-between">
          <div className="h-12 w-12 rounded-[10px] bg-[var(--bg-muted)] flex items-center justify-center">
            <Icon className="h-5 w-5 text-[var(--text-forest)]" strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-olive)] tabular-nums">
            {String(index + 1).padStart(2, "0")} / 06
          </span>
        </div>

        <h3 className="mt-8 font-[family-name:var(--font-display)] text-[32px] md:text-[40px] font-semibold tracking-[-0.02em] leading-[1.05] text-[var(--text-forest)]">
          {feature.title}
        </h3>

        <p className="mt-4 text-[16px] md:text-[17px] text-[var(--text-olive)] leading-[1.55] max-w-[420px]">
          {feature.body}
        </p>
      </div>

      <FeatureDemo demo={feature.demo} kbd={feature.kbd} />
    </div>
  );
}

function FeatureDemo({ demo, kbd }: { demo: Feature["demo"]; kbd?: string }) {
  if (demo === "timer") {
    return (
      <div className="mt-8 rounded-[14px] bg-[var(--bg-muted)] p-5 border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-olive)] pulse-dot" />
            <span className="text-[13px] font-medium text-[var(--text-olive)]">
              Client work · BrandCo
            </span>
          </div>
          <span className="tabular-nums font-semibold text-[var(--text-forest)] text-[15px]">
            01:42:09
          </span>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-[var(--bg-cream)] overflow-hidden">
          <div className="h-full w-[62%] bg-[var(--text-forest)]" />
        </div>
        {kbd && (
          <div className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-olive)]">
            <kbd className="inline-flex items-center h-6 px-2 rounded-md bg-[var(--bg-cream)] shadow-[var(--shadow-card)] text-[12px] font-semibold text-[var(--text-forest)] tabular-nums border border-[var(--border-subtle)]">
              {kbd}
            </kbd>
            starts the timer
          </div>
        )}
      </div>
    );
  }

  if (demo === "money") {
    return (
      <div className="mt-8 rounded-[14px] bg-[var(--bg-muted)] p-5 border border-[var(--border-subtle)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-olive)]">
          This session
        </p>
        <p className="mt-2 font-[family-name:var(--font-display)] tabular-nums text-[40px] font-bold tracking-tight text-[var(--text-forest)]">
          $137.28
        </p>
        <div className="mt-3 flex items-center gap-3 text-[12px] font-medium text-[var(--text-olive)]">
          <span className="text-[var(--accent-olive)] font-semibold">+$0.04</span>
          <span>/ sec · rate $80/hr</span>
        </div>
      </div>
    );
  }

  if (demo === "calendar") {
    return (
      <div className="mt-8 rounded-[14px] bg-[var(--bg-muted)] p-4 border border-[var(--border-subtle)]">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => {
            const filled = [3, 4, 5, 9, 10, 11, 12, 16, 17, 18, 23, 24, 25, 30, 31].includes(i);
            const heavy = [10, 17, 24].includes(i);
            return (
              <div
                key={i}
                className={`aspect-square rounded-[6px] ${
                  filled
                    ? heavy
                      ? "bg-[var(--text-forest)]"
                      : "bg-[var(--text-forest)]/50"
                    : "bg-[var(--bg-muted)] border border-[var(--border-subtle)]"
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (demo === "invoice") {
    return (
      <div className="mt-8 rounded-[14px] bg-[var(--bg-muted)] p-5 border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-olive)]">
            INV-2026-042
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent-olive)]">
            Paid
          </span>
        </div>
        {[
          { t: "Design system v2", h: "12.5h", a: "$1,000" },
          { t: "Onboarding flow", h: "8.0h", a: "$640" },
          { t: "Bug fixes", h: "3.2h", a: "$256" },
        ].map((r) => (
          <div
            key={r.t}
            className="flex items-center justify-between py-2 text-[13px] text-[var(--text-forest)]"
          >
            <span className="truncate">{r.t}</span>
            <div className="flex items-center gap-4 text-[var(--text-olive)] tabular-nums">
              <span>{r.h}</span>
              <span className="text-[var(--text-forest)] font-semibold">{r.a}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (demo === "keys") {
    return (
      <div className="mt-8 rounded-[14px] bg-[var(--bg-muted)] p-5 border border-[var(--border-subtle)]">
        <div className="grid grid-cols-4 gap-2">
          {[
            ["⌘T", "Start"],
            ["⌘1", "Timer"],
            ["⌘2", "Cal"],
            ["⌘3", "Proj"],
            ["⌘4", "Inv"],
            ["⌘K", "Cmd"],
            ["⌘⇧T", "Global"],
            ["⌘Q", "Quit"],
          ].map(([k, l]) => (
            <div
              key={k}
              className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg bg-[var(--bg-cream)] shadow-[var(--shadow-card)] border border-[var(--border-subtle)]"
            >
              <span className="tabular-nums text-[13px] font-bold text-[var(--text-forest)]">
                {k}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-olive)]">
                {l}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // sync
  return (
    <div className="mt-8 rounded-[14px] bg-[var(--bg-muted)] p-5 border border-[var(--border-subtle)] relative overflow-hidden">
      <div className="flex items-center justify-around">
        {["Web", "macOS", "iPhone"].map((d) => (
          <div key={d} className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-[var(--bg-cream)] shadow-[var(--shadow-card)] border border-[var(--border-subtle)] flex items-center justify-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-forest)]">
                {d[0]}
              </span>
            </div>
            <span className="text-[11px] font-medium text-[var(--text-olive)]">{d}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 h-px bg-gradient-to-r from-transparent via-[var(--text-forest)] to-transparent opacity-30" />
      <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-olive)]">
        One account · Everywhere
      </p>
    </div>
  );
}

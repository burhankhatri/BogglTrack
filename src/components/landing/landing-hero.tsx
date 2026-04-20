"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Apple, Globe } from "lucide-react";
import { registerGsap, gsap } from "./gsap-register";

interface Props {
  webAppHref: string;
  webAppLabel: string;
  dmgUrl: string;
  dmgIntelUrl: string;
}

const HEADLINE_WORDS = ["Every", "minute", "billed.", "Every", "dollar", "tracked."];

// Hero. Entrance is driven by pure CSS so it plays on first paint without
// GSAP's ticker. GSAP drives the ghost earnings number, mouse parallax on
// the dot grid + ghost, magnetic CTA buttons, and the infinite ruler.
export function LandingHero({ webAppHref, webAppLabel, dmgUrl, dmgIntelUrl }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const ticksRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    registerGsap();
    if (!rootRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tweens: gsap.core.Tween[] = [];
    const cleanup: Array<() => void> = [];

    // Ghost earnings number ticking up forever behind the headline.
    if (ghostRef.current) {
      const state = { v: 1247.38 };
      const t = gsap.to(state, {
        v: "+=999999",
        duration: 9999,
        ease: "none",
        onUpdate: () => {
          if (ghostRef.current) {
            ghostRef.current.textContent = `$${state.v.toFixed(2)}`;
          }
        },
      });
      tweens.push(t);
    }

    // Infinite ruler.
    if (ticksRef.current && !reduced) {
      const t = gsap.to(ticksRef.current, {
        xPercent: -50,
        duration: 40,
        ease: "none",
        repeat: -1,
      });
      tweens.push(t);
    }

    // Mouse parallax + magnetic CTAs.
    if (!reduced) {
      const qxGrid = gridRef.current ? gsap.quickTo(gridRef.current, "x", { duration: 0.9, ease: "power3" }) : null;
      const qyGrid = gridRef.current ? gsap.quickTo(gridRef.current, "y", { duration: 0.9, ease: "power3" }) : null;
      const qxGhost = ghostRef.current ? gsap.quickTo(ghostRef.current, "x", { duration: 1.2, ease: "power3" }) : null;
      const qyGhost = ghostRef.current ? gsap.quickTo(ghostRef.current, "y", { duration: 1.2, ease: "power3" }) : null;
      const onMove = (e: MouseEvent) => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = (e.clientX - cx) / cx;
        const dy = (e.clientY - cy) / cy;
        qxGrid?.(dx * 20);
        qyGrid?.(dy * 20);
        qxGhost?.(dx * -36);
        qyGhost?.(dy * -20);
      };
      window.addEventListener("mousemove", onMove, { passive: true });
      cleanup.push(() => window.removeEventListener("mousemove", onMove));

      const magnets = ctaRef.current?.querySelectorAll<HTMLElement>("[data-magnet]") ?? [];
      magnets.forEach((el) => {
        const qx = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
        const qy = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });
        const enter = (e: MouseEvent) => {
          const r = el.getBoundingClientRect();
          qx((e.clientX - (r.left + r.width / 2)) * 0.25);
          qy((e.clientY - (r.top + r.height / 2)) * 0.35);
        };
        const leave = () => {
          qx(0);
          qy(0);
        };
        el.addEventListener("mousemove", enter);
        el.addEventListener("mouseleave", leave);
        cleanup.push(() => {
          el.removeEventListener("mousemove", enter);
          el.removeEventListener("mouseleave", leave);
        });
      });
    }

    return () => {
      tweens.forEach((t) => t.kill());
      cleanup.forEach((fn) => fn());
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative overflow-hidden pt-24 md:pt-32 pb-32"
    >
      <div
        ref={gridRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(136,136,136,0.25) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 70% 55% at 50% 40%, black 35%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 55% at 50% 40%, black 35%, transparent 80%)",
        }}
      />

      <div
        ref={ghostRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 select-none
                   font-[family-name:var(--font-display)] tabular-nums tracking-tighter
                   text-[22vw] md:text-[18vw] leading-[0.9] font-black
                   text-transparent"
        style={{
          WebkitTextStroke: "1px var(--border-medium)",
        }}
      >
        $1,247.38
      </div>

      <div className="relative max-w-[1200px] mx-auto px-6 md:px-8 text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-cream)] shadow-[var(--shadow-card)] text-[12px] font-semibold text-[var(--text-forest)] mb-10 land-fade"
          style={{ animationDelay: "0ms" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-olive)] pulse-dot" />
          <span className="tabular-nums">Tracking live on macOS</span>
        </div>

        <h1 className="relative font-[family-name:var(--font-display)] text-[52px] md:text-[92px] font-bold tracking-[-0.03em] leading-[0.98] max-w-[1050px] mx-auto text-[var(--text-forest)]">
          <span className="land-line">
            {HEADLINE_WORDS.slice(0, 3).map((w, i) => (
              <span
                key={`l1-${i}`}
                className="land-word"
                style={{ animationDelay: `${120 + i * 60}ms` }}
              >
                {w}
                {i < 2 && "\u00A0"}
              </span>
            ))}
          </span>
          <span className="land-line">
            {HEADLINE_WORDS.slice(3).map((w, i) => (
              <span
                key={`l2-${i}`}
                className="land-word"
                style={{ animationDelay: `${320 + i * 60}ms` }}
              >
                {w}
                {i < 2 && "\u00A0"}
              </span>
            ))}
          </span>
        </h1>

        <p
          className="relative mt-10 text-[18px] md:text-[20px] font-normal text-[var(--text-olive)] max-w-[620px] mx-auto leading-[1.55] land-fade"
          style={{ animationDelay: "600ms" }}
        >
          BogglTrack is the time tracker freelancers actually open every day.
          Live earnings. Instant invoices. Native on Mac, live on the web.
        </p>

        <div
          ref={ctaRef}
          className="relative mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href={webAppHref}
            data-magnet
            className="land-fade group inline-flex items-center justify-center gap-2.5 h-12 px-8 rounded-md bg-[var(--text-forest)] text-[var(--text-cream)] text-[16px] font-semibold hover:opacity-90 transition-opacity shadow-[inset_0_2px_0_rgba(255,255,255,0.15)] w-full sm:w-auto"
            style={{ animationDelay: "800ms" }}
          >
            <Globe className="h-5 w-5" />
            {webAppLabel}
          </Link>
          <a
            href={dmgUrl}
            data-magnet
            className="land-fade relative inline-flex items-center justify-center gap-2.5 h-12 px-8 rounded-md bg-[var(--bg-cream)] text-[var(--text-forest)] text-[16px] font-semibold hover:bg-[var(--bg-cream-hover)] transition-colors shadow-[var(--shadow-card)] border border-[var(--border-subtle)] w-full sm:w-auto"
            style={{ animationDelay: "880ms" }}
            download
          >
            <Apple className="h-5 w-5" />
            Download for Mac
            <span className="absolute -top-3 -right-3 inline-flex items-center justify-center px-2 py-1 rounded-full bg-[var(--bg-muted)] text-[var(--text-forest)] text-[10px] font-bold uppercase tracking-wider shadow-sm border border-[var(--border-subtle)]">
              Beta
            </span>
          </a>
        </div>

        <p
          className="relative mt-6 text-[14px] text-[var(--text-olive)] font-medium land-fade"
          style={{ animationDelay: "1000ms" }}
        >
          Apple Silicon (M1 – M4) ·{" "}
          <a
            href={dmgIntelUrl}
            className="underline decoration-1 underline-offset-2 hover:text-[var(--text-forest)] transition-colors"
            download
          >
            Intel Mac
          </a>{" "}
          · Free, no credit card
        </p>
      </div>

      <div className="relative mt-24 overflow-hidden border-y border-[var(--border-subtle)] bg-[var(--bg-cream)]">
        <div ref={ticksRef} className="flex whitespace-nowrap py-4">
          {Array.from({ length: 2 }).map((_, dup) => (
            <div key={dup} className="flex shrink-0">
              {Array.from({ length: 60 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-end shrink-0 mr-[46px]"
                  aria-hidden="true"
                >
                  <div
                    className={`w-px ${i % 5 === 0 ? "h-5 bg-[var(--text-forest)]" : "h-2.5 bg-[var(--text-olive)] opacity-40"}`}
                  />
                  {i % 10 === 0 && (
                    <span className="ml-3 text-[11px] font-semibold tracking-widest uppercase text-[var(--text-olive)] tabular-nums">
                      {String(i).padStart(2, "0")}:00
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

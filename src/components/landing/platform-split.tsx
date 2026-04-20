"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  Apple,
  ArrowRight,
  CheckCircle2,
  Download,
  Globe,
} from "lucide-react";
import { registerGsap, gsap } from "./gsap-register";

interface Props {
  webAppHref: string;
  isSignedIn: boolean;
  dmgUrl: string;
}

// Two massive cards — web vs native Mac. Each card gets a subtle 3D tilt
// following the cursor, a parallax layer for its glyph, and a specular
// highlight that tracks the mouse for a glassy feel.
export function PlatformSplit({ webAppHref, isSignedIn, dmgUrl }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    registerGsap();
    if (!rootRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      const cards = rootRef.current!.querySelectorAll<HTMLElement>("[data-tilt]");
      const tilts: Array<() => void> = [];

      cards.forEach((card) => {
        const glyph = card.querySelector<HTMLElement>("[data-glyph]");
        const spec = card.querySelector<HTMLElement>("[data-spec]");
        const rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3" });
        const ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3" });
        const gx = glyph ? gsap.quickTo(glyph, "x", { duration: 0.8, ease: "power3" }) : null;
        const gy = glyph ? gsap.quickTo(glyph, "y", { duration: 0.8, ease: "power3" }) : null;

        const onMove = (e: MouseEvent) => {
          const r = card.getBoundingClientRect();
          const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
          const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
          ry(dx * 10);
          rx(-dy * 10);
          gx?.(dx * -24);
          gy?.(dy * -24);
          if (spec) {
            const lx = ((e.clientX - r.left) / r.width) * 100;
            const ly = ((e.clientY - r.top) / r.height) * 100;
            spec.style.background = `radial-gradient(circle at ${lx}% ${ly}%, rgba(255,255,255,0.18), transparent 45%)`;
          }
        };
        const leave = () => {
          rx(0);
          ry(0);
          gx?.(0);
          gy?.(0);
          if (spec) spec.style.background = "transparent";
        };
        card.addEventListener("mousemove", onMove);
        card.addEventListener("mouseleave", leave);
        tilts.push(() => {
          card.removeEventListener("mousemove", onMove);
          card.removeEventListener("mouseleave", leave);
        });
      });

      return () => tilts.forEach((fn) => fn());
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative bg-[var(--bg-sage)] py-28 md:py-40"
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="max-w-[720px] mb-16 md:mb-20">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--text-olive)]">
            Platforms
          </p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-[42px] md:text-[64px] font-bold tracking-[-0.03em] leading-[1.0] text-[var(--text-forest)]">
            Web when you need it.{" "}
            <span className="text-[var(--text-olive)]">
              Mac when you want it.
            </span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 [perspective:1200px]">
          {/* Web card */}
          <div
            data-tilt
            className="relative p-10 md:p-14 rounded-[20px] bg-[#0F0F11] shadow-[var(--shadow-dropdown)] flex flex-col justify-between border border-white/10 overflow-hidden [transform-style:preserve-3d] will-change-transform min-h-[520px]"
          >
            <div
              data-glyph
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -bottom-10 text-white/[0.06] font-[family-name:var(--font-display)] text-[320px] font-black leading-none select-none"
            >
              ∞
            </div>
            <div data-spec className="pointer-events-none absolute inset-0" />

            <div className="relative">
              <Globe className="h-10 w-10 mb-8 text-white" />
              <h3 className="font-[family-name:var(--font-display)] text-[36px] md:text-[44px] font-semibold tracking-[-0.02em] leading-[1.05] text-white">
                Browser ready.
              </h3>
              <p className="mt-4 text-[16px] text-white/70 leading-[1.55] max-w-[400px]">
                No install. No update. Sign in on any Mac, PC, Linux box, or
                phone — your timer and projects are right where you left them.
              </p>
              <ul className="mt-10 space-y-4 text-[15px] font-medium text-white">
                {[
                  "Zero install — modern browser support",
                  "Unified account across web + desktop",
                  "Fully responsive on phone and tablet",
                  "Perfect for shared or locked machines",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-white/70" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href={webAppHref}
              className="relative mt-12 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-white text-[#0F0F11] text-[16px] font-semibold hover:opacity-90 transition-opacity shadow-[var(--shadow-card)] w-max"
            >
              {isSignedIn ? "Open dashboard" : "Open in browser"}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          {/* Mac card */}
          <div
            data-tilt
            className="relative p-10 md:p-14 rounded-[20px] bg-[var(--bg-cream)] shadow-[var(--shadow-dropdown)] flex flex-col justify-between border border-[var(--border-subtle)] overflow-hidden [transform-style:preserve-3d] will-change-transform min-h-[520px]"
          >
            <div className="absolute top-6 right-6 inline-flex items-center justify-center px-3 py-1 rounded-full bg-[var(--bg-muted)] text-[var(--text-forest)] text-[11px] font-bold uppercase tracking-[0.24em] shadow-sm border border-[var(--border-subtle)]">
              Early Testing
            </div>
            <div
              data-glyph
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -bottom-10 text-[var(--text-forest)]/[0.06] font-[family-name:var(--font-display)] text-[320px] font-black leading-none select-none"
            >

            </div>
            <div data-spec className="pointer-events-none absolute inset-0" />

            <div className="relative">
              <Apple className="h-10 w-10 mb-8 text-[var(--text-forest)]" />
              <h3 className="font-[family-name:var(--font-display)] text-[36px] md:text-[44px] font-semibold tracking-[-0.02em] leading-[1.05] text-[var(--text-forest)]">
                Native Mac app.
              </h3>
              <p className="mt-4 text-[16px] text-[var(--text-olive)] leading-[1.55] max-w-[400px]">
                Lives in your Dock. Menu-bar timer. Global shortcuts. Feels
                like every other great Mac app on your machine.
              </p>
              <ul className="mt-10 space-y-4 text-[15px] font-medium text-[var(--text-forest)]">
                {[
                  "Menu bar widget — start/stop anywhere",
                  "Global ⌘⇧T hotkey integration",
                  "Native menu, notifications, dark mode",
                  "Dock badge shows active elapsed time",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-[var(--text-forest)]/70" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={dmgUrl}
              download
              className="relative mt-12 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-[var(--text-forest)] text-[var(--text-cream)] text-[16px] font-semibold hover:opacity-90 transition-opacity shadow-[inset_0_2px_0_rgba(255,255,255,0.15)] w-max"
            >
              <Download className="h-5 w-5" />
              Download DMG
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

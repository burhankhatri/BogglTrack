"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Apple, MonitorSmartphone } from "lucide-react";
import { registerGsap, gsap, SplitText } from "./gsap-register";

interface Props {
  webAppHref: string;
  webAppLabel: string;
  dmgUrl: string;
}

// Final CTA. Character-by-character reveal on scroll into view. CTAs are
// magnetic. A subtle ambient gradient follows the cursor.
export function FinalCTA({ webAppHref, webAppLabel, dmgUrl }: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const headlineRef = useRef<HTMLHeadingElement | null>(null);
  const gradRef = useRef<HTMLDivElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    registerGsap();
    if (!rootRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tweens: gsap.core.Tween[] = [];
    const splits: SplitText[] = [];
    const listeners: Array<() => void> = [];

    if (headlineRef.current && !reduced) {
      const split = new SplitText(headlineRef.current, {
        type: "chars,words",
        charsClass: "split-char inline-block",
        wordsClass: "split-word inline-block",
      });
      splits.push(split);
      const t = gsap.fromTo(
        split.chars,
        { yPercent: 110, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power4.out",
          stagger: { each: 0.012, from: "start" },
          scrollTrigger: {
            trigger: headlineRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
          onComplete: () => gsap.set(split.chars, { clearProps: "transform,opacity" }),
        }
      );
      tweens.push(t);
    }

    if (!reduced && rootRef.current && gradRef.current) {
      const root = rootRef.current;
      const qx = gsap.quickTo(gradRef.current, "x", { duration: 1.0, ease: "power3" });
      const qy = gsap.quickTo(gradRef.current, "y", { duration: 1.0, ease: "power3" });
      const onMove = (e: MouseEvent) => {
        const r = root.getBoundingClientRect();
        qx(e.clientX - r.left - 300);
        qy(e.clientY - r.top - 300);
      };
      root.addEventListener("mousemove", onMove);
      listeners.push(() => root.removeEventListener("mousemove", onMove));

      const magnets = ctaRef.current?.querySelectorAll<HTMLElement>("[data-magnet]") ?? [];
      magnets.forEach((el) => {
        const qxM = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
        const qyM = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });
        const enter = (e: MouseEvent) => {
          const r = el.getBoundingClientRect();
          qxM((e.clientX - (r.left + r.width / 2)) * 0.25);
          qyM((e.clientY - (r.top + r.height / 2)) * 0.35);
        };
        const leave = () => {
          qxM(0);
          qyM(0);
        };
        el.addEventListener("mousemove", enter);
        el.addEventListener("mouseleave", leave);
        listeners.push(() => {
          el.removeEventListener("mousemove", enter);
          el.removeEventListener("mouseleave", leave);
        });
      });
    }

    return () => {
      tweens.forEach((t) => {
        if (t.duration() < 100) t.progress(1);
        t.kill();
      });
      splits.forEach((s) => s.revert());
      listeners.forEach((fn) => fn());
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative bg-[var(--bg-sage)] py-32 md:py-48 overflow-hidden"
    >
      <div
        ref={gradRef}
        aria-hidden="true"
        className="pointer-events-none absolute h-[600px] w-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(36,36,36,0.08) 0%, rgba(36,36,36,0) 70%)",
          filter: "blur(30px)",
        }}
      />
      <div className="relative max-w-[1200px] mx-auto px-6 md:px-8 text-center">
        <h2
          ref={headlineRef}
          className="font-[family-name:var(--font-display)] text-[56px] md:text-[110px] font-bold tracking-[-0.04em] leading-[0.92] text-[var(--text-forest)] max-w-[1100px] mx-auto"
        >
          Start tracking in ten seconds.
        </h2>
        <p className="mt-10 text-[18px] md:text-[20px] text-[var(--text-olive)] max-w-[600px] mx-auto leading-[1.55]">
          Free, no credit card, no bloated onboarding. Open the app, hit ⌘T,
          get back to work.
        </p>

        <div
          ref={ctaRef}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href={webAppHref}
            data-magnet
            className="inline-flex items-center justify-center gap-2 h-14 px-10 rounded-md bg-[var(--text-forest)] text-[var(--text-cream)] text-[16px] font-semibold hover:opacity-90 transition-opacity shadow-[inset_0_2px_0_rgba(255,255,255,0.15)]"
          >
            <MonitorSmartphone className="h-5 w-5" />
            {webAppLabel}
          </Link>
          <a
            href={dmgUrl}
            data-magnet
            download
            className="relative inline-flex items-center justify-center gap-2 h-14 px-10 rounded-md bg-[var(--bg-cream)] text-[var(--text-forest)] text-[16px] font-semibold hover:bg-[var(--bg-cream-hover)] transition-colors shadow-[var(--shadow-card)] border border-[var(--border-subtle)]"
          >
            <Apple className="h-5 w-5" />
            Download for Mac
          </a>
        </div>
      </div>
    </section>
  );
}

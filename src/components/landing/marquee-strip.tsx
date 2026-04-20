"use client";

import { useEffect, useRef } from "react";
import { registerGsap, gsap } from "./gsap-register";

// Two infinite marquee lanes, opposing directions. Oversized display font,
// outlined/solid alternation to feel like a typographic centerpiece — not a
// decoration. Scroll speed ties to vertical scroll velocity via ScrollTrigger.
const TOKENS_A = [
  "Time",
  "Earnings",
  "Clients",
  "Invoices",
  "Projects",
  "Calendars",
  "Freelancers",
  "Agencies",
  "Studios",
  "Consultants",
];

const TOKENS_B = [
  "$187.43",
  "02:14:37",
  "Tracked",
  "Billed",
  "Paid",
  "Shipped",
  "Synced",
  "⌘T",
  "⌘⇧T",
  "∞",
];

export function MarqueeStrip() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const laneARef = useRef<HTMLDivElement | null>(null);
  const laneBRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    registerGsap();
    const ctx = gsap.context(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      if (laneARef.current) {
        gsap.to(laneARef.current, {
          xPercent: -50,
          duration: 45,
          ease: "none",
          repeat: -1,
        });
      }
      if (laneBRef.current) {
        gsap.fromTo(
          laneBRef.current,
          { xPercent: -50 },
          {
            xPercent: 0,
            duration: 55,
            ease: "none",
            repeat: -1,
          }
        );
      }
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const renderLane = (tokens: string[], outline = false) => (
    <div className="flex shrink-0">
      {tokens.map((t, i) => (
        <span
          key={`${t}-${i}`}
          className={`flex items-center mr-10 md:mr-16 font-[family-name:var(--font-display)] text-[14vw] md:text-[9vw] font-black tracking-[-0.04em] leading-none ${
            outline
              ? "text-transparent"
              : i % 3 === 1
                ? "text-[var(--text-olive)]"
                : "text-[var(--text-forest)]"
          }`}
          style={
            outline
              ? { WebkitTextStroke: "1.5px var(--text-forest)" }
              : undefined
          }
        >
          {t}
          <span className="ml-10 md:ml-16 inline-block align-middle">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <circle cx="7" cy="7" r="7" fill="currentColor" />
            </svg>
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <section
      ref={rootRef}
      aria-hidden="true"
      className="relative border-y border-[var(--border-subtle)] bg-[var(--bg-cream)] py-8 md:py-12 overflow-hidden"
    >
      <div className="overflow-hidden">
        <div ref={laneARef} className="flex whitespace-nowrap will-change-transform">
          {renderLane(TOKENS_A, false)}
          {renderLane(TOKENS_A, true)}
          {renderLane(TOKENS_A, false)}
          {renderLane(TOKENS_A, true)}
        </div>
      </div>
      <div className="overflow-hidden mt-2">
        <div
          ref={laneBRef}
          className="flex whitespace-nowrap will-change-transform text-[var(--text-olive)]"
        >
          {renderLane(TOKENS_B, true)}
          {renderLane(TOKENS_B, false)}
          {renderLane(TOKENS_B, true)}
          {renderLane(TOKENS_B, false)}
        </div>
      </div>
    </section>
  );
}

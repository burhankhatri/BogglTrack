"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useAppStore } from "@/stores/app-store";
import { BrandLogo } from "@/components/ui/brand-logo";

// Covers the app while the essentials (settings + projects) land, so the
// first post-login paint isn't an empty shell. Hides itself with a GSAP
// fade once data resolves, or after a short timeout so a slow backend
// never leaves the user stranded on the splash.
const MAX_WAIT_MS = 4000;

export function AppBoot({ children }: { children: React.ReactNode }) {
  const settingsData = useAppStore((s) => s.settings.data);
  const projectsData = useAppStore((s) => s.projects.data);
  const fetchSettings = useAppStore((s) => s.fetchSettings);
  const fetchProjects = useAppStore((s) => s.fetchProjects);

  // Decide ONCE on mount whether to show the loader. If the store already
  // has cached data (e.g. SPA navigation within the app), skip it entirely.
  const [showLoader, setShowLoader] = useState(
    () => !(settingsData && projectsData)
  );
  const [ready, setReady] = useState(!showLoader);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const logoRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLParagraphElement | null>(null);
  const dotsRef = useRef<HTMLDivElement | null>(null);

  // Kick off the essentials the moment the layout mounts so they race
  // alongside (not after) React's hydration.
  useEffect(() => {
    if (!showLoader) return;
    fetchSettings().catch(() => {});
    fetchProjects().catch(() => {});
  }, [showLoader, fetchSettings, fetchProjects]);

  // Mark ready when both arrive — or when the timeout fires, so a broken
  // backend doesn't trap the user on the splash forever.
  useEffect(() => {
    if (!showLoader || ready) return;
    if (settingsData && projectsData) {
      setReady(true);
      return;
    }
    const t = window.setTimeout(() => setReady(true), MAX_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [showLoader, ready, settingsData, projectsData]);

  // GSAP entrance — logo drops in, label slides up, dots cascade.
  useEffect(() => {
    if (!showLoader) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const tl = gsap.timeline();
    if (logoRef.current) {
      tl.fromTo(
        logoRef.current,
        { opacity: 0, scale: 0.8, y: -8 },
        { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "back.out(1.5)" }
      );
    }
    if (labelRef.current) {
      tl.fromTo(
        labelRef.current,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
        "-=0.15"
      );
    }
    if (dotsRef.current) {
      tl.fromTo(
        dotsRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: "none" },
        "-=0.1"
      );
    }
    return () => {
      tl.kill();
    };
  }, [showLoader]);

  // GSAP exit — quick fade + lift. Once done, unmount the loader so it
  // leaves no hit-blocking overlay or paint cost behind.
  useEffect(() => {
    if (!ready || !loaderRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShowLoader(false);
      return;
    }
    const tween = gsap.to(loaderRef.current, {
      opacity: 0,
      scale: 1.02,
      duration: 0.35,
      ease: "power2.out",
      onComplete: () => setShowLoader(false),
    });
    return () => {
      tween.kill();
    };
  }, [ready]);

  return (
    <>
      {children}
      {showLoader && (
        <div
          ref={loaderRef}
          className="fixed inset-0 z-[100] bg-[var(--bg-sage)] flex flex-col items-center justify-center"
          aria-busy="true"
          aria-live="polite"
        >
          <div ref={logoRef}>
            <BrandLogo size={56} />
          </div>
          <p
            ref={labelRef}
            className="mt-5 font-serif text-[18px] text-[var(--text-forest)] tracking-tight"
          >
            Loading your time
          </p>
          <div ref={dotsRef} className="mt-4 flex items-center gap-1.5">
            <span className="boot-dot block h-1.5 w-1.5 rounded-full bg-[var(--accent-olive)]" />
            <span className="boot-dot boot-dot-2 block h-1.5 w-1.5 rounded-full bg-[var(--accent-olive)]" />
            <span className="boot-dot boot-dot-3 block h-1.5 w-1.5 rounded-full bg-[var(--accent-olive)]" />
          </div>
        </div>
      )}
    </>
  );
}

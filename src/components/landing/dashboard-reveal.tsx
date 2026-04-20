"use client";

import { useEffect, useRef, useState } from "react";
import { registerGsap, gsap, ScrollTrigger } from "./gsap-register";

type NavId = "dashboard" | "timer" | "calendar" | "projects" | "clients" | "invoices";

const NAV: { id: NavId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "timer", label: "Timer" },
  { id: "calendar", label: "Calendar" },
  { id: "projects", label: "Projects" },
  { id: "clients", label: "Clients" },
  { id: "invoices", label: "Invoices" },
];

const NOTIFICATIONS = [
  { title: "Invoice paid", meta: "BrandCo · $1,488.00", tone: "paid" as const },
  { title: "Timer started", meta: "Client work · ⌘T", tone: "info" as const },
  { title: "Milestone hit", meta: "Design system v2 · 100%", tone: "info" as const },
  { title: "New payment", meta: "Acme Inc · $640.00", tone: "paid" as const },
  { title: "Rate updated", meta: "AcmeCo · $95/hr", tone: "info" as const },
];

// A dashboard that tours itself. A faux pointer drives the product through
// every view — Dashboard → Timer → Calendar → Projects → Clients → Invoices
// — the main panel blur-crossfades between those views, an active-nav
// highlight tracks the tour, notifications slide in, $ particles drift up
// whenever the timer ticks, confetti fires when a paid notification lands,
// and the whole surface tilts/parallaxes under the visitor's cursor.
export function DashboardReveal() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const timerRef = useRef<HTMLSpanElement | null>(null);
  const earnRef = useRef<HTMLSpanElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const noteRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<HTMLDivElement | null>(null);
  const confettiRef = useRef<HTMLDivElement | null>(null);
  const sidebarLayerRef = useRef<HTMLDivElement | null>(null);
  const panelLayerRef = useRef<HTMLDivElement | null>(null);

  const [active, setActive] = useState<NavId>("dashboard");
  const [noteIdx, setNoteIdx] = useState(0);
  const [noteVisible, setNoteVisible] = useState(false);

  useEffect(() => {
    registerGsap();
    if (!rootRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tweens: gsap.core.Tween[] = [];
    const timelines: gsap.core.Timeline[] = [];
    const triggers: ScrollTrigger[] = [];
    const listeners: Array<() => void> = [];

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
          { scaleY: 1, transformOrigin: "bottom", duration: 0.8, stagger: 0.03 },
          "-=0.4"
        )
        .fromTo(
          card.querySelectorAll("[data-pill]"),
          { scale: 0.6, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" },
          "-=0.5"
        );
    }

    // Live timer / earnings + $ particle emission whenever the earnings tick.
    const tick = { s: 8077, d: 187.43 };
    let lastWhole = Math.floor(tick.d);
    const emitMoneyParticle = () => {
      if (!particlesRef.current || !pillRef.current || !surfaceRef.current) return;
      const sr = surfaceRef.current.getBoundingClientRect();
      const pr = pillRef.current.getBoundingClientRect();
      const startX = pr.left - sr.left + pr.width / 2 + (Math.random() - 0.5) * 60;
      const startY = pr.top - sr.top + pr.height / 2;
      const dot = document.createElement("span");
      dot.textContent = "$";
      dot.className =
        "pointer-events-none absolute select-none font-[family-name:var(--font-display)] font-bold text-[var(--accent-olive)]";
      dot.style.left = "0";
      dot.style.top = "0";
      dot.style.fontSize = `${12 + Math.random() * 8}px`;
      dot.style.transform = `translate3d(${startX}px, ${startY}px, 0)`;
      particlesRef.current.appendChild(dot);
      gsap.to(dot, {
        y: `-=${90 + Math.random() * 60}`,
        x: `+=${(Math.random() - 0.5) * 80}`,
        opacity: 0,
        rotate: (Math.random() - 0.5) * 40,
        duration: 1.6 + Math.random() * 0.8,
        ease: "power2.out",
        onComplete: () => dot.remove(),
      });
    };

    const liveTl = gsap.to(tick, {
      s: "+=3600",
      d: "+=80",
      duration: 3600,
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
          const whole = Math.floor(tick.d);
          if (whole !== lastWhole) {
            lastWhole = whole;
            if (!reduced) emitMoneyParticle();
          }
        }
      },
    });
    tweens.push(liveTl);

    if (cardRef.current) {
      const st = ScrollTrigger.create({
        trigger: cardRef.current,
        start: "top 85%",
        end: "bottom 15%",
        onEnter: () => liveTl.play(),
        onEnterBack: () => liveTl.play(),
        onLeave: () => liveTl.pause(),
        onLeaveBack: () => liveTl.pause(),
      });
      triggers.push(st);
    }

    // 3D tilt + depth parallax. Sidebar, panel, and chart sit at different
    // translateZ values so they separate in space when the visitor tilts.
    if (cardRef.current && surfaceRef.current && !reduced) {
      const card = cardRef.current;
      const surface = surfaceRef.current;
      const rx = gsap.quickTo(surface, "rotationX", { duration: 0.6, ease: "power3" });
      const ry = gsap.quickTo(surface, "rotationY", { duration: 0.6, ease: "power3" });
      const sideX = sidebarLayerRef.current
        ? gsap.quickTo(sidebarLayerRef.current, "x", { duration: 0.8, ease: "power3" })
        : null;
      const panelX = panelLayerRef.current
        ? gsap.quickTo(panelLayerRef.current, "x", { duration: 0.8, ease: "power3" })
        : null;

      const onMove = (e: MouseEvent) => {
        const r = card.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        ry(dx * 6);
        rx(-dy * 4);
        sideX?.(dx * -10);
        panelX?.(dx * 6);
      };
      const leave = () => {
        rx(0);
        ry(0);
        sideX?.(0);
        panelX?.(0);
      };
      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", leave);
      listeners.push(() => {
        card.removeEventListener("mousemove", onMove);
        card.removeEventListener("mouseleave", leave);
      });
    }

    // Auto-piloting cursor tour.
    if (surfaceRef.current && cursorRef.current && ringRef.current && !reduced) {
      const surface = surfaceRef.current;
      const cursor = cursorRef.current;
      const ring = ringRef.current;

      const moveToTarget = (selector: string, dwell = 1.2): gsap.core.Timeline => {
        const seg = gsap.timeline();
        seg.call(() => {
          const target = surface.querySelector<HTMLElement>(selector);
          if (!target) return;
          const sr = surface.getBoundingClientRect();
          const tr = target.getBoundingClientRect();
          const x = tr.left - sr.left + tr.width / 2;
          const y = tr.top - sr.top + tr.height / 2;
          gsap.to(cursor, { x, y, duration: 0.9, ease: "power3.inOut" });
          gsap.to(ring, {
            x,
            y,
            width: tr.width + 12,
            height: tr.height + 12,
            duration: 0.8,
            ease: "power3.inOut",
            opacity: 0.9,
          });
        });
        seg.to({}, { duration: 0.9 });
        seg.to(cursor, { scale: 0.78, duration: 0.12, ease: "power2.out" });
        seg.to(cursor, { scale: 1, duration: 0.18, ease: "back.out(3)" });
        seg.to({}, { duration: dwell });
        return seg;
      };

      const setNav = (id: NavId) => gsap.to({}, { duration: 0, onComplete: () => setActive(id) });

      const showNotification = (i: number) =>
        gsap.to({}, {
          duration: 0,
          onComplete: () => {
            setNoteIdx(i);
            setNoteVisible(true);
            if (NOTIFICATIONS[i].tone === "paid") burstConfetti();
          },
        });
      const hideNotification = () => gsap.to({}, { duration: 0, onComplete: () => setNoveVisibleFalse() });
      const setNoveVisibleFalse = () => setNoteVisible(false);

      const burstConfetti = () => {
        if (!confettiRef.current || !surfaceRef.current || !noteRef.current) return;
        const sr = surfaceRef.current.getBoundingClientRect();
        const nr = noteRef.current.getBoundingClientRect();
        const ox = nr.left - sr.left + nr.width / 2;
        const oy = nr.top - sr.top + nr.height / 2;
        const colors = ["#10B981", "#34D399", "#FBBF24", "#F87171", "#60A5FA", "#FFFFFF"];
        for (let i = 0; i < 22; i++) {
          const p = document.createElement("span");
          const size = 4 + Math.random() * 6;
          p.className = "pointer-events-none absolute rounded-[2px]";
          p.style.left = "0";
          p.style.top = "0";
          p.style.width = `${size}px`;
          p.style.height = `${size * (0.4 + Math.random() * 0.8)}px`;
          p.style.background = colors[i % colors.length];
          p.style.transform = `translate3d(${ox}px, ${oy}px, 0)`;
          confettiRef.current.appendChild(p);
          const angle = Math.random() * Math.PI * 2;
          const dist = 120 + Math.random() * 140;
          gsap.to(p, {
            x: `+=${Math.cos(angle) * dist}`,
            y: `+=${Math.sin(angle) * dist - 30}`,
            rotate: Math.random() * 540 - 270,
            opacity: 0,
            duration: 1.0 + Math.random() * 0.8,
            ease: "power2.out",
            onComplete: () => p.remove(),
          });
        }
      };

      const masterTl = gsap.timeline({ repeat: -1, paused: true });

      masterTl
        .add(setNav("dashboard"))
        .add(moveToTarget('[data-ct="nav-dashboard"]', 1.0))
        .add(setNav("timer"))
        .add(moveToTarget('[data-ct="nav-timer"]', 1.0))
        .add(moveToTarget('[data-ct="view-focus-primary"]', 1.2))
        .add(showNotification(1))
        .to({}, { duration: 0.6 })
        .add(hideNotification())
        .add(setNav("calendar"))
        .add(moveToTarget('[data-ct="nav-calendar"]', 1.0))
        .add(moveToTarget('[data-ct="view-focus-primary"]', 1.4))
        .add(setNav("projects"))
        .add(moveToTarget('[data-ct="nav-projects"]', 1.0))
        .add(moveToTarget('[data-ct="view-focus-primary"]', 1.2))
        .add(showNotification(2))
        .to({}, { duration: 0.6 })
        .add(hideNotification())
        .add(setNav("clients"))
        .add(moveToTarget('[data-ct="nav-clients"]', 1.0))
        .add(moveToTarget('[data-ct="view-focus-primary"]', 1.2))
        .add(setNav("invoices"))
        .add(moveToTarget('[data-ct="nav-invoices"]', 1.0))
        .add(moveToTarget('[data-ct="view-focus-primary"]', 1.2))
        .add(showNotification(0))
        .to({}, { duration: 0.8 })
        .add(hideNotification())
        .add(setNav("dashboard"))
        .add(moveToTarget('[data-ct="nav-dashboard"]', 0.6))
        .add(moveToTarget('[data-ct="timer-pill"]', 1.2));

      timelines.push(masterTl);

      if (cardRef.current) {
        const st = ScrollTrigger.create({
          trigger: cardRef.current,
          start: "top 85%",
          end: "bottom 15%",
          onEnter: () => masterTl.play(),
          onEnterBack: () => masterTl.play(),
          onLeave: () => masterTl.pause(),
          onLeaveBack: () => masterTl.pause(),
        });
        triggers.push(st);
      }

      const card = cardRef.current!;
      const onEnter = () => {
        masterTl.pause();
        gsap.to(cursor, { opacity: 0, duration: 0.25 });
        gsap.to(ring, { opacity: 0, duration: 0.25 });
      };
      const onLeave = () => {
        gsap.to(cursor, { opacity: 1, duration: 0.25 });
        gsap.to(ring, { opacity: 0.9, duration: 0.25 });
        masterTl.resume();
      };
      card.addEventListener("mouseenter", onEnter);
      card.addEventListener("mouseleave", onLeave);
      listeners.push(() => {
        card.removeEventListener("mouseenter", onEnter);
        card.removeEventListener("mouseleave", onLeave);
      });

      const onResize = () => ScrollTrigger.refresh();
      window.addEventListener("resize", onResize);
      listeners.push(() => window.removeEventListener("resize", onResize));
    }

    return () => {
      [...tweens, ...timelines].forEach((t) => {
        if (t.duration() < 100) t.progress(1);
        t.kill();
      });
      triggers.forEach((t) => t.kill());
      listeners.forEach((fn) => fn());
    };
  }, []);

  // Notification pop. Confetti fires from the cursor tour, not here —
  // keeps the data flow unidirectional (tour → state → confetti).
  useEffect(() => {
    if (!noteRef.current) return;
    const el = noteRef.current;
    if (noteVisible) {
      gsap.fromTo(
        el,
        { x: 40, opacity: 0, scale: 0.96 },
        { x: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)" }
      );
    } else {
      gsap.to(el, { x: 30, opacity: 0, duration: 0.3, ease: "power3.in" });
    }
  }, [noteVisible, noteIdx]);

  // View crossfade — whenever `active` changes, blur-fade in the new view.
  const viewRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!viewRef.current) return;
    gsap.fromTo(
      viewRef.current,
      { opacity: 0, y: 12, filter: "blur(10px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55, ease: "power3.out" }
    );
  }, [active]);

  const note = NOTIFICATIONS[noteIdx];

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
            Six views. One tool. The auto-tour below cycles through the
            product. Hover to take the wheel.
          </p>
        </div>

        <div ref={cardRef} className="relative [perspective:1400px]">
          <div
            ref={surfaceRef}
            className="relative rounded-[16px] bg-[var(--bg-cream)] shadow-[var(--shadow-dropdown)] overflow-hidden border border-[var(--border-subtle)] [transform-style:preserve-3d] will-change-transform"
          >
            <div className="flex flex-col md:flex-row">
              {/* Sidebar — depth layer 1 */}
              <div
                ref={sidebarLayerRef}
                className="hidden md:block w-[220px] shrink-0 p-6 border-r border-[var(--border-subtle)] bg-[var(--bg-sage)] will-change-transform"
                style={{ transform: "translateZ(30px)" }}
              >
                <div data-nav className="flex items-center gap-2.5 mb-10">
                  <div className="h-6 w-6 rounded bg-[var(--text-forest)] flex items-center justify-center">
                    <span className="text-[var(--text-cream)] text-[10px] font-bold">B</span>
                  </div>
                  <span className="font-[family-name:var(--font-display)] font-bold text-[15px] tracking-tight text-[var(--text-forest)]">
                    BogglTrack
                  </span>
                </div>

                <div className="space-y-1.5 text-left">
                  {NAV.map((item) => {
                    const isActive = item.id === active;
                    return (
                      <div
                        data-nav
                        data-ct={`nav-${item.id}`}
                        key={item.id}
                        className={`flex items-center gap-2.5 h-9 px-3 rounded-md text-[14px] font-medium transition-[background-color,box-shadow,color] duration-300 ease-out ${
                          isActive
                            ? "bg-[var(--bg-cream)] shadow-[var(--shadow-card)] text-[var(--text-forest)]"
                            : "text-[var(--text-olive)]"
                        }`}
                      >
                        {item.label}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-10 pt-6 border-t border-[var(--border-subtle)]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-olive)] mb-3">
                    Active project
                  </p>
                  <div className="flex items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent-olive)] pulse-dot shrink-0" />
                    <span className="text-[13px] font-semibold text-[var(--text-forest)] truncate">
                      BrandCo · Design v2
                    </span>
                  </div>
                </div>
              </div>

              {/* Main panel — depth layer 2 */}
              <div
                ref={panelLayerRef}
                className="relative flex-1 p-8 md:p-12 text-left will-change-transform"
                style={{ transform: "translateZ(60px)" }}
              >
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] text-[26px] md:text-[28px] font-semibold text-[var(--text-forest)] tracking-tight leading-[1.25]">
                      {NAV.find((n) => n.id === active)?.label ?? "Dashboard"}
                    </h3>
                    <p className="text-[14px] text-[var(--text-olive)] mt-1">
                      {VIEW_SUBTITLE[active]}
                    </p>
                  </div>
                  <div
                    ref={pillRef}
                    data-pill
                    data-ct="timer-pill"
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

                <div ref={viewRef} className="min-h-[260px]">
                  {active === "dashboard" && <DashboardView timerRefTag />}
                  {active === "timer" && <TimerView />}
                  {active === "calendar" && <CalendarView />}
                  {active === "projects" && <ProjectsView />}
                  {active === "clients" && <ClientsView />}
                  {active === "invoices" && <InvoicesView />}
                </div>
              </div>
            </div>

            {/* Particle + confetti layers */}
            <div ref={particlesRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-20" />
            <div ref={confettiRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-30" />

            {/* Highlight ring */}
            <div
              ref={ringRef}
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 rounded-[10px] border-2 border-[var(--accent-olive)]/60 opacity-0 will-change-transform z-10"
              style={{
                width: 0,
                height: 0,
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 0 4px rgba(16,185,129,0.12)",
              }}
            />

            {/* Faux cursor */}
            <div
              ref={cursorRef}
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 w-5 h-5 -translate-x-1 -translate-y-1 will-change-transform z-40 hidden md:block"
            >
              <svg viewBox="0 0 16 16" className="w-full h-full drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]">
                <path
                  d="M1.5 1.5 L13 8 L7.5 8.5 L10 14 L7.5 15 L5 9.5 L1.5 12 Z"
                  fill="white"
                  stroke="#111"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Live notification popover */}
            <div
              ref={noteRef}
              aria-hidden="true"
              className="pointer-events-none absolute top-6 right-6 md:top-8 md:right-8 min-w-[240px] max-w-[320px] rounded-[12px] bg-[var(--bg-cream)] shadow-[var(--shadow-dropdown)] border border-[var(--border-subtle)] px-4 py-3 opacity-0 z-40"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[12px] font-bold ${
                    note.tone === "paid"
                      ? "bg-[var(--accent-olive-soft)] text-[var(--accent-olive-hover)]"
                      : "bg-[var(--bg-muted)] text-[var(--text-forest)]"
                  }`}
                >
                  {note.tone === "paid" ? "$" : "•"}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--text-forest)] truncate">
                    {note.title}
                  </p>
                  <p className="text-[12px] text-[var(--text-olive)] truncate tabular-nums">
                    {note.meta}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const VIEW_SUBTITLE: Record<NavId, string> = {
  dashboard: "This week's overview",
  timer: "Running session · live",
  calendar: "Last 4 weeks · tracked hours",
  projects: "Active work · 4 projects",
  clients: "On retainer · 4 clients",
  invoices: "Recent · auto-generated",
};

function DashboardView({ timerRefTag: _ }: { timerRefTag?: boolean }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {[
          { id: "today", label: "Today", hours: "2.3h", earn: "$187" },
          { id: "week", label: "Week", hours: "18.6h", earn: "$1,488" },
          { id: "month", label: "Month", hours: "74.2h", earn: "$5,936" },
        ].map((s, i) => (
          <div
            data-stat
            data-ct={i === 1 ? "view-focus-primary" : `stat-${s.id}`}
            key={s.id}
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
              data-ct={`chart-bar-${i}`}
              key={i}
              className="flex-1 bg-[var(--text-forest)] rounded-sm"
              style={{ height: `${(h / 12) * 100}%`, opacity: 0.2 + (h / 12) * 0.8 }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function TimerView() {
  return (
    <div
      data-ct="view-focus-primary"
      className="p-7 rounded-[14px] bg-[var(--bg-cream)] shadow-[var(--shadow-card)] relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-olive)] pulse-dot" />
          <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--accent-olive-hover)]">
            Recording
          </span>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-olive)]">
          ⌘T to stop
        </span>
      </div>

      <p className="font-[family-name:var(--font-display)] text-[72px] md:text-[96px] font-bold tabular-nums leading-none tracking-[-0.04em] text-[var(--text-forest)]">
        02:14:37
      </p>
      <p className="mt-2 text-[15px] text-[var(--text-olive)]">
        BrandCo · Design system v2 · <span className="text-[var(--accent-olive-hover)] font-semibold tabular-nums">$187.43</span>
      </p>

      <div className="mt-8 h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
        <div className="h-full w-[62%] bg-[var(--accent-olive)]" />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-olive)] tabular-nums">
        <span>2h 14m logged today</span>
        <span>Daily goal · 3h 30m</span>
      </div>
    </div>
  );
}

function CalendarView() {
  const filled = new Set([2, 3, 4, 9, 10, 11, 12, 16, 17, 18, 19, 23, 24, 25, 26]);
  const heavy = new Set([10, 17, 24]);
  return (
    <div
      data-ct="view-focus-primary"
      className="p-5 rounded-[14px] bg-[var(--bg-cream)] shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold text-[var(--text-forest)]">Last 4 weeks</p>
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-olive)]">
          <span>Less</span>
          <span className="h-3 w-3 rounded-[3px] bg-[var(--bg-muted)]" />
          <span className="h-3 w-3 rounded-[3px] bg-[var(--text-forest)]/30" />
          <span className="h-3 w-3 rounded-[3px] bg-[var(--text-forest)]/60" />
          <span className="h-3 w-3 rounded-[3px] bg-[var(--text-forest)]" />
          <span>More</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-[5px]">
        {Array.from({ length: 28 }).map((_, i) => (
          <div
            key={i}
            className={`aspect-square rounded-[4px] ${
              heavy.has(i)
                ? "bg-[var(--text-forest)]"
                : filled.has(i)
                  ? "bg-[var(--text-forest)]/55"
                  : "bg-[var(--bg-muted)]"
            }`}
          />
        ))}
      </div>
      <p className="mt-4 text-[12px] text-[var(--text-olive)] tabular-nums">
        74.2h tracked · longest streak 9 days
      </p>
    </div>
  );
}

function ProjectsView() {
  const rows = [
    { name: "BrandCo · Design v2", rate: "$95/hr", hours: "42.8h", pct: 88, color: "bg-[var(--accent-olive)]" },
    { name: "AcmeCo · Onboarding", rate: "$110/hr", hours: "18.3h", pct: 55, color: "bg-[var(--text-forest)]" },
    { name: "StudioX · Landing page", rate: "$80/hr", hours: "8.1h", pct: 30, color: "bg-[var(--text-forest)]/60" },
    { name: "Self · Writing", rate: "Unbilled", hours: "4.0h", pct: 12, color: "bg-[var(--text-forest)]/30" },
  ];
  return (
    <div
      data-ct="view-focus-primary"
      className="p-5 rounded-[14px] bg-[var(--bg-cream)] shadow-[var(--shadow-card)]"
    >
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[13px] font-semibold text-[var(--text-forest)] truncate">{r.name}</p>
              <div className="flex items-center gap-3 text-[12px] text-[var(--text-olive)] tabular-nums">
                <span>{r.rate}</span>
                <span className="text-[var(--text-forest)] font-semibold">{r.hours}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
              <div className={`h-full ${r.color}`} style={{ width: `${r.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientsView() {
  const clients = [
    { name: "BrandCo", total: "$12,480", active: true, dot: "bg-[var(--accent-olive)]" },
    { name: "AcmeCo", total: "$7,040", active: true, dot: "bg-[var(--accent-olive)]" },
    { name: "StudioX", total: "$3,280", active: false, dot: "bg-[var(--text-olive)]" },
    { name: "Nova Labs", total: "$9,120", active: true, dot: "bg-[var(--accent-olive)]" },
  ];
  return (
    <div
      data-ct="view-focus-primary"
      className="p-5 rounded-[14px] bg-[var(--bg-cream)] shadow-[var(--shadow-card)]"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {clients.map((c) => (
          <div
            key={c.name}
            className="flex items-center gap-3 p-4 rounded-[10px] bg-[var(--bg-muted)]/60 border border-[var(--border-subtle)]"
          >
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center bg-[var(--bg-cream)] shadow-[var(--shadow-card)] border border-[var(--border-subtle)] font-[family-name:var(--font-display)] font-bold text-[14px] text-[var(--text-forest)]`}
            >
              {c.name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-[var(--text-forest)] truncate">
                  {c.name}
                </span>
                <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
              </div>
              <p className="text-[12px] text-[var(--text-olive)] tabular-nums">
                Total billed · {c.total}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoicesView() {
  const invoices = [
    { id: "INV-2026-042", client: "BrandCo", amount: "$1,488", status: "Paid" as const },
    { id: "INV-2026-041", client: "AcmeCo", amount: "$640", status: "Paid" as const },
    { id: "INV-2026-040", client: "StudioX", amount: "$256", status: "Sent" as const },
    { id: "INV-2026-039", client: "Nova Labs", amount: "$2,320", status: "Paid" as const },
  ];
  return (
    <div
      data-ct="view-focus-primary"
      className="p-5 rounded-[14px] bg-[var(--bg-cream)] shadow-[var(--shadow-card)]"
    >
      <div className="divide-y divide-[var(--border-subtle)]">
        {invoices.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-forest)] tabular-nums">
                {inv.id}
              </p>
              <p className="text-[12px] text-[var(--text-olive)]">{inv.client}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[14px] font-bold text-[var(--text-forest)] tabular-nums">
                {inv.amount}
              </span>
              <span
                className={`inline-flex items-center h-6 px-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                  inv.status === "Paid"
                    ? "bg-[var(--accent-olive-soft)] text-[var(--accent-olive-hover)]"
                    : "bg-[var(--bg-muted)] text-[var(--text-forest)]"
                }`}
              >
                {inv.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

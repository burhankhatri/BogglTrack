"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X, ArrowRight } from "lucide-react";

// Tiny onboarding nudge — only renders when the user hasn't finished the
// essentials (set a rate, made a project). Once all boxes are ticked or
// the user dismisses, it stays hidden via localStorage.
const DISMISSED_KEY = "boggltrack-onboarding-dismissed";

interface Props {
  hasProjects: boolean;
  hasRate: boolean;
}

export function FirstRunChecklist({ hasProjects, hasRate }: Props) {
  const [dismissed, setDismissed] = useState(true); // default hidden until hydrated

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
  }, []);

  const allDone = hasProjects && hasRate;
  if (dismissed || allDone) return null;

  const steps = [
    {
      label: "Set your default hourly rate",
      href: "/settings",
      done: hasRate,
    },
    {
      label: "Create your first project",
      href: "/projects",
      done: hasProjects,
    },
  ];

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="relative rounded-[var(--radius-lg)] bg-[var(--accent-olive-soft)]/40 border border-[var(--border-subtle)] px-5 py-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 p-1 rounded-[var(--radius-sm)] text-[var(--text-olive)]/60 hover:text-[var(--text-forest)] hover:bg-[var(--bg-muted)]/60 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="text-[13px] font-semibold text-[var(--text-forest)]">
        Get set up
      </p>
      <p className="mt-0.5 text-[12px] text-[var(--text-olive)]">
        Two quick steps so your entries track earnings from day one.
      </p>
      <div className="mt-3 space-y-1.5">
        {steps.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-[var(--radius-sm)] text-[13px] transition-colors ${
              s.done
                ? "text-[var(--text-olive)]/70 cursor-default pointer-events-none"
                : "text-[var(--text-forest)] hover:bg-[var(--bg-muted)]/50"
            }`}
          >
            {s.done ? (
              <CheckCircle2 className="h-4 w-4 text-[var(--accent-olive-hover)] shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-[var(--text-olive)]/50 shrink-0" />
            )}
            <span className={s.done ? "line-through" : ""}>{s.label}</span>
            {!s.done && (
              <ArrowRight className="h-3.5 w-3.5 ml-auto text-[var(--text-olive)]/50" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

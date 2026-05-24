"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GitCommit, ArrowRight, X } from "lucide-react";

interface Cluster {
  start: string;
  end: string;
  durationSeconds: number;
  commits: { sha: string }[];
}

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// localStorage key for the session-level dismiss.
// The dedicated /untracked page has its own, permanent per-cluster dismiss.
const SESSION_DISMISS_KEY = "boggl.untracked.banner-dismissed-until";
// Stale-while-revalidate cache for the banner's cluster summary.
const CACHE_KEY = "boggl.untracked.banner-cache";

interface CachedSnapshot {
  clusters: Cluster[];
  at: number;
}

function readCachedSnapshot(): Cluster[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSnapshot;
    if (!Array.isArray(parsed.clusters)) return null;
    return parsed.clusters;
  } catch {
    return null;
  }
}

function writeCachedSnapshot(clusters: Cluster[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ clusters, at: Date.now() } satisfies CachedSnapshot)
    );
  } catch {
    // Quota or private-mode — silent.
  }
}

/**
 * Compact dashboard pill: "N commits · ~4h 29m aren't tracked · Review".
 * Clicking Review jumps to the dedicated /untracked page where the full
 * cluster list lives with per-cluster actions.
 *
 * Summary-only by design — we moved the heavy list into its own page
 * because 30+ clusters drowned the dashboard.
 */
export function UntrackedCommitsBanner() {
  // Hydrate from localStorage immediately so the banner paints on first
  // render. The fetch below revalidates in the background.
  const [clusters, setClusters] = useState<Cluster[] | null>(() =>
    readCachedSnapshot()
  );
  const [unavailable, setUnavailable] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem(SESSION_DISMISS_KEY) || 0);
  });

  const load = useCallback(async () => {
    const r = await fetch("/api/github/untracked-commits?days=7");
    if (r.status === 400 || r.status === 401) {
      setUnavailable(true);
      return;
    }
    if (!r.ok) return;
    const fresh = (await r.json()) as Cluster[];
    setClusters(fresh);
    writeCachedSnapshot(fresh);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dismissForADay = () => {
    const until = Date.now() + 24 * 60 * 60 * 1000;
    window.localStorage.setItem(SESSION_DISMISS_KEY, String(until));
    setDismissedUntil(until);
  };

  if (unavailable || !clusters || clusters.length === 0) return null;
  if (dismissedUntil > Date.now()) return null;

  const totalCommits = clusters.reduce((s, c) => s + c.commits.length, 0);
  const totalSeconds = clusters.reduce((s, c) => s + c.durationSeconds, 0);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--accent-olive-soft)] ring-1 ring-[var(--accent-olive)]/20">
      <div className="h-7 w-7 rounded-full bg-[var(--accent-olive)]/15 flex items-center justify-center shrink-0">
        <GitCommit className="h-3.5 w-3.5 text-[var(--accent-olive-hover)]" />
      </div>
      <div className="flex-1 min-w-0 text-[13px]">
        <span className="font-semibold text-[var(--text-forest)]">
          {totalCommits} commit{totalCommits === 1 ? "" : "s"}
        </span>
        <span className="text-[var(--text-olive)]">
          {" · "}
          ~{formatHM(totalSeconds)} in the last 7 days aren&apos;t tracked
        </span>
      </div>
      <Link
        href="/untracked"
        className="inline-flex items-center gap-1 h-8 px-3 rounded-[var(--radius-md)] text-[12px] font-medium bg-[var(--text-forest)] text-[var(--text-cream)] hover:opacity-90 transition-opacity shrink-0"
      >
        Review
        <ArrowRight className="h-3 w-3" />
      </Link>
      <button
        type="button"
        onClick={dismissForADay}
        className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-cream)] transition-colors shrink-0"
        title="Dismiss for today"
        aria-label="Dismiss for today"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

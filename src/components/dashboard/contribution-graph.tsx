"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, getDay } from "date-fns";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface DayCell {
  date: string;
  commits: number;
  seconds: number;
}

/**
 * GitHub-style contribution heatmap. 12 weeks of daily activity, intensity
 * driven by commit count with tracked hours as a supporting signal.
 */
export function ContributionGraph() {
  const [cells, setCells] = useState<DayCell[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/github/contribution-graph?days=84");
      if (cancelled) return;
      if (r.status === 401 || r.status === 400) {
        setUnavailable(true);
        return;
      }
      if (!r.ok) return;
      const data = (await r.json()) as { days: DayCell[] };
      setCells(data.days);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Arrange cells into weeks × weekdays.
  const { weeks, maxCommits, totalCommits } = useMemo(() => {
    if (!cells) return { weeks: [], maxCommits: 0, totalCommits: 0 };
    const grid: (DayCell | null)[][] = [];
    let currentWeek: (DayCell | null)[] = [];

    // Pad the first week with nulls so Monday aligns to row 0.
    const first = cells[0];
    if (first) {
      // getDay: Sun=0, Mon=1, … Sat=6. Our grid rows: Mon=0, … Sun=6.
      const dayIdx = (getDay(new Date(first.date + "T00:00:00")) + 6) % 7;
      for (let i = 0; i < dayIdx; i++) currentWeek.push(null);
    }

    for (const c of cells) {
      currentWeek.push(c);
      if (currentWeek.length === 7) {
        grid.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      grid.push(currentWeek);
    }

    const max = cells.reduce((m, c) => Math.max(m, c.commits), 0);
    const total = cells.reduce((s, c) => s + c.commits, 0);
    return { weeks: grid, maxCommits: max, totalCommits: total };
  }, [cells]);

  if (unavailable || !cells) return null;

  const intensity = (commits: number): string => {
    if (commits === 0) return "bg-[var(--bg-muted)]";
    if (maxCommits === 0) return "bg-[var(--bg-muted)]";
    const ratio = commits / maxCommits;
    if (ratio < 0.25) return "bg-[var(--accent-olive)]/25";
    if (ratio < 0.5) return "bg-[var(--accent-olive)]/45";
    if (ratio < 0.75) return "bg-[var(--accent-olive)]/70";
    return "bg-[var(--accent-olive)]";
  };

  const weekdayLabels = ["Mon", "", "Wed", "", "Fri", "", ""];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="font-sans text-[15px] font-semibold text-[var(--text-forest)]">
            Contribution graph
          </CardTitle>
          <p className="text-[12px] text-[var(--text-olive)] mt-0.5 tabular-nums">
            {totalCommits} commit{totalCommits === 1 ? "" : "s"} · last 12 weeks
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-olive)]">
          <span>Less</span>
          <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--bg-muted)]" />
          <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--accent-olive)]/25" />
          <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--accent-olive)]/45" />
          <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--accent-olive)]/70" />
          <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--accent-olive)]" />
          <span>More</span>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="flex gap-1.5 min-w-fit">
          {/* Weekday labels column */}
          <div className="flex flex-col gap-1 mt-1 shrink-0 text-[9px] text-[var(--text-muted)]">
            {weekdayLabels.map((l, i) => (
              <div key={i} className="h-3 leading-3">
                {l}
              </div>
            ))}
          </div>

          {/* Week columns */}
          <div className="flex gap-1 min-w-fit">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((cell, di) => {
                  if (!cell) {
                    return <div key={di} className="h-3 w-3" aria-hidden />;
                  }
                  return (
                    <div
                      key={di}
                      className={`h-3 w-3 rounded-[2px] ${intensity(cell.commits)}`}
                      title={`${format(new Date(cell.date + "T00:00:00"), "MMM d")} · ${cell.commits} commit${cell.commits === 1 ? "" : "s"}${cell.seconds ? ` · ${(cell.seconds / 3600).toFixed(1)}h` : ""}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Persistent entry point to the untracked-work page — the commits
            the graph is showing are the same ones that page lets you turn
            into time entries, so it's a natural follow-through. */}
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
          <Link
            href="/untracked"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-olive)] hover:text-[var(--text-forest)] transition-colors"
          >
            Find untracked commits
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

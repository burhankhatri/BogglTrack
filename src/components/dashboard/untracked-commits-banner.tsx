"use client";

import { useCallback, useEffect, useState } from "react";
import { GitCommit, Plus, X, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";

interface AttachedCommit {
  sha: string;
  message: string;
  repo: string;
  url: string;
  committedAt: string;
}

interface Cluster {
  start: string;
  end: string;
  durationSeconds: number;
  commits: AttachedCommit[];
  suggestedProjectId: string | null;
}

interface Props {
  /** Called after a cluster is converted to an entry so the dashboard can refetch. */
  onEntryCreated?: () => void;
}

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Dashboard banner — scans the last 7 days of GitHub commits for work that
 * wasn't covered by a time entry and offers to convert each cluster into an
 * entry with one click.
 */
export function UntrackedCommitsBanner({ onEntryCreated }: Props) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [created, setCreated] = useState<Set<string>>(new Set());

  const clusterKey = (c: Cluster) => `${c.start}|${c.end}`;

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/github/untracked-commits?days=7");
      if (r.status === 400) {
        // Not connected — silently hide
        setHidden(true);
        return;
      }
      if (!r.ok) return;
      setClusters(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createEntry = async (cluster: Cluster) => {
    const key = clusterKey(cluster);
    setCreating(key);
    try {
      const r = await fetch("/api/time-entries/from-commits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: cluster.start,
          end: cluster.end,
          commits: cluster.commits,
          projectId: cluster.suggestedProjectId,
        }),
      });
      if (!r.ok) {
        toast.error("Couldn't create entry");
        return;
      }
      toast.success(`Entry created: ${formatHM(cluster.durationSeconds)}`);
      setCreated((prev) => new Set(prev).add(key));
      onEntryCreated?.();
    } finally {
      setCreating(null);
    }
  };

  if (hidden || loading || clusters.length === 0) return null;

  const visibleClusters = clusters.filter((c) => !created.has(clusterKey(c)));
  if (visibleClusters.length === 0) return null;

  const totalSeconds = visibleClusters.reduce((s, c) => s + c.durationSeconds, 0);
  const totalCommits = visibleClusters.reduce((s, c) => s + c.commits.length, 0);

  return (
    <Card className="p-4 bg-[var(--accent-olive-soft)] ring-1 ring-[var(--accent-olive)]/20 border-0 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-[var(--accent-olive)]/15 flex items-center justify-center shrink-0">
          <GitCommit className="h-4 w-4 text-[var(--accent-olive-hover)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-[var(--text-forest)]">
                {totalCommits} commit{totalCommits === 1 ? "" : "s"} you haven&apos;t tracked
              </p>
              <p className="text-[12px] text-[var(--text-olive)] mt-0.5">
                Roughly {formatHM(totalSeconds)} of work in the last 7 days.
                One-click to add as time entries.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHidden(true)}
              className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-cream)] transition-colors shrink-0"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <ul className="mt-3 space-y-1.5">
            {visibleClusters.slice(0, 5).map((cl) => {
              const key = clusterKey(cl);
              const isCreating = creating === key;
              const isDone = created.has(key);
              return (
                <li
                  key={key}
                  className="flex items-center gap-3 p-2 rounded-[var(--radius-md)] bg-[var(--bg-cream)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[12px] text-[var(--text-forest)] tabular-nums font-medium">
                      <span>{format(new Date(cl.start), "EEE, MMM d · HH:mm")}</span>
                      <span className="text-[var(--text-olive)]">→</span>
                      <span>{format(new Date(cl.end), "HH:mm")}</span>
                      <span className="text-[var(--text-olive)]">·</span>
                      <span>{formatHM(cl.durationSeconds)}</span>
                      <span className="text-[var(--text-olive)]">·</span>
                      <span className="text-[var(--text-olive)]">
                        {cl.commits.length} commit{cl.commits.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-olive)] truncate mt-0.5">
                      {cl.commits
                        .slice(0, 2)
                        .map((c) => c.message)
                        .join(" · ")}
                      {cl.commits.length > 2 && ` · +${cl.commits.length - 2} more`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isCreating || isDone}
                    onClick={() => createEntry(cl)}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-[var(--radius-md)] text-[12px] font-medium bg-[var(--text-forest)] text-[var(--text-cream)] hover:opacity-90 disabled:opacity-60 transition-opacity shrink-0"
                  >
                    {isCreating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isDone ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {isDone ? "Added" : isCreating ? "…" : "Add entry"}
                  </button>
                </li>
              );
            })}
            {visibleClusters.length > 5 && (
              <li className="text-[11px] text-[var(--text-olive)] italic pl-2">
                + {visibleClusters.length - 5} more untracked sessions…
              </li>
            )}
          </ul>
        </div>
      </div>
    </Card>
  );
}

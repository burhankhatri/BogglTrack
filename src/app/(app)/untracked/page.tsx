"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  GitCommit,
  Plus,
  Check,
  Loader2,
  ArrowLeft,
  Trash2,
  RotateCw,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { estimateClusterWindow } from "@/lib/github/untracked-estimate";

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

interface Project {
  id: string;
  name: string;
  color: string;
}

const DISMISSED_KEY = "boggl.untracked.dismissed-cluster-keys";
const clusterKey = (c: Cluster) => `${c.start}|${c.end}`;

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
    return new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(set)));
}

export default function UntrackedCommitsPage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [created, setCreated] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [showDismissed, setShowDismissed] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setReloading(true);
    try {
      const [clustersRes, projectsRes] = await Promise.all([
        fetch("/api/github/untracked-commits?days=30"),
        fetch("/api/projects"),
      ]);

      if (clustersRes.status === 400 || clustersRes.status === 401) {
        setNotConnected(true);
        return;
      }

      if (clustersRes.ok) setClusters(await clustersRes.json());
      if (projectsRes.ok) {
        const p = (await projectsRes.json()) as Project[];
        setProjects(p);
      }
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createEntry = async (cluster: Cluster, projectId: string | null) => {
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
          projectId,
        }),
      });
      if (!r.ok) {
        toast.error("Couldn't create entry");
        return;
      }
      toast.success(`Entry created: ${formatHM(cluster.durationSeconds)}`);
      setCreated((prev) => new Set(prev).add(key));
    } finally {
      setCreating(null);
    }
  };

  const dismissCluster = (cluster: Cluster) => {
    const key = clusterKey(cluster);
    const next = new Set(dismissed);
    next.add(key);
    setDismissed(next);
    saveDismissed(next);
  };

  const restoreDismissed = () => {
    setDismissed(new Set());
    saveDismissed(new Set());
    toast.success("Dismissed items restored");
  };

  const visible = useMemo(
    () =>
      clusters.filter(
        (c) => !created.has(clusterKey(c)) && (!dismissed.has(clusterKey(c)) || showDismissed)
      ),
    [clusters, created, dismissed, showDismissed]
  );

  const availableRepos = useMemo(() => {
    const set = new Set<string>();
    for (const cl of visible) for (const c of cl.commits) set.add(c.repo);
    return Array.from(set).sort();
  }, [visible]);

  // When repos are selected, narrow each cluster to commits from those repos,
  // drop empty clusters, and recompute the cluster's time window using the
  // same estimate the API uses (ramp-up + commit span + tail). Empty
  // selection means "no filter" — show everything as the API returned it.
  const filteredVisible = useMemo<Cluster[]>(() => {
    if (selectedRepos.size === 0) return visible;
    const out: Cluster[] = [];
    for (const cl of visible) {
      const matching = cl.commits.filter((c) => selectedRepos.has(c.repo));
      if (matching.length === 0) continue;
      const est = estimateClusterWindow(
        matching.map((c) => new Date(c.committedAt).getTime())
      );
      out.push({
        ...cl,
        commits: matching,
        start: new Date(est.startMs).toISOString(),
        end: new Date(est.endMs).toISOString(),
        durationSeconds: est.durationSeconds,
      });
    }
    return out;
  }, [visible, selectedRepos]);

  const totalSeconds = filteredVisible.reduce((s, c) => s + c.durationSeconds, 0);
  const totalCommits = filteredVisible.reduce((s, c) => s + c.commits.length, 0);

  const summarizeForRepos = useCallback(
    (repos: Set<string>) => {
      let total = 0;
      let commitCount = 0;
      for (const cl of visible) {
        const matching = cl.commits.filter((c) => repos.has(c.repo));
        if (matching.length === 0) continue;
        const est = estimateClusterWindow(
          matching.map((c) => new Date(c.committedAt).getTime())
        );
        total += est.durationSeconds;
        commitCount += matching.length;
      }
      return { total, commitCount };
    },
    [visible]
  );

  const toggleRepo = useCallback(
    (repo: string) => {
      const next = new Set(selectedRepos);
      if (next.has(repo)) next.delete(repo);
      else next.add(repo);
      setSelectedRepos(next);
      if (next.size === 0) return;
      const { total, commitCount } = summarizeForRepos(next);
      const label =
        next.size === 1
          ? Array.from(next)[0].split("/").slice(-1)[0]
          : `${next.size} repos`;
      if (commitCount === 0) {
        toast(`${label}: no untracked commits in the last 30 days`);
      } else {
        toast.success(
          `${label}: ~${formatHM(total)} across ${commitCount} commit${commitCount === 1 ? "" : "s"}`
        );
      }
    },
    [selectedRepos, summarizeForRepos]
  );

  const clearRepoFilter = useCallback(() => {
    setSelectedRepos(new Set());
  }, []);

  const shortRepo = (r: string) => r.split("/").slice(-1)[0];

  return (
    <div className="mx-auto max-w-[960px] px-4 py-8 md:pt-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-olive)] hover:text-[var(--text-forest)] transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>

        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-sans text-[28px] md:text-[32px] font-semibold tracking-tight text-[var(--text-forest)] leading-none">
              Untracked work
            </h1>
            <p className="mt-1.5 text-[13px] text-[var(--text-olive)] max-w-[620px]">
              Commits from the last 30 days that aren&apos;t covered by any time entry.
              One-click to convert them into entries — the commit messages become
              the description, and the duration is an estimate: commit span plus
              ramp-up before the first commit and cleanup after the last. Edit
              any entry afterwards if the estimate is off.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load({ silent: true })}
            disabled={reloading}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)] text-[12px] font-medium text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-muted)] transition-colors disabled:opacity-60 shrink-0"
            title="Re-scan GitHub"
          >
            <RotateCw className={`h-3.5 w-3.5 ${reloading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* States */}
      {loading ? (
        <Card className="p-8 text-center">
          <Loader2 className="h-4 w-4 animate-spin mx-auto text-[var(--text-olive)]" />
        </Card>
      ) : notConnected ? (
        <Card className="p-8 text-center space-y-3">
          <p className="text-[14px] font-semibold text-[var(--text-forest)]">
            GitHub not connected
          </p>
          <p className="text-[13px] text-[var(--text-olive)] max-w-[420px] mx-auto">
            Connect GitHub in Settings to see which commits you&apos;ve made
            without a running timer. We&apos;ll cluster them into sessions you
            can turn into time entries with one click.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--text-forest)] text-[var(--text-cream)] text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            Open Settings
          </Link>
        </Card>
      ) : filteredVisible.length === 0 && selectedRepos.size === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-[var(--accent-olive-soft)] mx-auto">
            <Check className="h-5 w-5 text-[var(--accent-olive-hover)]" />
          </div>
          <p className="text-[14px] font-semibold text-[var(--text-forest)]">
            You&apos;re all caught up
          </p>
          <p className="text-[13px] text-[var(--text-olive)] max-w-[420px] mx-auto">
            Every commit in the last 30 days is either inside an existing time
            entry or dismissed. Nice work.
          </p>
          {dismissed.size > 0 && (
            <button
              type="button"
              onClick={() => setShowDismissed(true)}
              className="text-[12px] text-[var(--text-olive)] hover:text-[var(--text-forest)] underline"
            >
              Show {dismissed.size} dismissed
            </button>
          )}
        </Card>
      ) : (
        <>
          {/* Repo filter — only render if there's more than one repo to choose from */}
          {availableRepos.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mr-1">
                Filter by repo
              </span>
              <button
                type="button"
                onClick={clearRepoFilter}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  selectedRepos.size === 0
                    ? "bg-[var(--text-forest)] text-[var(--text-cream)]"
                    : "bg-[var(--bg-muted)] text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-cream-hover)]"
                }`}
              >
                All
              </button>
              {availableRepos.map((repo) => {
                const short = repo.split("/").slice(-1)[0];
                const active = selectedRepos.has(repo);
                return (
                  <button
                    key={repo}
                    type="button"
                    onClick={() => toggleRepo(repo)}
                    title={repo}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors ${
                      active
                        ? "bg-[var(--text-forest)] text-[var(--text-cream)]"
                        : "bg-[var(--bg-muted)] text-[var(--text-forest)] hover:bg-[var(--bg-cream-hover)]"
                    }`}
                  >
                    <GitCommit className="h-2.5 w-2.5" />
                    <span className="truncate max-w-[200px]">{short}</span>
                    {active && <X className="h-2.5 w-2.5" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Summary strip */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--bg-muted)] text-[12px] text-[var(--text-olive)]">
            <GitCommit className="h-3.5 w-3.5" />
            <span>
              <span className="font-semibold text-[var(--text-forest)]">
                {totalCommits}
              </span>{" "}
              commits across{" "}
              <span className="font-semibold text-[var(--text-forest)]">
                {filteredVisible.length}
              </span>{" "}
              sessions
              {selectedRepos.size === 1 && (
                <>
                  {" "}
                  in{" "}
                  <span className="font-mono font-semibold text-[var(--text-forest)]">
                    {Array.from(selectedRepos)[0].split("/").slice(-1)[0]}
                  </span>
                </>
              )}
              {selectedRepos.size > 1 && (
                <>
                  {" "}
                  across{" "}
                  <span className="font-semibold text-[var(--text-forest)]">
                    {selectedRepos.size} repos
                  </span>
                </>
              )}
            </span>
            <span>·</span>
            <span>
              ~
              <span className="font-semibold text-[var(--text-forest)]">
                {formatHM(totalSeconds)}
              </span>
            </span>
            {dismissed.size > 0 && (
              <button
                type="button"
                onClick={() => setShowDismissed((v) => !v)}
                className="ml-auto text-[11px] text-[var(--text-olive)] hover:text-[var(--text-forest)] underline"
              >
                {showDismissed ? "Hide" : "Show"} {dismissed.size} dismissed
              </button>
            )}
          </div>

          {filteredVisible.length === 0 ? (
            <Card className="p-8 text-center space-y-2">
              <p className="text-[13px] text-[var(--text-olive)]">
                No untracked commits in{" "}
                <span className="font-mono font-semibold text-[var(--text-forest)]">
                  {selectedRepos.size === 1
                    ? Array.from(selectedRepos)[0].split("/").slice(-1)[0]
                    : `${selectedRepos.size} selected repos`}
                </span>{" "}
                in the last 30 days.
              </p>
              <button
                type="button"
                onClick={clearRepoFilter}
                className="text-[12px] text-[var(--text-olive)] hover:text-[var(--text-forest)] underline"
              >
                Show all repos
              </button>
            </Card>
          ) : (
            <ul className="space-y-3">
              {filteredVisible.map((cl) => {
              const key = clusterKey(cl);
              const isCreating = creating === key;
              const isDone = created.has(key);
              const isDismissed = dismissed.has(key);
              const suggested = projects.find((p) => p.id === cl.suggestedProjectId);

              const repoTally = new Map<string, number>();
              for (const c of cl.commits) repoTally.set(c.repo, (repoTally.get(c.repo) ?? 0) + 1);
              const repoChips = Array.from(repoTally.entries()).sort((a, b) => b[1] - a[1]);
              const multiRepo = repoChips.length > 1;

              return (
                <Card
                  key={key}
                  className={`p-4 ${isDismissed ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="min-w-0 flex-1 space-y-3">
                      {/* Time range */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--text-forest)] tabular-nums font-medium">
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

                      {/* Repo chips */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {repoChips.map(([repo, count]) => (
                          <a
                            key={repo}
                            href={`https://github.com/${repo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={repo}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-muted)] hover:bg-[var(--bg-cream-hover)] text-[11px] font-mono text-[var(--text-forest)] transition-colors"
                          >
                            <GitCommit className="h-2.5 w-2.5 text-[var(--text-olive)]" />
                            <span className="truncate max-w-[200px]">{shortRepo(repo)}</span>
                            {multiRepo && (
                              <span className="text-[var(--text-olive)] tabular-nums">
                                · {count}
                              </span>
                            )}
                          </a>
                        ))}
                        {suggested && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                            style={{
                              color: suggested.color,
                              backgroundColor: `${suggested.color}15`,
                            }}
                            title="Auto-suggested project based on linked repos"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: suggested.color }}
                            />
                            {suggested.name}
                          </span>
                        )}
                      </div>

                      {/* Commits list — all of them, not truncated */}
                      <ul className="space-y-1 text-[12px]">
                        {cl.commits.map((c) => (
                          <li
                            key={c.sha}
                            className="flex items-baseline gap-2 text-[var(--text-olive)]"
                          >
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[11px] text-[var(--text-forest)] hover:underline shrink-0"
                            >
                              {c.sha.slice(0, 7)}
                            </a>
                            {multiRepo && (
                              <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">
                                [{shortRepo(c.repo)}]
                              </span>
                            )}
                            <span className="truncate">{c.message.split("\n")[0]}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex sm:flex-col items-stretch gap-2 shrink-0 sm:w-[150px]">
                      <button
                        type="button"
                        disabled={isCreating || isDone}
                        onClick={() => createEntry(cl, cl.suggestedProjectId)}
                        className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] text-[12px] font-medium bg-[var(--text-forest)] text-[var(--text-cream)] hover:opacity-90 disabled:opacity-60 transition-opacity"
                      >
                        {isCreating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isDone ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        {isDone ? "Added" : isCreating ? "Adding…" : "Add entry"}
                      </button>
                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => dismissCluster(cl)}
                          className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)] text-[11px] font-medium text-[var(--text-olive)] hover:text-[var(--accent-coral)] hover:bg-[var(--accent-coral)]/8 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
              })}
            </ul>
          )}

          {dismissed.size > 0 && !showDismissed && (
            <p className="text-center text-[12px] text-[var(--text-muted)]">
              {dismissed.size} dismissed ·{" "}
              <button
                type="button"
                onClick={restoreDismissed}
                className="underline hover:text-[var(--text-olive)]"
              >
                restore all
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}

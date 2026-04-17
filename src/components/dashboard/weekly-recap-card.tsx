"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, GitCommit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface WeeklyRecap {
  totalSeconds: number;
  totalEarnings: number;
  totalCommits: number;
  projects: { id: string; name: string; color: string; hours: number; commits: number }[];
  repos: { repo: string; commits: { sha: string; message: string; url: string }[] }[];
  standupText: string;
}

/**
 * Weekly recap card with a one-click "Copy as standup" button. Rendered on
 * the dashboard for anyone with GitHub connected AND at least one commit
 * tracked this week. Silently hides itself otherwise.
 */
export function WeeklyRecapCard() {
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/github/weekly-recap");
      if (r.status === 401 || r.status === 400) {
        setUnavailable(true);
        return;
      }
      if (!r.ok) return;
      const data = (await r.json()) as WeeklyRecap;
      // Hide the card entirely if there's nothing to show
      if (data.totalCommits === 0 && data.totalSeconds === 0) {
        setUnavailable(true);
        return;
      }
      setRecap(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (unavailable) return null;
  if (loading) return null;
  if (!recap) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recap.standupText);
      setCopied(true);
      toast.success("Standup copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Clipboard not available");
    }
  };

  const hours = (recap.totalSeconds / 3600).toFixed(1);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="font-sans text-[15px] font-semibold text-[var(--text-forest)]">
            This week in code
          </CardTitle>
          <p className="text-[12px] text-[var(--text-olive)] mt-0.5 tabular-nums">
            {hours}h · {recap.projects.length} project{recap.projects.length === 1 ? "" : "s"} ·{" "}
            {recap.totalCommits} commit{recap.totalCommits === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)] text-[12px] font-medium bg-[var(--text-forest)] text-[var(--text-cream)] hover:opacity-90 transition-opacity shrink-0"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy as standup"}
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        {recap.repos.length > 0 ? (
          <div className="space-y-2.5">
            {recap.repos.slice(0, 5).map(({ repo, commits }) => (
              <div key={repo}>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-forest)] mb-1.5">
                  <GitCommit className="h-3 w-3 text-[var(--text-olive)]" />
                  <span className="font-mono">{repo}</span>
                  <span className="text-[11px] text-[var(--text-olive)] font-normal">
                    · {commits.length}
                  </span>
                </div>
                <ul className="space-y-1 ml-4">
                  {commits.slice(0, 3).map((c) => (
                    <li key={c.sha} className="text-[12px] text-[var(--text-olive)] truncate">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[var(--text-forest)] transition-colors"
                        title={c.message}
                      >
                        <code className="text-[10px] text-[var(--text-forest)] mr-1.5">
                          {c.sha.slice(0, 7)}
                        </code>
                        {c.message.split("\n")[0]}
                      </a>
                    </li>
                  ))}
                  {commits.length > 3 && (
                    <li className="text-[11px] text-[var(--text-muted)] italic">
                      + {commits.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--text-olive)]">
            Time tracked but no commits attached this week yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

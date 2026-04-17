"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// lucide-react in this project doesn't export `Github`; inline the octocat glyph.
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.648.5.5 5.648.5 12a11.5 11.5 0 008.065 10.97c.585.105.805-.253.805-.562 0-.28-.01-1.014-.015-1.99-3.283.713-3.975-1.58-3.975-1.58-.537-1.363-1.312-1.727-1.312-1.727-1.073-.734.08-.72.08-.72 1.186.084 1.811 1.22 1.811 1.22 1.055 1.806 2.768 1.285 3.442.982.107-.764.412-1.285.75-1.58-2.621-.297-5.38-1.31-5.38-5.83 0-1.288.46-2.34 1.215-3.165-.122-.298-.527-1.498.115-3.123 0 0 .99-.317 3.246 1.209a11.26 11.26 0 015.907 0c2.255-1.526 3.242-1.209 3.242-1.209.645 1.625.24 2.825.118 3.123.757.825 1.213 1.877 1.213 3.165 0 4.533-2.763 5.529-5.394 5.82.424.365.802 1.086.802 2.19 0 1.582-.014 2.855-.014 3.243 0 .312.217.675.81.56A11.5 11.5 0 0023.5 12C23.5 5.648 18.352.5 12 .5z"/>
    </svg>
  );
}

interface GitHubStatus {
  connected: boolean;
  login?: string;
  name?: string | null;
  avatarUrl?: string | null;
  scope?: string;
  connectedAt?: string;
  lastSyncedAt?: string | null;
}

export function GitHubConnectCard() {
  const search = useSearchParams();
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/github/status");
      if (!r.ok) throw new Error();
      setStatus(await r.json());
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Surface the redirect flag from /api/github/callback
  useEffect(() => {
    const flag = search.get("github");
    if (!flag) return;
    if (flag === "connected") {
      toast.success("GitHub connected");
    } else if (flag.startsWith("error-")) {
      const msg = flag.replace("error-", "").replaceAll("-", " ");
      toast.error(`GitHub connection failed: ${msg}`);
    }
    // Clean the URL so refreshing doesn't re-fire the toast
    const url = new URL(window.location.href);
    url.searchParams.delete("github");
    window.history.replaceState({}, "", url.toString());
  }, [search]);

  const handleDisconnect = async () => {
    if (!confirm("Disconnect GitHub? Existing commits on time entries will stay attached.")) {
      return;
    }
    setDisconnecting(true);
    try {
      const r = await fetch("/api/github/disconnect", { method: "POST" });
      if (!r.ok) throw new Error();
      toast.success("GitHub disconnected");
      setStatus({ connected: false });
    } catch {
      toast.error("Couldn't disconnect. Try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card className="overflow-hidden border-none shadow-[var(--shadow-card)] ring-1 ring-[var(--border-subtle)]">
      <CardHeader className="bg-[var(--bg-muted)]/30 border-b border-[var(--border-subtle)] pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-serif text-[var(--text-forest)]">
          <GithubIcon className="size-5 text-[var(--text-olive)]" />
          GitHub
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-[var(--text-olive)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Checking connection…
          </div>
        ) : status?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {status.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={status.avatarUrl}
                  alt=""
                  className="h-10 w-10 rounded-full border border-[var(--border-subtle)]"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-[var(--bg-muted)] flex items-center justify-center">
                  <GithubIcon className="h-5 w-5 text-[var(--text-olive)]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-[var(--text-forest)]">
                  {status.name || status.login}
                </p>
                <a
                  href={`https://github.com/${status.login}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-[var(--text-olive)] hover:text-[var(--text-forest)] transition-colors"
                >
                  @{status.login}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-olive-hover)] bg-[var(--accent-olive-soft)] px-2 py-1 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </span>
            </div>

            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-muted)]/40 text-[12px] text-[var(--text-olive)] leading-relaxed">
              <p className="font-medium text-[var(--text-forest)] mb-1">
                Commits auto-attach to time entries
              </p>
              <p>
                When you stop a timer, BogglTrack fetches commits you authored
                between start and stop across your repositories and attaches
                them to the entry.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center h-9 px-3 rounded-[var(--radius-md)] text-[13px] font-medium text-[var(--text-olive)] hover:text-[var(--accent-coral)] hover:bg-[var(--accent-coral)]/8 transition-colors disabled:opacity-50"
            >
              {disconnecting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : null}
              Disconnect GitHub
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--bg-muted)] flex items-center justify-center shrink-0">
                <GithubIcon className="h-5 w-5 text-[var(--text-olive)]" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-[var(--text-forest)]">
                  Connect GitHub
                </p>
                <p className="text-[12px] text-[var(--text-olive)] leading-relaxed mt-0.5 max-w-[520px]">
                  Let BogglTrack attach your commits to time entries automatically.
                  Start a timer, code, stop the timer — your commits show up on the
                  entry with repo, message, and link.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-muted)]/40 text-[12px] text-[var(--text-olive)] leading-relaxed space-y-2">
              <p className="font-medium text-[var(--text-forest)] flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                What we&apos;ll access
              </p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>Your GitHub username, name, and avatar (<code className="text-[11px]">read:user</code>)</li>
                <li>Commit metadata — sha, message, timestamp, repo name (<code className="text-[11px]">repo</code>)</li>
              </ul>
              <p className="italic">
                We never clone code or store commit contents. Disconnect anytime from this card.
              </p>
            </div>

            <a
              href="/api/github/authorize"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--text-forest)] text-[var(--text-cream)] text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              <GithubIcon className="h-4 w-4" />
              Connect GitHub
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

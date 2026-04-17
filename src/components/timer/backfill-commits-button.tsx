"use client";

import { useState } from "react";
import { GitCommit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { startOfWeek, endOfWeek } from "date-fns";

interface Props {
  /** Called when backfill finishes successfully so the parent can refetch. */
  onComplete?: () => void;
}

/**
 * "Fetch commits for this week" — runs the bulk backfill endpoint against
 * the current week and reloads the entry list. Silently no-ops if GitHub
 * isn't connected yet (the server returns 400 which we surface as a toast).
 */
export function BackfillCommitsButton({ onComplete }: Props) {
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const from = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const to = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const r = await fetch("/api/time-entries/backfill-commits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, onlyMissing: true }),
      });
      if (r.status === 400) {
        const body = await r.json().catch(() => ({}));
        if (body?.error === "not-connected") {
          toast.error("Connect GitHub first in Settings → GitHub");
          return;
        }
      }
      if (!r.ok) {
        toast.error("Couldn't fetch commits");
        return;
      }
      const json = (await r.json()) as {
        scanned: number;
        updated: number;
        commitsAttached: number;
      };
      if (json.updated === 0) {
        toast.success("Everything already has commits attached");
      } else {
        toast.success(
          `Attached ${json.commitsAttached} commits to ${json.updated} ${
            json.updated === 1 ? "entry" : "entries"
          }`
        );
        onComplete?.();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={loading}
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--radius-md)] text-[12px] font-medium text-[var(--text-olive)] hover:text-[var(--text-forest)] hover:bg-[var(--bg-muted)] transition-colors disabled:opacity-60"
      title="Attach GitHub commits for this week's entries"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <GitCommit className="h-3.5 w-3.5" />
      )}
      Fetch commits
    </button>
  );
}

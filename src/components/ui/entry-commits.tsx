"use client";

import { GitCommit, ExternalLink } from "lucide-react";

export interface AttachedCommit {
  sha: string;
  message: string;
  repo: string;
  url: string;
  committedAt: string;
}

interface EntryLike {
  commits?: AttachedCommit[] | null;
}

interface Props {
  entries: EntryLike[];
  /** Max commits to display inline before showing "+N more" chip. */
  maxInline?: number;
}

/**
 * Inline GitHub commit strip shown under a time entry's description.
 * Merges + dedupes commits across all entries in a group (same-description
 * entries can be grouped on the timer page). Renders nothing when there
 * are no commits.
 */
export function EntryCommits({ entries, maxInline = 3 }: Props) {
  const seen = new Set<string>();
  const commits: AttachedCommit[] = [];
  for (const e of entries) {
    if (!Array.isArray(e.commits)) continue;
    for (const c of e.commits) {
      if (seen.has(c.sha)) continue;
      seen.add(c.sha);
      commits.push(c);
    }
  }
  if (commits.length === 0) return null;

  commits.sort(
    (a, b) => new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime()
  );

  const shown = commits.slice(0, maxInline);
  const extra = commits.length - shown.length;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <GitCommit className="h-3 w-3 text-[var(--text-olive)] shrink-0" />
      {shown.map((c) => (
        <a
          key={c.sha}
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="group inline-flex items-center gap-1 max-w-[320px] px-2 py-0.5 rounded-full bg-[var(--bg-muted)] hover:bg-[var(--bg-cream-hover)] text-[11px] text-[var(--text-olive)] hover:text-[var(--text-forest)] transition-colors"
          title={`${c.repo} · ${c.message}`}
        >
          <code className="text-[10px] text-[var(--text-forest)] font-mono shrink-0">
            {c.sha.slice(0, 7)}
          </code>
          <span className="truncate max-w-[200px]">{c.message}</span>
          <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
        </a>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--bg-muted)] text-[11px] text-[var(--text-olive)]">
          +{extra} more
        </span>
      )}
    </div>
  );
}

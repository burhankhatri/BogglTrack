"use client";

import { useState } from "react";
import { GitCommit, ExternalLink, X } from "lucide-react";

export interface AttachedCommit {
  sha: string;
  message: string;
  repo: string;
  url: string;
  committedAt: string;
}

interface EntryLike {
  id?: string;
  commits?: AttachedCommit[] | null;
}

interface Props {
  entries: EntryLike[];
  /** Max commits to display inline before showing "+N more" chip. */
  maxInline?: number;
  onRemoveCommit?: (commit: { entryIds: string[]; sha: string }) => void;
}

interface DisplayCommit extends AttachedCommit {
  entryIds: string[];
}

function CommitChip({
  commit,
  multiRepo,
  shortRepo,
  onRemoveCommit,
}: {
  commit: DisplayCommit;
  multiRepo: boolean;
  shortRepo: (repo: string) => string;
  onRemoveCommit?: Props["onRemoveCommit"];
}) {
  return (
    <span className="group inline-flex items-center max-w-[390px] rounded-full bg-[var(--bg-muted)] hover:bg-[var(--bg-cream-hover)] text-[11px] text-[var(--text-olive)] hover:text-[var(--text-forest)] transition-colors">
      <a
        href={commit.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 min-w-0 px-2 py-0.5"
        title={`${commit.repo} · ${commit.message}`}
      >
        <code className="text-[10px] text-[var(--text-forest)] font-mono shrink-0">
          {commit.sha.slice(0, 7)}
        </code>
        {multiRepo && (
          <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
            {shortRepo(commit.repo)}
          </span>
        )}
        <span className="truncate max-w-[200px]">{commit.message}</span>
        <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
      </a>
      {onRemoveCommit && commit.entryIds.length > 0 && (
        <button
          type="button"
          aria-label={`Remove commit ${commit.sha.slice(0, 7)}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemoveCommit({ entryIds: commit.entryIds, sha: commit.sha });
          }}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-olive)] hover:text-[var(--accent-coral)] transition-colors"
          title="Remove commit from this time entry"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/**
 * Inline GitHub commit strip shown under a time entry's description.
 * Merges + dedupes commits across all entries in a group (same-description
 * entries can be grouped on the timer page). Renders nothing when there
 * are no commits.
 *
 * When commits span more than one repo we prefix each chip with the repo's
 * short name (`name` from `owner/name`) so multi-repo entries are legible
 * at a glance. Single-repo entries stay clean (no prefix).
 */
export function EntryCommits({ entries, maxInline = 3, onRemoveCommit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const bySha = new Map<string, DisplayCommit>();
  for (const e of entries) {
    if (!Array.isArray(e.commits)) continue;
    for (const c of e.commits) {
      const existing = bySha.get(c.sha);
      if (existing) {
        if (e.id && !existing.entryIds.includes(e.id)) {
          existing.entryIds.push(e.id);
        }
        continue;
      }
      bySha.set(c.sha, { ...c, entryIds: e.id ? [e.id] : [] });
    }
  }
  const commits = Array.from(bySha.values());
  if (commits.length === 0) return null;

  commits.sort(
    (a, b) => new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime()
  );

  const repos = new Set<string>();
  for (const c of commits) repos.add(c.repo);
  const multiRepo = repos.size > 1;
  const shortRepo = (r: string) => r.split("/").slice(-1)[0];

  const shown = commits.slice(0, maxInline);
  const hidden = commits.slice(maxInline);
  const extra = commits.length - shown.length;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <GitCommit className="h-3 w-3 text-[var(--text-olive)] shrink-0" />
      {shown.map((c) => (
        <CommitChip
          key={c.sha}
          commit={c}
          multiRepo={multiRepo}
          shortRepo={shortRepo}
          onRemoveCommit={onRemoveCommit}
        />
      ))}
      {extra > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Hide extra commits" : `Show ${extra} more commits`}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((value) => !value);
          }}
          className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--bg-muted)] hover:bg-[var(--bg-cream-hover)] text-[11px] text-[var(--text-olive)] hover:text-[var(--text-forest)] transition-colors"
        >
          {expanded ? "Show less" : `+${extra} more`}
        </button>
      )}
      {expanded && hidden.length > 0 && (
        <div className="basis-full mt-1 ml-5 flex flex-col items-start gap-1">
          {hidden.map((c) => (
            <CommitChip
              key={c.sha}
              commit={c}
              multiRepo={multiRepo}
              shortRepo={shortRepo}
              onRemoveCommit={onRemoveCommit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

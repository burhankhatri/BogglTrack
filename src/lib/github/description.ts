import type { AttachedCommit } from "./commits";

/**
 * Draft a single-line description from a set of commit messages.
 *
 * Strategy:
 *   1. Strip conventional-commit prefixes ("feat:", "fix:", "chore:") so we
 *      don't end up with a sentence that starts with "feat".
 *   2. Dedupe identical or near-identical messages.
 *   3. Join with commas, with an " and " before the last item.
 *   4. If the result would be longer than 80 chars, truncate to the top
 *      3 messages.
 *
 * Returns null if there's nothing usable (zero commits, or all empty).
 */
export function draftDescriptionFromCommits(
  commits: AttachedCommit[]
): string | null {
  if (!commits || commits.length === 0) return null;

  const seen = new Set<string>();
  const phrases: string[] = [];

  for (const c of commits) {
    const raw = (c.message ?? "").split("\n")[0].trim();
    if (!raw) continue;

    // Strip conventional-commit prefix (feat, fix, chore, refactor, test,
    // docs, style, perf, build, ci + optional scope: "feat(auth)" too).
    const stripped = raw
      .replace(/^(feat|fix|chore|refactor|test|docs|style|perf|build|ci|revert)(\([^)]+\))?:\s*/i, "")
      .trim();
    if (!stripped) continue;

    const key = stripped.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    phrases.push(stripped);
  }

  if (phrases.length === 0) return null;

  // Prefer top-3 most recent (commits are sorted newest-first by caller)
  const top = phrases.slice(0, 3);

  // Title-case the first character of the first phrase so the sentence
  // reads as prose
  top[0] = top[0].charAt(0).toUpperCase() + top[0].slice(1);

  let joined: string;
  if (top.length === 1) {
    joined = top[0];
  } else if (top.length === 2) {
    joined = `${top[0]} and ${top[1]}`;
  } else {
    joined = `${top.slice(0, -1).join(", ")}, and ${top[top.length - 1]}`;
  }

  // If it's still too long, hard-truncate.
  if (joined.length > 120) {
    joined = joined.slice(0, 117) + "…";
  }

  return joined;
}

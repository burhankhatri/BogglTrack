// Query the authenticated user's commits across all repos in a time window.
//
// Strategy:
//   1. List recent push activity via /users/{login}/events — this INCLUDES
//      fork pushes and non-default-branch pushes, which the contributions
//      graph excludes (see GitHub docs: "contributions count if made in a
//      standalone repository in the default or gh-pages branch"). Events
//      return the last ~300 actions, which covers day- to week-long windows
//      for almost everyone.
//   2. From PushEvents we extract a deduped set of (repo, branch) pairs —
//      we track BOTH because REST /repos/{owner}/{name}/commits defaults to
//      the default branch when no sha is passed. A feature-branch push would
//      otherwise still be invisible.
//   3. For each (repo, branch), REST
//      /repos/{owner}/{name}/commits?sha=<branch>&since&until
//      and filter client-side by top-level `author.login`. We deliberately
//      do NOT pass `?author=<login>` to GitHub — that filter is broken for
//      commits whose author email is the `<login>@users.noreply.github.com`
//      form (GitHub fails to match them even though `author.login` on the
//      returned commit resolves correctly). Filtering in JS catches every
//      email linked to the user's account.
//
// Why not `contributionsCollection`?
//   It silently drops commits to forks and to non-default branches. We shipped
//   on that assumption and broke for any user whose workflow is fork-based
//   (most OSS contributors) — see the jamesmurdza/daytona case.
//
// We cap at 10 (repo, branch) pairs and 30 commits per entry to keep API
// usage predictable.

import { decryptToken } from "./crypto";

export interface AttachedCommit {
  sha: string;
  message: string;
  repo: string;           // "owner/name"
  url: string;
  committedAt: string;    // ISO
}

interface PushEventLike {
  type: string;
  repo: { name: string };
  created_at: string;
  payload?: { ref?: string };
}

const GH_HEADERS_BASE = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
} as const;

export async function fetchCommitsInWindow(params: {
  encryptedAccessToken: string;
  /** The GitHub login of the account that owns the token. Required because
   *  the events endpoint is keyed by username, and /commits?author= filters
   *  by it. */
  login: string;
  from: Date;
  to: Date;
  /** Optional cap on total commits returned across all repos. */
  maxCommits?: number;
}): Promise<AttachedCommit[]> {
  const max = params.maxCommits ?? 30;
  const token = decryptToken(params.encryptedAccessToken);
  const login = params.login;

  // 1. Discover recently-pushed branches via the events API. Authenticating
  //    as the user means private events surface too, so private-repo pushes
  //    come through.
  const eventsRes = await fetch(
    `https://api.github.com/users/${encodeURIComponent(login)}/events?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        ...GH_HEADERS_BASE,
      },
    }
  );
  if (!eventsRes.ok) {
    throw new Error(`GitHub events failed: ${eventsRes.status}`);
  }
  const events = (await eventsRes.json()) as PushEventLike[];

  // Group pushes by (repo, branch), remembering the most recent push time
  // so we can prioritize the pairs the user was actually just working on.
  interface Pair { repo: string; branch: string; lastPush: number }
  const pushPairs = new Map<string, Pair>();
  for (const ev of events) {
    if (ev.type !== "PushEvent") continue;
    const ref = ev.payload?.ref;
    if (!ref) continue;
    const branch = ref.replace(/^refs\/heads\//, "");
    const key = `${ev.repo.name}#${branch}`;
    const t = new Date(ev.created_at).getTime();
    const prev = pushPairs.get(key);
    if (!prev || t > prev.lastPush) {
      pushPairs.set(key, { repo: ev.repo.name, branch, lastPush: t });
    }
  }
  if (pushPairs.size === 0) return [];

  // Prioritize by recency, cap at 10.
  const topPairs = Array.from(pushPairs.values())
    .sort((a, b) => b.lastPush - a.lastPush)
    .slice(0, 10);

  const since = params.from.toISOString();
  const until = params.to.toISOString();

  // 2. For each (repo, branch) pair, pull commits on that branch in the
  //    window and keep the ones GitHub resolved to THIS user. Dedupe by SHA
  //    across branches — a commit merged into multiple refs shouldn't appear
  //    twice.
  const bySha = new Map<string, AttachedCommit>();
  for (const { repo, branch } of topPairs) {
    if (bySha.size >= max) break;
    const url =
      `https://api.github.com/repos/${repo}/commits` +
      `?sha=${encodeURIComponent(branch)}` +
      `&since=${encodeURIComponent(since)}` +
      `&until=${encodeURIComponent(until)}` +
      `&per_page=30`;
    try {
      const commitsRes = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...GH_HEADERS_BASE,
        },
      });
      if (!commitsRes.ok) continue;
      const commits = (await commitsRes.json()) as Array<{
        sha: string;
        html_url: string;
        commit: {
          message: string;
          author: { date: string; email?: string };
        };
        author: { login: string } | null;
      }>;
      for (const c of commits) {
        if (bySha.size >= max) break;
        if (bySha.has(c.sha)) continue;
        // Keep only commits GitHub resolved to this user's account. This
        // correctly handles both the user's noreply email and their verified
        // primary email, unlike the server-side ?author filter.
        if (c.author?.login !== login) continue;
        bySha.set(c.sha, {
          sha: c.sha,
          message: c.commit.message.split("\n")[0].slice(0, 280),
          repo,
          url: c.html_url,
          committedAt: c.commit.author.date,
        });
      }
    } catch {
      // Skip unreachable repos and keep going
      continue;
    }
  }

  const results = Array.from(bySha.values());

  // Sort newest-first so display is stable.
  results.sort(
    (a, b) => new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime()
  );

  return results;
}

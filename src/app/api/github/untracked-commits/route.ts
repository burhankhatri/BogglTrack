import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrErrorResponse } from "@/lib/user";
import { fetchCommitsInWindow } from "@/lib/github/commits";
import {
  CLUSTER_GAP_MS,
  estimateClusterWindow,
} from "@/lib/github/untracked-estimate";
import { subDays } from "date-fns";

export const dynamic = "force-dynamic";

// GET /api/github/untracked-commits?days=7
// Returns clusters of commits that fall OUTSIDE any of the user's existing
// time entries — i.e. coding the user forgot to track. Clustered by commit
// gap: commits within 30 minutes of each other form a single cluster.
//
// Response: Array<{
//   start, end, durationSeconds, commits: [{sha, message, repo, url, committedAt}],
//   suggestedProjectId?
// }>
export async function GET(req: NextRequest) {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  const account = await prisma.gitHubAccount.findUnique({
    where: { userId: user.id },
    select: { accessToken: true, githubLogin: true },
  });
  if (!account) {
    return NextResponse.json({ error: "not-connected" }, { status: 400 });
  }

  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 7), 1), 30);

  const to = new Date();
  const from = subDays(to, days);

  // 1. Fetch all the user's commits in the window (we already have the helper)
  const commits = await fetchCommitsInWindow({
    encryptedAccessToken: account.accessToken,
    login: account.githubLogin,
    from,
    to,
    maxCommits: 200,
  });
  if (commits.length === 0) return NextResponse.json([]);

  // 2. Fetch existing time entries in the window
  const entries = await prisma.timeEntry.findMany({
    where: {
      userId: user.id,
      endTime: { not: null },
      startTime: { gte: from },
    },
    select: { startTime: true, endTime: true },
  });

  // 3. Drop commits that fall inside any existing entry's window (with a
  //    5-minute fuzz on each side — a commit a couple of minutes before you
  //    hit stop still counts as tracked).
  const FUZZ_MS = 5 * 60 * 1000;
  const isCovered = (committedAt: Date) => {
    const t = committedAt.getTime();
    return entries.some((e) => {
      if (!e.endTime) return false;
      return (
        t >= e.startTime.getTime() - FUZZ_MS &&
        t <= e.endTime.getTime() + FUZZ_MS
      );
    });
  };

  // Merge commits are noise — they represent integration, not work in a
  // focused session. If someone actually wants to track the merge they can
  // still create the entry manually from the commit.
  const isMergeCommit = (message: string) => {
    const first = message.split("\n", 1)[0];
    return (
      /^Merge pull request #\d+/i.test(first) ||
      /^Merge branch ['"]/i.test(first) ||
      /^Merge remote-tracking branch/i.test(first)
    );
  };

  const untracked = commits
    .filter((c) => !isMergeCommit(c.message))
    .map((c) => ({ ...c, at: new Date(c.committedAt) }))
    .filter((c) => !isCovered(c.at))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  if (untracked.length === 0) return NextResponse.json([]);

  // 4. Cluster commits within 30 min of each other.
  interface Cluster {
    start: Date;
    end: Date;
    commits: typeof untracked;
    repos: Set<string>;
  }
  const clusters: Cluster[] = [];
  for (const c of untracked) {
    const last = clusters[clusters.length - 1];
    if (last && c.at.getTime() - last.end.getTime() <= CLUSTER_GAP_MS) {
      last.end = c.at;
      last.commits.push(c);
      last.repos.add(c.repo);
    } else {
      clusters.push({
        start: c.at,
        end: c.at,
        commits: [c],
        repos: new Set([c.repo]),
      });
    }
  }

  // 5. For each cluster, suggest a project based on repo links.
  const repoLinks = await prisma.projectRepo.findMany({
    where: { project: { userId: user.id } },
    select: { projectId: true, repoFullName: true },
  });
  const repoToProject = new Map<string, string>();
  for (const link of repoLinks) repoToProject.set(link.repoFullName, link.projectId);

  // Sorted list of existing entry end times so we can clamp a cluster's
  // ramp-up start so it doesn't bleed into a previously-tracked entry.
  const entryEndsAsc = entries
    .map((e) => e.endTime?.getTime())
    .filter((t): t is number => typeof t === "number")
    .sort((a, b) => a - b);
  const latestEndBefore = (t: number): number | undefined => {
    let result: number | undefined;
    for (const end of entryEndsAsc) {
      if (end < t) result = end;
      else break;
    }
    return result;
  };

  // 6. Shape response. Use estimateClusterWindow to model the unseen
  //    pre-first-commit ramp-up and post-last-commit tail rather than the
  //    old symmetric 5-min pad (which under-counted by ~25-30 min on
  //    typical sessions).
  const response = clusters
    .filter((cl) => cl.commits.length >= 1)
    .map((cl) => {
      const firstCommitMs = cl.start.getTime();
      const earliestStartMs = latestEndBefore(firstCommitMs);
      const est = estimateClusterWindow(
        cl.commits.map((c) => c.at.getTime()),
        { earliestStartMs }
      );
      let suggestedProjectId: string | null = null;
      for (const repo of cl.repos) {
        const pid = repoToProject.get(repo);
        if (pid) {
          suggestedProjectId = pid;
          break;
        }
      }
      return {
        start: new Date(est.startMs).toISOString(),
        end: new Date(est.endMs).toISOString(),
        durationSeconds: est.durationSeconds,
        commits: cl.commits.map(({ at, ...rest }) => rest),
        suggestedProjectId,
      };
    });

  return NextResponse.json(response);
}

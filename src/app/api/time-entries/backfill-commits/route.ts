import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrErrorResponse } from "@/lib/user";
import { fetchCommitsInWindow } from "@/lib/github/commits";
import { matchProjectIdForCommits } from "@/lib/github/match-project";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/time-entries/backfill-commits
// Body: { from: ISO, to: ISO, onlyMissing?: boolean }
// Iterates every completed entry the user has in the window and populates
// commits. `onlyMissing` (default true) skips entries that already have
// commits attached.
export async function POST(req: NextRequest) {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  const body = (await req.json()) as {
    from?: string;
    to?: string;
    onlyMissing?: boolean;
  };
  if (!body.from || !body.to) {
    return NextResponse.json({ error: "missing from/to" }, { status: 400 });
  }
  const onlyMissing = body.onlyMissing ?? true;
  const from = new Date(body.from);
  const to = new Date(body.to);

  const account = await prisma.gitHubAccount.findUnique({
    where: { userId: user.id },
    select: { accessToken: true, githubLogin: true },
  });
  if (!account) {
    return NextResponse.json({ error: "not-connected" }, { status: 400 });
  }

  const entries = await prisma.timeEntry.findMany({
    where: {
      userId: user.id,
      endTime: { not: null, gte: from, lte: to },
      startTime: { gte: from },
    },
    orderBy: { startTime: "asc" },
    take: 200,
  });

  let updated = 0;
  let totalCommits = 0;
  let projectsMatched = 0;
  let failed = 0;
  let skippedAlreadyAttached = 0;
  let emptyFetch = 0;

  for (const entry of entries) {
    if (!entry.endTime) continue;
    if (onlyMissing && Array.isArray(entry.commits) && (entry.commits as unknown[]).length > 0) {
      skippedAlreadyAttached += 1;
      continue;
    }
    try {
      const commits = await fetchCommitsInWindow({
        encryptedAccessToken: account.accessToken,
        login: account.githubLogin,
        from: entry.startTime,
        to: entry.endTime,
      });
      if (commits.length === 0) {
        emptyFetch += 1;
        continue;
      }

      let matched: string | null = null;
      if (!entry.projectId) {
        matched = await matchProjectIdForCommits({
          userId: user.id,
          commits,
        });
      }

      await prisma.timeEntry.update({
        where: { id: entry.id },
        data: {
          commits: commits as object,
          ...(matched ? { projectId: matched } : {}),
        },
      });
      updated += 1;
      totalCommits += commits.length;
      if (matched) projectsMatched += 1;
    } catch (e) {
      console.warn(`[backfill] entry=${entry.id}:`, e);
      failed += 1;
    }
  }

  await prisma.gitHubAccount
    .update({ where: { userId: user.id }, data: { lastSyncedAt: new Date() } })
    .catch(() => undefined);

  return NextResponse.json({
    scanned: entries.length,
    updated,
    commitsAttached: totalCommits,
    projectsMatched,
    failed,
    skippedAlreadyAttached,
    emptyFetch,
  });
}

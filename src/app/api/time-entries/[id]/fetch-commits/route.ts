import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";
import { fetchCommitsInWindow } from "@/lib/github/commits";
import { matchProjectIdForCommits } from "@/lib/github/match-project";

export const dynamic = "force-dynamic";

// POST /api/time-entries/:id/fetch-commits
// Backfills commits on a single entry by re-querying GitHub for the entry's
// time window. Used by the "Fetch commits" button on existing entries.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const entry = await prisma.timeEntry.findFirst({
    where: { id, userId: user.id },
  });
  if (!entry) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (!entry.endTime) {
    return NextResponse.json(
      { error: "entry is still running" },
      { status: 400 }
    );
  }

  const account = await prisma.gitHubAccount.findUnique({
    where: { userId: user.id },
    select: { accessToken: true, githubLogin: true },
  });
  if (!account) {
    return NextResponse.json({ error: "not-connected" }, { status: 400 });
  }

  try {
    const commits = await fetchCommitsInWindow({
      encryptedAccessToken: account.accessToken,
      login: account.githubLogin,
      from: entry.startTime,
      to: entry.endTime,
    });

    let matchedProjectId: string | null = null;
    if (commits.length > 0 && !entry.projectId) {
      matchedProjectId = await matchProjectIdForCommits({
        userId: user.id,
        commits,
      });
    }

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: {
        commits: commits as object,
        ...(matchedProjectId ? { projectId: matchedProjectId } : {}),
      },
      include: {
        project: { include: { client: true } },
        tags: { include: { tag: true } },
      },
    });

    await prisma.gitHubAccount
      .update({ where: { userId: user.id }, data: { lastSyncedAt: new Date() } })
      .catch(() => undefined);

    return NextResponse.json({
      entry: updated,
      commitsAttached: commits.length,
      projectMatched: Boolean(matchedProjectId),
    });
  } catch (e) {
    console.error("[fetch-commits]", e);
    return NextResponse.json({ error: "github-fetch-failed" }, { status: 500 });
  }
}

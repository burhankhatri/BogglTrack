import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrErrorResponse } from "@/lib/user";
import { fetchCommitsInWindow, type AttachedCommit } from "@/lib/github/commits";
import { matchProjectIdForCommits } from "@/lib/github/match-project";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  try {
    const { id } = await params;

    const existing = await prisma.timeEntry.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Time entry not found" },
        { status: 404 }
      );
    }

    if (existing.endTime) {
      return NextResponse.json(
        { error: "Time entry is already stopped" },
        { status: 400 }
      );
    }

    const endTime = new Date();
    const duration = Math.floor(
      (endTime.getTime() - existing.startTime.getTime()) / 1000
    );

    // ---- GitHub commit auto-attach ----
    // If the user has linked GitHub, try to grab commits they authored
    // between start and end. Wrapped in a try+timeout so a GitHub outage
    // never blocks stopping a timer.
    let commits: AttachedCommit[] | null = null;
    try {
      const account = await prisma.gitHubAccount.findUnique({
        where: { userId: user.id },
        select: { accessToken: true, githubLogin: true },
      });
      if (account) {
        commits = await withTimeout(
          fetchCommitsInWindow({
            encryptedAccessToken: account.accessToken,
            login: account.githubLogin,
            from: existing.startTime,
            to: endTime,
          }),
          8_000
        );
        // Best-effort bookkeeping; don't fail on this
        await prisma.gitHubAccount
          .update({
            where: { userId: user.id },
            data: { lastSyncedAt: new Date() },
          })
          .catch(() => undefined);
      }
    } catch (e) {
      console.warn("[stop] commit fetch failed:", e);
      // Leave commits = null — the entry still stops cleanly.
    }

    // If we have commits and the entry has no project yet, auto-assign
    // based on ProjectRepo links. Never overwrite an existing projectId —
    // the user's explicit choice beats our heuristic.
    let matchedProjectId: string | null = null;
    if (commits && commits.length > 0 && !existing.projectId) {
      matchedProjectId = await matchProjectIdForCommits({
        userId: user.id,
        commits,
      });
    }

    const entry = await prisma.timeEntry.update({
      where: { id },
      data: {
        endTime,
        duration,
        ...(commits && commits.length > 0 ? { commits: commits as object } : {}),
        ...(matchedProjectId ? { projectId: matchedProjectId } : {}),
      },
      include: {
        project: {
          include: { client: true },
        },
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Failed to stop time entry:", error);
    return NextResponse.json(
      { error: "Failed to stop time entry" },
      { status: 500 }
    );
  }
}

/** Resolves with the promise's value or rejects after `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

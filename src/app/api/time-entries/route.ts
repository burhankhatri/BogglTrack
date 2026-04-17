import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";
import { fetchCommitsInWindow, type AttachedCommit } from "@/lib/github/commits";
import { matchProjectIdForCommits } from "@/lib/github/match-project";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const projectId = searchParams.get("projectId");
    const clientId = searchParams.get("clientId");
    const tagId = searchParams.get("tagId");
    const billable = searchParams.get("billable");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50") || 50, 200);
    const offset = parseInt(searchParams.get("offset") || "0") || 0;

    const where: Record<string, unknown> = { userId: user.id };

    if (from || to) {
      where.startTime = {};
      if (from) (where.startTime as Record<string, unknown>).gte = new Date(from);
      if (to) (where.startTime as Record<string, unknown>).lte = new Date(to);
    }

    if (projectId) where.projectId = projectId;

    if (clientId) {
      where.project = { clientId };
    }

    if (tagId) {
      where.tags = { some: { tagId } };
    }

    if (billable !== null && billable !== undefined && billable !== "") {
      where.billable = billable === "true";
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        project: {
          include: { client: true },
        },
        tags: {
          include: { tag: true },
        },
      },
      orderBy: { startTime: "desc" },
      take: limit,
      skip: offset,
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Failed to fetch time entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch time entries" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { description, startTime, endTime, projectId, billable, tagIds } = body;

    const startDate = new Date(startTime);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
    }

    if (endTime) {
      const endDate = new Date(endTime);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json({ error: "Invalid endTime" }, { status: 400 });
      }
    }

    let duration: number | null = null;
    if (endTime && startTime) {
      duration = Math.floor(
        (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
      );
    }

    // Auto-apply description rule if no project specified
    let resolvedProjectId = projectId || null;
    if (!resolvedProjectId && description) {
      const rule = await prisma.descriptionRule.findUnique({
        where: {
          description_userId: { description, userId: user.id },
        },
      });
      if (rule) resolvedProjectId = rule.projectId;
    }

    // If this is a completed manual entry (endTime set) and the user has
    // GitHub connected, pull commits for the window. Same path as /stop.
    // Running timers (no endTime yet) skip this — commits fetch when they stop.
    let fetchedCommits: AttachedCommit[] | null = null;
    let autoMatchedProjectId: string | null = null;
    if (endTime) {
      try {
        const account = await prisma.gitHubAccount.findUnique({
          where: { userId: user.id },
          select: { accessToken: true, githubLogin: true },
        });
        if (account) {
          fetchedCommits = await withTimeout(
            fetchCommitsInWindow({
              encryptedAccessToken: account.accessToken,
              login: account.githubLogin,
              from: new Date(startTime),
              to: new Date(endTime),
            }),
            8_000
          );
          if (fetchedCommits.length > 0 && !resolvedProjectId) {
            autoMatchedProjectId = await matchProjectIdForCommits({
              userId: user.id,
              commits: fetchedCommits,
            });
          }
        }
      } catch (e) {
        console.warn("[time-entries POST] commit fetch failed:", e);
      }
    }

    const entry = await prisma.timeEntry.create({
      data: {
        description: description || "",
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        duration,
        projectId: autoMatchedProjectId ?? resolvedProjectId,
        billable: billable ?? true,
        userId: user.id,
        ...(fetchedCommits && fetchedCommits.length > 0
          ? { commits: fetchedCommits as object }
          : {}),
        ...(tagIds && tagIds.length > 0
          ? {
              tags: {
                create: tagIds.map((tagId: string) => ({ tagId })),
              },
            }
          : {}),
      },
      include: {
        project: {
          include: { client: true },
        },
        tags: {
          include: { tag: true },
        },
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Failed to create time entry:", error);
    return NextResponse.json(
      { error: "Failed to create time entry" },
      { status: 500 }
    );
  }
}

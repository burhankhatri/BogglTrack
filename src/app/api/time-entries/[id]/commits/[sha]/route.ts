import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserOrErrorResponse } from "@/lib/user";

interface StoredCommit {
  sha?: unknown;
  [key: string]: unknown;
}

function isStoredCommit(value: unknown): value is StoredCommit {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sha: string }> }
) {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  try {
    const { id, sha } = await params;
    const decodedSha = decodeURIComponent(sha);

    const entry = await prisma.timeEntry.findFirst({
      where: { id, userId: user.id },
    });

    if (!entry) {
      return NextResponse.json(
        { error: "Time entry not found" },
        { status: 404 }
      );
    }

    const commits: StoredCommit[] = [];
    if (Array.isArray(entry.commits)) {
      for (const commit of entry.commits) {
        if (isStoredCommit(commit)) commits.push(commit);
      }
    }
    const nextCommits = commits.filter((commit) => commit.sha !== decodedSha);

    if (nextCommits.length === commits.length) {
      return NextResponse.json(
        { error: "Commit not found on time entry" },
        { status: 404 }
      );
    }

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: { commits: nextCommits as Prisma.InputJsonValue },
      include: {
        project: { include: { client: true } },
        tags: { include: { tag: true } },
      },
    });

    return NextResponse.json({ entry: updated, removed: true });
  } catch (error) {
    console.error("Failed to remove time entry commit:", error);
    return NextResponse.json(
      { error: "Failed to remove commit" },
      { status: 500 }
    );
  }
}

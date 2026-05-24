import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrErrorResponse } from "@/lib/user";
import { draftDescriptionFromCommits } from "@/lib/github/description";

export const dynamic = "force-dynamic";

// POST /api/time-entries/from-commits
// Body: { start, end, commits: AttachedCommit[], projectId?: string }
// Creates a completed time entry stamped with the provided commits, with an
// auto-drafted description from the commit messages. Used by the dashboard
// "Untracked commits" banner to materialize a cluster into an entry.
export async function POST(req: NextRequest) {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  const body = (await req.json()) as {
    start?: string;
    end?: string;
    commits?: {
      sha: string;
      message: string;
      repo: string;
      url: string;
      committedAt: string;
    }[];
    projectId?: string | null;
    description?: string;
  };

  if (!body.start || !body.end || !Array.isArray(body.commits) || body.commits.length === 0) {
    return NextResponse.json({ error: "start, end, commits required" }, { status: 400 });
  }

  const start = new Date(body.start);
  const end = new Date(body.end);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "invalid time range" }, { status: 400 });
  }

  const duration = Math.floor((end.getTime() - start.getTime()) / 1000);

  // Compose a description. Prefer caller-supplied, else auto-draft, else blank.
  const description =
    body.description?.trim() ||
    draftDescriptionFromCommits(body.commits) ||
    "";

  const entry = await prisma.timeEntry.create({
    data: {
      description,
      startTime: start,
      endTime: end,
      duration,
      billable: true,
      userId: user.id,
      projectId: body.projectId || null,
      commits: body.commits as object,
    },
    include: {
      project: { include: { client: true } },
    },
  });

  return NextResponse.json(entry);
}

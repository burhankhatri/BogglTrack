import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";

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

    const entry = await prisma.timeEntry.create({
      data: {
        description: description || "",
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        duration,
        projectId: projectId || null,
        billable: billable ?? true,
        userId: user.id,
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

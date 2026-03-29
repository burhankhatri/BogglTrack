import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser } from "@/lib/user";
import { startOfWeek, endOfWeek, getDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const user = await getDefaultUser();
    const searchParams = request.nextUrl.searchParams;

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const projectIds = searchParams.get("projectIds");

    // Default to current week if not specified
    const now = new Date();
    const weekFrom = from
      ? new Date(from)
      : startOfWeek(now, { weekStartsOn: 1 });
    const weekTo = to
      ? new Date(to)
      : endOfWeek(now, { weekStartsOn: 1 });

    const where: Record<string, unknown> = {
      userId: user.id,
      duration: { not: null },
      startTime: {
        gte: weekFrom,
        lte: weekTo,
      },
    };

    if (projectIds) {
      where.projectId = { in: projectIds.split(",") };
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        project: true,
      },
    });

    // Build grid: projectId -> [mon, tue, wed, thu, fri, sat, sun]
    const projectGrid: Record<
      string,
      {
        projectId: string;
        projectName: string;
        projectColor: string;
        days: number[];
      }
    > = {};

    // Column totals: [mon, tue, wed, thu, fri, sat, sun]
    const columnTotals = [0, 0, 0, 0, 0, 0, 0];

    for (const entry of entries) {
      const projectKey = entry.projectId || "no-project";

      if (!projectGrid[projectKey]) {
        projectGrid[projectKey] = {
          projectId: projectKey,
          projectName: entry.project?.name || "No Project",
          projectColor: entry.project?.color || "#6B7280",
          days: [0, 0, 0, 0, 0, 0, 0],
        };
      }

      // getDay returns 0=Sun, 1=Mon, ..., 6=Sat
      // We want 0=Mon, 1=Tue, ..., 6=Sun
      const jsDay = getDay(entry.startTime);
      const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
      const duration = entry.duration || 0;

      projectGrid[projectKey].days[dayIndex] += duration;
      columnTotals[dayIndex] += duration;
    }

    const grid = Object.values(projectGrid).sort((a, b) =>
      a.projectName.localeCompare(b.projectName)
    );

    return NextResponse.json({
      grid,
      columnTotals,
    });
  } catch (error) {
    console.error("Failed to fetch weekly report:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekly report" },
      { status: 500 }
    );
  }
}

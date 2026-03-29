import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser } from "@/lib/user";
import { getApplicableRate, calculateEarnings } from "@/lib/earnings";

export async function GET(request: NextRequest) {
  try {
    const user = await getDefaultUser();
    const searchParams = request.nextUrl.searchParams;

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const projectIds = searchParams.get("projectIds");
    const clientIds = searchParams.get("clientIds");
    const tagIds = searchParams.get("tagIds");
    const billable = searchParams.get("billable");
    const groupBy = searchParams.get("groupBy") || "project";

    const where: Record<string, unknown> = {
      userId: user.id,
      duration: { not: null },
    };

    if (from || to) {
      where.startTime = {};
      if (from) (where.startTime as Record<string, unknown>).gte = new Date(from);
      if (to) (where.startTime as Record<string, unknown>).lte = new Date(to);
    }

    if (projectIds) {
      where.projectId = { in: projectIds.split(",") };
    }

    if (clientIds) {
      where.project = { clientId: { in: clientIds.split(",") } };
    }

    if (tagIds) {
      where.tags = { some: { tagId: { in: tagIds.split(",") } } };
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
    });

    let overallSeconds = 0;
    let overallEarnings = 0;

    const groups: Record<
      string,
      { id: string; name: string; color?: string; totalSeconds: number; totalEarnings: number }
    > = {};

    for (const entry of entries) {
      const duration = entry.duration || 0;
      const rate = getApplicableRate(
        entry.project?.hourlyRate ?? null,
        user.defaultHourlyRate
      );
      const earnings = calculateEarnings(duration, rate, entry.billable);

      overallSeconds += duration;
      overallEarnings += earnings;

      if (groupBy === "project") {
        const key = entry.projectId || "no-project";
        if (!groups[key]) {
          groups[key] = {
            id: key,
            name: entry.project?.name || "No Project",
            color: entry.project?.color,
            totalSeconds: 0,
            totalEarnings: 0,
          };
        }
        groups[key].totalSeconds += duration;
        groups[key].totalEarnings += earnings;
      } else if (groupBy === "client") {
        const key = entry.project?.clientId || "no-client";
        if (!groups[key]) {
          groups[key] = {
            id: key,
            name: entry.project?.client?.name || "No Client",
            totalSeconds: 0,
            totalEarnings: 0,
          };
        }
        groups[key].totalSeconds += duration;
        groups[key].totalEarnings += earnings;
      } else if (groupBy === "tag") {
        if (entry.tags.length === 0) {
          const key = "no-tag";
          if (!groups[key]) {
            groups[key] = {
              id: key,
              name: "No Tag",
              totalSeconds: 0,
              totalEarnings: 0,
            };
          }
          groups[key].totalSeconds += duration;
          groups[key].totalEarnings += earnings;
        } else {
          for (const timeEntryTag of entry.tags) {
            const key = timeEntryTag.tagId;
            if (!groups[key]) {
              groups[key] = {
                id: key,
                name: timeEntryTag.tag.name,
                color: timeEntryTag.tag.color,
                totalSeconds: 0,
                totalEarnings: 0,
              };
            }
            groups[key].totalSeconds += duration;
            groups[key].totalEarnings += earnings;
          }
        }
      }
    }

    const groupedData = Object.values(groups)
      .map((g) => ({
        ...g,
        totalEarnings: Math.round(g.totalEarnings * 100) / 100,
        percentage:
          overallSeconds > 0
            ? Math.round((g.totalSeconds / overallSeconds) * 10000) / 100
            : 0,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);

    return NextResponse.json({
      groups: groupedData,
      totals: {
        totalSeconds: overallSeconds,
        totalEarnings: Math.round(overallEarnings * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Failed to fetch summary report:", error);
    return NextResponse.json(
      { error: "Failed to fetch summary report" },
      { status: 500 }
    );
  }
}

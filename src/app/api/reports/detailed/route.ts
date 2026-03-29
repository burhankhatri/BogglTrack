import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";
import { getApplicableRate, calculateEarnings } from "@/lib/earnings";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const projectIds = searchParams.get("projectIds");
    const clientIds = searchParams.get("clientIds");
    const tagIds = searchParams.get("tagIds");
    const billable = searchParams.get("billable");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50") || 50, 200);
    const offset = parseInt(searchParams.get("offset") || "0") || 0;

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

    const [entries, totalCount] = await Promise.all([
      prisma.timeEntry.findMany({
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
      }),
      prisma.timeEntry.count({ where }),
    ]);

    const entriesWithEarnings = entries.map((entry) => {
      const duration = entry.duration || 0;
      const rate = getApplicableRate(
        entry.project?.hourlyRate ?? null,
        user.defaultHourlyRate
      );
      const earnings = calculateEarnings(duration, rate, entry.billable);

      return {
        ...entry,
        earnings: Math.round(earnings * 100) / 100,
        rate,
      };
    });

    return NextResponse.json({
      entries: entriesWithEarnings,
      totalCount,
    });
  } catch (error) {
    console.error("Failed to fetch detailed report:", error);
    return NextResponse.json(
      { error: "Failed to fetch detailed report" },
      { status: 500 }
    );
  }
}

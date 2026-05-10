import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrErrorResponse } from "@/lib/user";
import { getApplicableRate, calculateEarnings } from "@/lib/earnings";

export async function GET(request: NextRequest) {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  try {
    const searchParams = request.nextUrl.searchParams;

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const projectId = searchParams.get("projectId");
    const clientId = searchParams.get("clientId");
    const uninvoicedOnly = searchParams.get("uninvoicedOnly") !== "false";

    const where: Record<string, unknown> = {
      userId: user.id,
      duration: { not: null },
      billable: true,
    };

    if (uninvoicedOnly) {
      where.invoiceId = null;
    }

    if (from || to) {
      where.startTime = {};
      if (from) (where.startTime as Record<string, unknown>).gte = new Date(from);
      if (to) (where.startTime as Record<string, unknown>).lte = new Date(to);
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (clientId) {
      where.project = { clientId };
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
    console.error("Failed to fetch preview entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch preview entries" },
      { status: 500 }
    );
  }
}

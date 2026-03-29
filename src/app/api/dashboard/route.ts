import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";
import { getApplicableRate, calculateEarnings } from "@/lib/earnings";
import { startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const thirtyDaysAgo = subDays(todayStart, 29);

    // Fetch all entries from the last 30 days with project info
    const recentTimeEntries = await prisma.timeEntry.findMany({
      where: {
        userId: user.id,
        startTime: { gte: thirtyDaysAgo },
        duration: { not: null },
      },
      include: {
        project: true,
      },
      orderBy: { startTime: "desc" },
    });

    // Today
    let todaySeconds = 0;
    let todayEarnings = 0;
    // This week
    let weekSeconds = 0;
    let weekEarnings = 0;
    // This month
    let monthSeconds = 0;
    let monthEarnings = 0;

    // Earnings trend: last 30 days
    const earningsByDate: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = subDays(todayStart, 29 - i);
      const key = d.toISOString().split("T")[0];
      earningsByDate[key] = 0;
    }

    // Top projects accumulator
    const projectStats: Record<
      string,
      { id: string; name: string; color: string; totalSeconds: number; totalEarnings: number }
    > = {};

    for (const entry of recentTimeEntries) {
      const duration = entry.duration || 0;
      const rate = getApplicableRate(
        entry.project?.hourlyRate ?? null,
        user.defaultHourlyRate
      );
      const earnings = calculateEarnings(duration, rate, entry.billable);
      const entryDate = entry.startTime;
      const dateKey = startOfDay(entryDate).toISOString().split("T")[0];

      // Earnings trend
      if (earningsByDate[dateKey] !== undefined) {
        earningsByDate[dateKey] += earnings;
      }

      // Today
      if (entryDate >= todayStart) {
        todaySeconds += duration;
        todayEarnings += earnings;
      }

      // This week
      if (entryDate >= weekStart) {
        weekSeconds += duration;
        weekEarnings += earnings;
      }

      // This month
      if (entryDate >= monthStart) {
        monthSeconds += duration;
        monthEarnings += earnings;
      }

      // Top projects
      if (entry.project) {
        if (!projectStats[entry.project.id]) {
          projectStats[entry.project.id] = {
            id: entry.project.id,
            name: entry.project.name,
            color: entry.project.color,
            totalSeconds: 0,
            totalEarnings: 0,
          };
        }
        projectStats[entry.project.id].totalSeconds += duration;
        projectStats[entry.project.id].totalEarnings += earnings;
      }
    }

    // Active projects count
    const activeProjects = await prisma.project.count({
      where: { userId: user.id, status: "active" },
    });

    // Recent entries (last 5)
    const recentEntries = await prisma.timeEntry.findMany({
      where: { userId: user.id },
      include: {
        project: {
          include: { client: true },
        },
        tags: {
          include: { tag: true },
        },
      },
      orderBy: { startTime: "desc" },
      take: 5,
    });

    // Earnings trend array
    const earningsTrend = Object.entries(earningsByDate).map(([date, earnings]) => ({
      date,
      earnings: Math.round(earnings * 100) / 100,
    }));

    // Top 5 projects by duration
    const topProjects = Object.values(projectStats)
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        hours: p.totalSeconds,
        earnings: Math.round(p.totalEarnings * 100) / 100,
      }));

    return NextResponse.json({
      today: {
        hours: todaySeconds,
        earnings: Math.round(todayEarnings * 100) / 100,
      },
      thisWeek: {
        hours: weekSeconds,
        earnings: Math.round(weekEarnings * 100) / 100,
      },
      thisMonth: {
        hours: monthSeconds,
        earnings: Math.round(monthEarnings * 100) / 100,
      },
      activeProjects,
      recentEntries,
      earningsTrend,
      topProjects,
    });
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

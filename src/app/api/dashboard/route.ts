import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/user";
import { startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";

interface PeriodAgg {
  total_seconds: number | null;
  total_earnings: number | null;
}

interface DailyTrend {
  day: Date | string;
  earnings: number;
}

interface ProjectAgg {
  id: string;
  name: string;
  color: string;
  total_seconds: number;
  total_earnings: number;
}

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
    const defaultRate = user.defaultHourlyRate;

    const [periodStats, earningsTrendRaw, topProjectsRaw, activeProjects, recentEntries] =
      await Promise.all([
        // 1. Time-period aggregations (today/week/month) in one query
        prisma.$queryRaw<PeriodAgg[]>`
          SELECT
            SUM(CASE WHEN "startTime" >= ${todayStart} THEN duration ELSE 0 END) as total_seconds,
            SUM(CASE WHEN "startTime" >= ${todayStart} AND billable THEN duration * COALESCE(p."hourlyRate", ${defaultRate}) / 3600.0 ELSE 0 END) as total_earnings
          FROM "TimeEntry" te
          LEFT JOIN "Project" p ON te."projectId" = p.id
          WHERE te."userId" = ${user.id} AND te.duration IS NOT NULL AND te."startTime" >= ${monthStart}
        `.then(async (todayRow) => {
          const [weekRow, monthRow] = await Promise.all([
            prisma.$queryRaw<PeriodAgg[]>`
              SELECT
                SUM(duration) as total_seconds,
                SUM(CASE WHEN billable THEN duration * COALESCE(p."hourlyRate", ${defaultRate}) / 3600.0 ELSE 0 END) as total_earnings
              FROM "TimeEntry" te
              LEFT JOIN "Project" p ON te."projectId" = p.id
              WHERE te."userId" = ${user.id} AND te.duration IS NOT NULL AND te."startTime" >= ${weekStart}
            `,
            prisma.$queryRaw<PeriodAgg[]>`
              SELECT
                SUM(duration) as total_seconds,
                SUM(CASE WHEN billable THEN duration * COALESCE(p."hourlyRate", ${defaultRate}) / 3600.0 ELSE 0 END) as total_earnings
              FROM "TimeEntry" te
              LEFT JOIN "Project" p ON te."projectId" = p.id
              WHERE te."userId" = ${user.id} AND te.duration IS NOT NULL AND te."startTime" >= ${monthStart}
            `,
          ]);
          return { today: todayRow[0], week: weekRow[0], month: monthRow[0] };
        }),

        // 2. Earnings trend: daily for last 30 days
        prisma.$queryRaw<DailyTrend[]>`
          SELECT
            DATE("startTime") as day,
            SUM(CASE WHEN billable THEN duration * COALESCE(p."hourlyRate", ${defaultRate}) / 3600.0 ELSE 0 END) as earnings
          FROM "TimeEntry" te
          LEFT JOIN "Project" p ON te."projectId" = p.id
          WHERE te."userId" = ${user.id} AND te.duration IS NOT NULL AND te."startTime" >= ${thirtyDaysAgo}
          GROUP BY DATE("startTime")
          ORDER BY day
        `,

        // 3. Top projects by duration (last 30 days)
        prisma.$queryRaw<ProjectAgg[]>`
          SELECT
            p.id, p.name, p.color,
            SUM(te.duration) as total_seconds,
            SUM(CASE WHEN te.billable THEN te.duration * COALESCE(p."hourlyRate", ${defaultRate}) / 3600.0 ELSE 0 END) as total_earnings
          FROM "TimeEntry" te
          JOIN "Project" p ON te."projectId" = p.id
          WHERE te."userId" = ${user.id} AND te.duration IS NOT NULL AND te."startTime" >= ${thirtyDaysAgo}
          GROUP BY p.id, p.name, p.color
          ORDER BY total_seconds DESC
          LIMIT 5
        `,

        // 4. Active projects count
        prisma.project.count({
          where: { userId: user.id, status: "active" },
        }),

        // 5. Recent entries (last 5)
        prisma.timeEntry.findMany({
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
        }),
      ]);

    // Build earnings trend with zero-filled days
    const trendMap = new Map(
      earningsTrendRaw.map((r) => [
        r.day instanceof Date
          ? r.day.toISOString().split("T")[0]
          : String(r.day),
        Math.round(Number(r.earnings) * 100) / 100,
      ])
    );
    const earningsTrend = [];
    for (let i = 0; i < 30; i++) {
      const d = subDays(todayStart, 29 - i);
      const key = d.toISOString().split("T")[0];
      earningsTrend.push({ date: key, earnings: trendMap.get(key) ?? 0 });
    }

    const topProjects = topProjectsRaw.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      hours: Number(p.total_seconds),
      earnings: Math.round(Number(p.total_earnings) * 100) / 100,
    }));

    const toSeconds = (v: number | null) => Number(v ?? 0);
    const toEarnings = (v: number | null) => Math.round((Number(v) || 0) * 100) / 100;

    return NextResponse.json({
      today: {
        hours: toSeconds(periodStats.today.total_seconds),
        earnings: toEarnings(periodStats.today.total_earnings),
      },
      thisWeek: {
        hours: toSeconds(periodStats.week.total_seconds),
        earnings: toEarnings(periodStats.week.total_earnings),
      },
      thisMonth: {
        hours: toSeconds(periodStats.month.total_seconds),
        earnings: toEarnings(periodStats.month.total_earnings),
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

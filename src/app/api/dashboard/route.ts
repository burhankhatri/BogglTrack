import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrErrorResponse } from "@/lib/user";
import { startOfDay, startOfWeek, startOfMonth, subDays, differenceInDays } from "date-fns";

interface PeriodAgg {
  total_seconds: number | null;
  total_earnings: number | null;
}

interface DailyTrend {
  day: Date | string;
  earnings: number;
}

interface EntityAgg {
  id: string;
  name: string;
  color: string;
  total_seconds: number;
  total_earnings: number;
  commit_count: number;
}

// Stable color from a client id — clients don't have a color column. HSL with
// hash-based hue keeps it deterministic across reloads.
function colorForClient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 45% 45%)`;
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const groupBy = url.searchParams.get("groupBy") === "client" ? "client" : "project";

  try {
    const now = new Date();
    const todayStart = startOfDay(now);

    // Custom range — drives the four summary cards AND the trend chart AND the
    // top entities aggregation. When absent, fall back to fixed windows
    // (today / this week / this month / last 30d) so the default render is
    // identical to the original endpoint.
    const customFrom = fromParam ? new Date(fromParam) : null;
    const customTo = toParam ? new Date(toParam) : null;
    const usingCustomRange =
      customFrom !== null &&
      customTo !== null &&
      !isNaN(customFrom.getTime()) &&
      !isNaN(customTo.getTime());

    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const thirtyDaysAgo = subDays(todayStart, 29);
    const defaultRate = user.defaultHourlyRate;

    // Window used for trend + top entities. For custom range we use the supplied
    // range. For default behavior we use last 30 days. The trend bucket count
    // adapts so the chart never collapses into 1 bar or balloons to 1000.
    const aggFrom = usingCustomRange ? customFrom! : thirtyDaysAgo;
    const aggTo = usingCustomRange ? customTo! : now;

    const [periodStats, earningsTrendRaw, topEntitiesRaw, activeProjects, recentEntries] =
      await Promise.all([
        // 1. Time-period aggregations.
        //   - Custom range collapses today/week/month into the SAME number
        //     (the chosen range), so all four summary cards still get a value.
        //   - Default behavior preserves the original today/week/month split.
        usingCustomRange
          ? prisma.$queryRaw<PeriodAgg[]>`
              SELECT
                SUM(duration) as total_seconds,
                SUM(CASE WHEN billable THEN duration * COALESCE(p."hourlyRate", ${defaultRate}) / 3600.0 ELSE 0 END) as total_earnings
              FROM "TimeEntry" te
              LEFT JOIN "Project" p ON te."projectId" = p.id
              WHERE te."userId" = ${user.id}
                AND te.duration IS NOT NULL
                AND te."startTime" >= ${customFrom!}
                AND te."startTime" <= ${customTo!}
            `.then((row) => ({ today: row[0], week: row[0], month: row[0] }))
          : prisma.$queryRaw<PeriodAgg[]>`
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

        // 2. Earnings trend over the active window.
        prisma.$queryRaw<DailyTrend[]>`
          SELECT
            DATE("startTime") as day,
            SUM(CASE WHEN billable THEN duration * COALESCE(p."hourlyRate", ${defaultRate}) / 3600.0 ELSE 0 END) as earnings
          FROM "TimeEntry" te
          LEFT JOIN "Project" p ON te."projectId" = p.id
          WHERE te."userId" = ${user.id}
            AND te.duration IS NOT NULL
            AND te."startTime" >= ${aggFrom}
            AND te."startTime" <= ${aggTo}
          GROUP BY DATE("startTime")
          ORDER BY day
        `,

        // 3. Top entities — projects or clients depending on groupBy.
        groupBy === "client"
          ? prisma.$queryRaw<EntityAgg[]>`
              SELECT
                c.id, c.name, '' as color,
                SUM(te.duration) as total_seconds,
                SUM(CASE WHEN te.billable THEN te.duration * COALESCE(p."hourlyRate", ${defaultRate}) / 3600.0 ELSE 0 END) as total_earnings,
                COALESCE(SUM(CASE WHEN te.commits IS NOT NULL THEN jsonb_array_length(te.commits) ELSE 0 END), 0) as commit_count
              FROM "TimeEntry" te
              JOIN "Project" p ON te."projectId" = p.id
              JOIN "Client" c ON p."clientId" = c.id
              WHERE te."userId" = ${user.id}
                AND te.duration IS NOT NULL
                AND te."startTime" >= ${aggFrom}
                AND te."startTime" <= ${aggTo}
              GROUP BY c.id, c.name
              ORDER BY total_seconds DESC
              LIMIT 5
            `
          : prisma.$queryRaw<EntityAgg[]>`
              SELECT
                p.id, p.name, p.color,
                SUM(te.duration) as total_seconds,
                SUM(CASE WHEN te.billable THEN te.duration * COALESCE(p."hourlyRate", ${defaultRate}) / 3600.0 ELSE 0 END) as total_earnings,
                COALESCE(SUM(CASE WHEN te.commits IS NOT NULL THEN jsonb_array_length(te.commits) ELSE 0 END), 0) as commit_count
              FROM "TimeEntry" te
              JOIN "Project" p ON te."projectId" = p.id
              WHERE te."userId" = ${user.id}
                AND te.duration IS NOT NULL
                AND te."startTime" >= ${aggFrom}
                AND te."startTime" <= ${aggTo}
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
          },
          orderBy: { startTime: "desc" },
          take: 5,
        }),
      ]);

    // Build zero-filled day-by-day trend. Window length is dynamic: 30 days
    // for default, or the actual span for custom ranges (clamped to 365 so
    // multi-year ranges don't generate 1000s of bars).
    const trendDays = usingCustomRange
      ? Math.min(Math.max(differenceInDays(aggTo, aggFrom) + 1, 1), 365)
      : 30;
    const trendStart = usingCustomRange ? startOfDay(aggFrom) : thirtyDaysAgo;
    const trendMap = new Map(
      earningsTrendRaw.map((r) => [
        r.day instanceof Date
          ? r.day.toISOString().split("T")[0]
          : String(r.day),
        Math.round(Number(r.earnings) * 100) / 100,
      ])
    );
    const earningsTrend = [];
    for (let i = 0; i < trendDays; i++) {
      const d = new Date(trendStart);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split("T")[0];
      earningsTrend.push({ date: key, earnings: trendMap.get(key) ?? 0 });
    }

    const topProjects = topEntitiesRaw.map((p) => ({
      id: p.id,
      name: p.name,
      color: groupBy === "client" ? colorForClient(p.id) : p.color,
      hours: Number(p.total_seconds),
      earnings: Math.round(Number(p.total_earnings) * 100) / 100,
      commitCount: Number(p.commit_count),
    }));

    const totalCommits30d = topProjects.reduce((s, p) => s + p.commitCount, 0);

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
      totalCommits30d,
      recentEntries,
      earningsTrend,
      topProjects,
      groupBy,
      rangeFrom: usingCustomRange ? aggFrom.toISOString() : null,
      rangeTo: usingCustomRange ? aggTo.toISOString() : null,
    });
  } catch (err) {
    console.error("Failed to fetch dashboard data:", err);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

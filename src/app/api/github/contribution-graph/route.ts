import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrErrorResponse } from "@/lib/user";
import { subDays, startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

interface DayCell {
  date: string;           // yyyy-MM-dd (in the user's local sense; server uses UTC here)
  commits: number;
  seconds: number;
}

// GET /api/github/contribution-graph?days=84
// Returns per-day commit counts + tracked seconds for a heatmap.
// `commits` counted from TimeEntry.commits JSON — cheap, no GitHub roundtrip.
export async function GET(req: NextRequest) {
  const { user, error } = await requireUserOrErrorResponse();
  if (error) return error;

  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 84), 30), 365);
  const end = startOfDay(new Date());
  const start = subDays(end, days - 1);

  const entries = await prisma.timeEntry.findMany({
    where: {
      userId: user.id,
      endTime: { not: null },
      startTime: { gte: start },
    },
    select: {
      startTime: true,
      duration: true,
      commits: true,
    },
  });

  // Seed every day with zero so the heatmap is continuous.
  const map = new Map<string, DayCell>();
  for (let i = 0; i < days; i++) {
    const d = subDays(end, days - 1 - i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { date: key, commits: 0, seconds: 0 });
  }

  for (const e of entries) {
    const key = e.startTime.toISOString().slice(0, 10);
    const cell = map.get(key);
    if (!cell) continue;
    cell.seconds += e.duration ?? 0;
    if (Array.isArray(e.commits)) {
      cell.commits += (e.commits as unknown[]).length;
    }
  }

  const cells = Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1));

  return NextResponse.json({
    start: start.toISOString(),
    end: end.toISOString(),
    days: cells,
  });
}

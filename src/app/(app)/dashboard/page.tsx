"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Clock, Calendar, TrendingUp, FolderKanban, GitCommit } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UntrackedCommitsBanner } from "@/components/dashboard/untracked-commits-banner";
import { WeeklyRecapCard } from "@/components/dashboard/weekly-recap-card";
import { ContributionGraph } from "@/components/dashboard/contribution-graph";
import { DashboardCalendar } from "@/components/dashboard/dashboard-calendar";
import {
  DateRangePicker,
  rangeFromPreset,
  type DateRange,
} from "@/components/dashboard/date-range-picker";
import { TimeEntryRow } from "@/components/ui/time-entry-row";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatCard } from "@/components/ui/stat-card";
import { formatDuration, formatHours, formatCurrency } from "@/lib/earnings";
import { resumeTimerOptimistic } from "@/lib/timer-actions";
import { format } from "date-fns";

type GroupBy = "project" | "client";

interface DashboardData {
  today: { hours: number; earnings: number };
  thisWeek: { hours: number; earnings: number };
  thisMonth: { hours: number; earnings: number };
  activeProjects: number;
  totalCommits30d: number;
  recentEntries: RecentEntry[];
  earningsTrend: { date: string; earnings: number }[];
  topProjects: {
    id: string;
    name: string;
    color: string;
    hours: number;
    earnings: number;
    commitCount: number;
  }[];
  groupBy: GroupBy;
  rangeFrom: string | null;
  rangeTo: string | null;
}

interface RecentEntry {
  id: string;
  description: string | null;
  startTime: string;
  duration: number | null;
  billable: boolean;
  projectId: string | null;
  project: {
    id: string;
    name: string;
    color: string;
    hourlyRate: number | null;
    client: { id: string; name: string } | null;
  } | null;
}

const DEFAULT_RANGE: DateRange = { preset: "30d", from: null, to: null };

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [groupBy, setGroupBy] = useState<GroupBy>("project");

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      const params = new URLSearchParams();
      params.set("groupBy", groupBy);
      if (range.preset === "custom" && range.from && range.to) {
        params.set("from", range.from.toISOString());
        params.set("to", range.to.toISOString());
      } else if (
        range.preset !== "30d" &&
        range.preset !== "all" &&
        range.preset !== "custom"
      ) {
        const r = rangeFromPreset(range.preset);
        if (r.from && r.to) {
          params.set("from", r.from.toISOString());
          params.set("to", r.to.toISOString());
        }
      } else if (range.preset === "all") {
        // All-time = explicit huge range, since the API treats "no range"
        // as the default 30-day window.
        params.set("from", new Date(2000, 0, 1).toISOString());
        params.set("to", new Date().toISOString());
      }
      try {
        const r = await fetch(`/api/dashboard?${params.toString()}`);
        if (r.ok) setData(await r.json());
      } finally {
        setLoading(false);
      }
    },
    [groupBy, range]
  );

  useEffect(() => {
    load();
    const refresh = () => load(true);
    window.addEventListener("timer-entry-confirmed", refresh);
    window.addEventListener("timer-entry-completed", refresh);
    return () => {
      window.removeEventListener("timer-entry-confirmed", refresh);
      window.removeEventListener("timer-entry-completed", refresh);
    };
  }, [load]);

  const handleResume = (entry: RecentEntry) => {
    resumeTimerOptimistic(
      {
        description: entry.description || "",
        projectId: entry.projectId,
        billable: entry.billable,
        project: entry.project,
      },
      0
    );
  };

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-olive)]">
        Failed to load dashboard data.
      </div>
    );
  }

  const usingCustomRange = data.rangeFrom !== null;
  const maxProjectHours =
    data.topProjects.length > 0
      ? Math.max(...data.topProjects.map((p) => p.hours))
      : 1;

  const groupLabel = data.groupBy === "client" ? "Top clients" : "Top projects";
  const trendLabel = usingCustomRange ? "Earnings" : "Earnings — last 30 days";

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto">
      {/* Page header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-sans text-[32px] md:text-[36px] font-semibold tracking-tight text-[var(--text-forest)] leading-none">
            Dashboard
          </h1>
          <p className="text-[14px] text-[var(--text-olive)]">
            An overview of your time and earnings.
          </p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </header>

      <UntrackedCommitsBanner />

      {/* Summary Cards — collapse to a single "Selected range" card when a
          non-default range is active, since today/week/month no longer apply
          when the user is looking at e.g. "last 7 days" or a custom span. */}
      {usingCustomRange ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            icon={<Clock className="size-4" />}
            label="Hours in range"
            hours={data.thisMonth.hours}
            earnings={data.thisMonth.earnings}
          />
          <StatCard
            icon={<FolderKanban className="size-4" />}
            title="Active Projects"
            muted={data.activeProjects === 0}
            value={
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] font-semibold">{data.activeProjects}</span>
                <span className="text-[12px] font-medium text-[var(--text-olive)] tracking-normal normal-case">
                  {data.totalCommits30d > 0
                    ? `· ${data.totalCommits30d} commit${data.totalCommits30d === 1 ? "" : "s"}`
                    : "active"}
                </span>
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={<Clock className="size-4" />}
            label="Today"
            hours={data.today.hours}
            earnings={data.today.earnings}
          />
          <SummaryCard
            icon={<Calendar className="size-4" />}
            label="This Week"
            hours={data.thisWeek.hours}
            earnings={data.thisWeek.earnings}
          />
          <SummaryCard
            icon={<TrendingUp className="size-4" />}
            label="This Month"
            hours={data.thisMonth.hours}
            earnings={data.thisMonth.earnings}
          />
          <StatCard
            icon={<FolderKanban className="size-4" />}
            title="Active Projects"
            muted={data.activeProjects === 0}
            value={
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] font-semibold">{data.activeProjects}</span>
                <span className="text-[12px] font-medium text-[var(--text-olive)] tracking-normal normal-case">
                  {data.totalCommits30d > 0
                    ? `· ${data.totalCommits30d} commit${data.totalCommits30d === 1 ? "" : "s"} · 30d`
                    : "active"}
                </span>
              </div>
            }
          />
        </div>
      )}

      {/* Earnings Trend + Top Entities */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-sans text-[15px] font-semibold text-[var(--text-forest)]">
              {trendLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.earningsTrend} barCategoryGap={2}>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val: string) => format(new Date(val + "T00:00:00"), "MMM d")}
                    tick={{ fill: "var(--text-olive)", fontSize: 11, fontFamily: "Inter" }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tickFormatter={(val: number) => `$${val}`}
                    tick={{ fill: "var(--text-olive)", fontSize: 11, fontFamily: "Inter" }}
                    axisLine={false}
                    tickLine={false}
                    dx={-6}
                    width={48}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--bg-muted)", opacity: 0.6 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-[var(--radius-md)] bg-[var(--bg-cream)] px-3 py-2 shadow-[var(--shadow-dropdown)]">
                          <p className="text-[11px] font-medium text-[var(--text-olive)] mb-0.5">
                            {format(new Date(label + "T00:00:00"), "MMM d, yyyy")}
                          </p>
                          <p className="text-[14px] font-semibold text-[var(--text-forest)] tabular-nums">
                            {formatCurrency(payload[0].value as number)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="earnings"
                    fill="var(--accent-olive)"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Entities — group-by toggle in the header */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="font-sans text-[15px] font-semibold text-[var(--text-forest)]">
              {groupLabel}
            </CardTitle>
            <div className="flex items-center gap-1 p-0.5 rounded-full bg-[var(--bg-muted)]">
              {(["project", "client"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupBy(g)}
                  className={`h-6 px-2.5 rounded-full text-[11px] font-medium capitalize transition-colors ${
                    groupBy === g
                      ? "bg-[var(--text-forest)] text-[var(--text-cream)]"
                      : "text-[var(--text-olive)] hover:text-[var(--text-forest)]"
                  }`}
                >
                  {g}s
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {data.topProjects.length === 0 ? (
              <p className="text-sm text-[var(--text-olive)]">No data yet.</p>
            ) : (
              <div className="space-y-5 mt-1">
                {data.topProjects.map((entity) => (
                  <div key={entity.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: entity.color }}
                        />
                        <span className="font-medium text-[var(--text-forest)] truncate">
                          {entity.name}
                        </span>
                        {entity.commitCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full bg-[var(--bg-muted)] text-[10px] font-medium text-[var(--text-olive)] tabular-nums"
                            title={`${entity.commitCount} commit${entity.commitCount === 1 ? "" : "s"}`}
                          >
                            <GitCommit className="h-2.5 w-2.5" />
                            {entity.commitCount}
                          </span>
                        )}
                      </div>
                      <div className="text-right text-[12px] font-medium text-[var(--text-olive)] tabular-nums shrink-0">
                        <span>{formatHours(entity.hours)}</span>
                        <span className="ml-2 text-[var(--text-forest)]">
                          {formatCurrency(entity.earnings)}
                        </span>
                      </div>
                    </div>
                    <ProgressBar
                      value={entity.hours}
                      max={maxProjectHours}
                      className="h-1"
                      indicatorClass=""
                      style={{ "--accent-olive": entity.color } as React.CSSProperties}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contribution graph + Weekly recap */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ContributionGraph />
        <WeeklyRecapCard />
      </div>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-[15px] font-semibold text-[var(--text-forest)]">
            Recent entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentEntries.length === 0 ? (
            <p className="text-sm text-[var(--text-olive)]">No time entries yet. Start tracking!</p>
          ) : (
            <div className="flex flex-col">
              {data.recentEntries.map((entry) => {
                const duration = entry.duration || 0;
                return (
                  <TimeEntryRow
                    key={entry.id}
                    description={entry.description || ""}
                    projectName={entry.project?.name}
                    projectColor={entry.project?.color}
                    duration={formatDuration(duration)}
                    onPlay={() => handleResume(entry)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar — the old /calendar page lives here now. Schedule-X event
          view with month / week / day / agenda. */}
      <DashboardCalendar />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  hours,
  earnings,
}: {
  icon: React.ReactNode;
  label: string;
  hours: number;
  earnings: number;
}) {
  const isEmpty = hours === 0 && earnings === 0;
  return (
    <StatCard
      icon={icon}
      title={label}
      muted={isEmpty}
      value={
        <div>
          <div
            className={
              isEmpty
                ? "text-[28px] font-semibold text-[var(--text-muted)]"
                : "text-[28px] font-semibold text-[var(--text-forest)]"
            }
          >
            {formatHours(hours)}
          </div>
          <p
            className={
              isEmpty
                ? "text-[12px] font-medium text-[var(--text-muted)] mt-1 tabular-nums tracking-normal normal-case"
                : "text-[12px] font-medium text-[var(--text-olive)] mt-1 tabular-nums tracking-normal normal-case"
            }
          >
            {formatCurrency(earnings)}
          </p>
        </div>
      }
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 max-w-[1200px] mx-auto">
      <Skeleton className="h-9 w-40 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24 rounded-md" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-3 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-48 rounded-md" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32 rounded-md" />
          </CardHeader>
          <CardContent className="space-y-6 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px] w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

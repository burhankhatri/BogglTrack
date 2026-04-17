"use client";

import { useEffect } from "react";
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
import { TimeEntryRow } from "@/components/ui/time-entry-row";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatCard } from "@/components/ui/stat-card";
import { formatDuration, formatHours, formatCurrency } from "@/lib/earnings";
import { useAppStore } from "@/stores/app-store";
import { resumeTimerOptimistic } from "@/lib/timer-actions";
import { format } from "date-fns";

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
  tags: { tagId: string; tag: { id: string; name: string; color: string } }[];
}

export default function DashboardPage() {
  const data = useAppStore((s) => s.dashboard.data);
  const loading = useAppStore((s) => s.dashboard.loading) && !data;
  const fetchDashboard = useAppStore((s) => s.fetchDashboard);

  useEffect(() => {
    fetchDashboard();

    // Refresh dashboard after timer entry is confirmed by API
    const handleConfirmed = () => fetchDashboard(true);
    // Also handle optimistic update for immediate feedback
    const handleCompleted = () => fetchDashboard(true);
    window.addEventListener("timer-entry-confirmed", handleConfirmed);
    window.addEventListener("timer-entry-completed", handleCompleted);
    return () => {
      window.removeEventListener("timer-entry-confirmed", handleConfirmed);
      window.removeEventListener("timer-entry-completed", handleCompleted);
    };
  }, [fetchDashboard]);

  const handleResume = (entry: RecentEntry) => {
    resumeTimerOptimistic(
      {
        description: entry.description || "",
        projectId: entry.projectId,
        billable: entry.billable,
        project: entry.project,
        tags: entry.tags,
      },
      0
    );
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-olive)]">
        Failed to load dashboard data.
      </div>
    );
  }

  const maxProjectHours =
    data.topProjects.length > 0
      ? Math.max(...data.topProjects.map((p) => p.hours))
      : 1;

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto">
      {/* Page header — clear hierarchy */}
      <header className="space-y-1">
        <h1 className="font-sans text-[32px] md:text-[36px] font-semibold tracking-tight text-[var(--text-forest)] leading-none">
          Dashboard
        </h1>
        <p className="text-[14px] text-[var(--text-olive)]">
          An overview of your time and earnings.
        </p>
      </header>

      {/* Untracked commits banner — shown only when GitHub is connected and
          there are commits in the last 7 days not covered by any entry. */}
      <UntrackedCommitsBanner onEntryCreated={() => fetchDashboard(true)} />

      {/* Summary Cards */}
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

      {/* Earnings Trend + Top Projects */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Earnings — bar chart (honest about sparse data) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-sans text-[15px] font-semibold text-[var(--text-forest)]">
              Earnings — last 30 days
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

        {/* Top Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-[15px] font-semibold text-[var(--text-forest)]">
              Top projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProjects.length === 0 ? (
              <p className="text-sm text-[var(--text-olive)]">No project data yet.</p>
            ) : (
              <div className="space-y-5 mt-1">
                {data.topProjects.map((project) => (
                  <div key={project.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="font-medium text-[var(--text-forest)] truncate">
                          {project.name}
                        </span>
                        {project.commitCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full bg-[var(--bg-muted)] text-[10px] font-medium text-[var(--text-olive)] tabular-nums"
                            title={`${project.commitCount} commit${project.commitCount === 1 ? "" : "s"} in the last 30 days`}
                          >
                            <GitCommit className="h-2.5 w-2.5" />
                            {project.commitCount}
                          </span>
                        )}
                      </div>
                      <div className="text-right text-[12px] font-medium text-[var(--text-olive)] tabular-nums shrink-0">
                        <span>{formatHours(project.hours)}</span>
                        <span className="ml-2 text-[var(--text-forest)]">
                          {formatCurrency(project.earnings)}
                        </span>
                      </div>
                    </div>
                    <ProgressBar
                      value={project.hours}
                      max={maxProjectHours}
                      className="h-1"
                      indicatorClass=""
                      style={{ "--accent-olive": project.color } as React.CSSProperties}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contribution graph + Weekly recap — GitHub-connected users only. */}
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

"use client";

import { useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Clock, Calendar, TrendingUp, FolderKanban, Play } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TimeEntryRow } from "@/components/ui/time-entry-row";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatCard } from "@/components/ui/stat-card";
import { formatDuration, formatHours, formatCurrency } from "@/lib/earnings";
import { useTimerStore } from "@/stores/timer-store";
import { useAppStore } from "@/stores/app-store";
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

interface TopProject {
  id: string;
  name: string;
  color: string;
  hours: number;
  earnings: number;
}

export default function DashboardPage() {
  const data = useAppStore((s) => s.dashboard.data);
  const loading = useAppStore((s) => s.dashboard.loading) && !data;
  const fetchDashboard = useAppStore((s) => s.fetchDashboard);
  const startTimer = useTimerStore((s) => s.startTimer);

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

  const handleResume = async (entry: RecentEntry) => {
    try {
      const body = {
        description: entry.description || "",
        projectId: entry.projectId,
        billable: entry.billable,
        tagIds: entry.tags.map((t) => t.tagId),
      };
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to start timer");
      const newEntry = await res.json();
      startTimer({
        entryId: newEntry.id,
        startTime: newEntry.startTime,
        description: newEntry.description || "",
        projectId: newEntry.projectId,
        billable: newEntry.billable,
        tagIds: entry.tags.map((t) => t.tagId),
        hourlyRate: entry.project?.hourlyRate ?? 0,
      });
    } catch (err) {
      console.error("Resume error:", err);
    }
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
      <h1 className="font-serif text-[28px] font-semibold text-[var(--text-forest)]">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<Clock className="size-5" />}
          label="Today"
          hours={data.today.hours}
          earnings={data.today.earnings}
        />
        <SummaryCard
          icon={<Calendar className="size-5" />}
          label="This Week"
          hours={data.thisWeek.hours}
          earnings={data.thisWeek.earnings}
        />
        <SummaryCard
          icon={<TrendingUp className="size-5" />}
          label="This Month"
          hours={data.thisMonth.hours}
          earnings={data.thisMonth.earnings}
        />
        <StatCard
          icon={<FolderKanban className="size-5" />}
          title="Active Projects"
          value={
            <div>
              <div className="text-3xl font-bold">{data.activeProjects}</div>
              <p className="text-[13px] font-medium text-[var(--text-olive)] mt-1">projects</p>
            </div>
          }
        />
      </div>

      {/* Earnings Trend + Top Projects */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Earnings Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-sans text-base">Earnings Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.earningsTrend}>
                  <defs>
                    <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2D6B5A" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2D6B5A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val: string) => format(new Date(val + "T00:00:00"), "MMM d")}
                    tick={{ fill: "var(--text-olive)", fontSize: 12, fontFamily: "Inter" }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(val: number) => `$${val}`}
                    tick={{ fill: "var(--text-olive)", fontSize: 12, fontFamily: "Inter" }}
                    axisLine={false}
                    tickLine={false}
                    dx={-10}
                    width={60}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--border-subtle)", strokeWidth: 1, strokeDasharray: "4 4" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-[var(--radius-lg)] bg-[var(--bg-cream)] px-4 py-3 shadow-[var(--shadow-dropdown)] border border-[var(--border-subtle)]">
                          <p className="text-[13px] font-medium text-[var(--text-olive)] mb-1">
                            {format(new Date(label + "T00:00:00"), "MMM d, yyyy")}
                          </p>
                          <p className="text-[15px] font-bold text-[var(--accent-teal)]">
                            {formatCurrency(payload[0].value as number)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="earnings"
                    stroke="#2D6B5A"
                    strokeWidth={2}
                    fill="url(#earningsGradient)"
                    activeDot={{ r: 6, fill: "#2D6B5A", stroke: "var(--bg-cream)", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-base">Top Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProjects.length === 0 ? (
              <p className="text-sm text-[var(--text-olive)]">No project data yet.</p>
            ) : (
              <div className="space-y-6 mt-2">
                {data.topProjects.map((project) => (
                  <div key={project.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="font-medium text-[var(--text-forest)] truncate max-w-[200px] sm:max-w-none">
                          {project.name}
                        </span>
                      </div>
                      <div className="text-right text-[13px] font-medium text-[var(--text-olive)]">
                        <span>{formatHours(project.hours)}</span>
                        <span className="ml-[6px] text-[var(--accent-teal)]">
                          {formatCurrency(project.earnings)}
                        </span>
                      </div>
                    </div>
                    <ProgressBar 
                      value={project.hours} 
                      max={maxProjectHours} 
                      className="h-1.5"
                      indicatorClass=""
                      style={{"--accent-olive": project.color} as React.CSSProperties}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-base">Recent Entries</CardTitle>
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
  return (
    <StatCard
      icon={icon}
      title={label}
      value={
        <div>
          <div className="text-3xl font-bold text-[var(--text-forest)]">{formatHours(hours)}</div>
          <p className="text-[14px] font-semibold text-[var(--accent-olive)] mt-1">
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

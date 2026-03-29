"use client";

import { useEffect, useState, useCallback } from "react";
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
import { formatDuration, formatHours, formatCurrency } from "@/lib/earnings";
import { useTimerStore } from "@/stores/timer-store";
import { format } from "date-fns";

interface DashboardData {
  today: { hours: number; earnings: number };
  thisWeek: { hours: number; earnings: number };
  thisMonth: { hours: number; earnings: number };
  activeProjects: number;
  recentEntries: RecentEntry[];
  earningsTrend: { date: string; earnings: number }[];
  topProjects: TopProject[];
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const startTimer = useTimerStore((s) => s.startTimer);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
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
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Failed to load dashboard data.
      </div>
    );
  }

  const maxProjectHours =
    data.topProjects.length > 0
      ? Math.max(...data.topProjects.map((p) => p.hours))
      : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<Clock className="size-5 text-indigo-500" />}
          label="Today"
          hours={data.today.hours}
          earnings={data.today.earnings}
        />
        <SummaryCard
          icon={<Calendar className="size-5 text-blue-500" />}
          label="This Week"
          hours={data.thisWeek.hours}
          earnings={data.thisWeek.earnings}
        />
        <SummaryCard
          icon={<TrendingUp className="size-5 text-emerald-500" />}
          label="This Month"
          hours={data.thisMonth.hours}
          earnings={data.thisMonth.earnings}
        />
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderKanban className="size-5 text-amber-500" />
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Projects
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeProjects}</div>
            <p className="text-xs text-muted-foreground mt-1">projects</p>
          </CardContent>
        </Card>
      </div>

      {/* Earnings Trend + Top Projects */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Earnings Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Earnings Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.earningsTrend}>
                  <defs>
                    <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val: string) => format(new Date(val + "T00:00:00"), "MMM d")}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(val: number) => `$${val}`}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    width={60}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg bg-popover px-3 py-2 shadow-md ring-1 ring-foreground/10">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(label + "T00:00:00"), "MMM d, yyyy")}
                          </p>
                          <p className="text-sm font-semibold">
                            {formatCurrency(payload[0].value as number)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="earnings"
                    stroke="#4F46E5"
                    strokeWidth={2}
                    fill="url(#earningsGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Top Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No project data yet.</p>
            ) : (
              <div className="space-y-4">
                {data.topProjects.map((project) => (
                  <div key={project.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="font-medium truncate max-w-[120px]">
                          {project.name}
                        </span>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <span>{formatHours(project.hours)}</span>
                        <span className="ml-2 text-emerald-600 font-medium">
                          {formatCurrency(project.earnings)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(2, (project.hours / maxProjectHours) * 100)}%`,
                          backgroundColor: project.color,
                        }}
                      />
                    </div>
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
          <CardTitle>Recent Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No time entries yet. Start tracking!</p>
          ) : (
            <div className="divide-y">
              {data.recentEntries.map((entry) => {
                const duration = entry.duration || 0;
                const rate = entry.project?.hourlyRate ?? 0;
                const earnings = entry.billable ? (duration / 3600) * rate : 0;

                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-3 gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {entry.description || "(no description)"}
                      </p>
                      {entry.project && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: entry.project.color }}
                          />
                          <span className="text-xs text-muted-foreground truncate">
                            {entry.project.name}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-sm font-mono tabular-nums">
                        {formatDuration(duration)}
                      </span>
                      <span className="text-sm font-medium text-emerald-600 w-20 text-right">
                        {formatCurrency(earnings)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleResume(entry)}
                        title="Resume this entry"
                      >
                        <Play className="size-3.5" />
                      </Button>
                    </div>
                  </div>
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatHours(hours)}</div>
        <p className="text-sm font-medium text-emerald-600 mt-1">
          {formatCurrency(earnings)}
        </p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

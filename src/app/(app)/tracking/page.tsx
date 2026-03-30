"use client";

import { useEffect, useMemo } from "react";
import { parseISO, isSameDay, isToday, isYesterday, format } from "date-fns";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/earnings";
import { useAppStore } from "@/stores/app-store";

interface Project {
  id: string;
  name: string;
  color: string;
  hourlyRate: number | null;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TimeEntry {
  id: string;
  description: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  billable: boolean;
  projectId: string | null;
  project: Project | null;
  tags: { tagId: string; tag: Tag }[];
}

interface ProjectGroup {
  projectId: string | null;
  projectName: string;
  projectColor: string;
  count: number;
  totalSeconds: number;
}

interface DayGroup {
  date: Date;
  label: string;
  totalSeconds: number;
  projectGroups: ProjectGroup[];
}

function formatDayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE, d MMM");
}

function formatCompactDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function groupEntries(entries: TimeEntry[]): DayGroup[] {
  const completed = entries.filter((e) => e.endTime !== null && e.duration != null);

  const dayMap = new Map<string, { date: Date; entries: TimeEntry[] }>();

  for (const entry of completed) {
    const date = parseISO(entry.startTime);
    const key = format(date, "yyyy-MM-dd");
    if (!dayMap.has(key)) {
      dayMap.set(key, { date, entries: [] });
    }
    dayMap.get(key)!.entries.push(entry);
  }

  const dayGroups: DayGroup[] = [];

  for (const [, { date, entries: dayEntries }] of dayMap) {
    // Group by project within this day
    const projectMap = new Map<string, ProjectGroup>();

    for (const entry of dayEntries) {
      const pid = entry.projectId ?? "__none__";
      if (!projectMap.has(pid)) {
        projectMap.set(pid, {
          projectId: entry.projectId,
          projectName: entry.project?.name ?? "No project",
          projectColor: entry.project?.color ?? "#6B7280",
          count: 0,
          totalSeconds: 0,
        });
      }
      const group = projectMap.get(pid)!;
      group.count += 1;
      group.totalSeconds += entry.duration ?? 0;
    }

    const totalSeconds = dayEntries.reduce((sum, e) => sum + (e.duration ?? 0), 0);

    dayGroups.push({
      date,
      label: formatDayLabel(date),
      totalSeconds,
      projectGroups: Array.from(projectMap.values()).sort(
        (a, b) => b.totalSeconds - a.totalSeconds
      ),
    });
  }

  // Sort days newest first
  dayGroups.sort((a, b) => b.date.getTime() - a.date.getTime());

  return dayGroups;
}

export default function TrackingPage() {
  const entries = useAppStore((s) => s.trackingEntries.data);
  const storeLoading = useAppStore((s) => s.trackingEntries.loading);
  const fetchTrackingEntries = useAppStore((s) => s.fetchTrackingEntries);
  const loading = storeLoading && !entries;

  const dayGroups = useMemo(() => (entries ? groupEntries(entries) : []), [entries]);

  useEffect(() => {
    fetchTrackingEntries();

    const handleConfirmed = () => fetchTrackingEntries(true);
    window.addEventListener("timer-entry-confirmed", handleConfirmed);
    return () =>
      window.removeEventListener("timer-entry-confirmed", handleConfirmed);
  }, [fetchTrackingEntries]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-2 px-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (dayGroups.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Tracking</h1>
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No time entries yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start the timer to begin tracking your work.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Tracking</h1>

      <div className="space-y-4">
        {dayGroups.map((group) => (
          <div key={group.label}>
            {/* Day header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-semibold">{group.label}</h3>
              <span className="text-sm font-medium tabular-nums">
                {formatCompactDuration(group.totalSeconds)}
              </span>
            </div>

            {/* Project groups */}
            <Card className="divide-y divide-border">
              {group.projectGroups.map((pg) => (
                <div
                  key={pg.projectId ?? "none"}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  {/* Count badge */}
                  <span className="flex items-center justify-center h-7 w-7 rounded-full border border-border text-xs font-medium shrink-0">
                    {pg.count}
                  </span>

                  {/* Project color dot + name */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: pg.projectColor }}
                    />
                    <span className="text-sm font-medium truncate">
                      {pg.projectName}
                    </span>
                  </div>

                  {/* Duration */}
                  <span className="text-sm font-mono tabular-nums text-muted-foreground shrink-0">
                    {formatDuration(pg.totalSeconds)}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

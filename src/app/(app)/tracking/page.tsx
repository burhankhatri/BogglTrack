"use client";

import { useEffect, useState, useCallback } from "react";
import { parseISO, isSameDay, isToday, isYesterday, format } from "date-fns";
import { Clock, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/earnings";

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
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/time-entries?limit=200");
      if (!res.ok) throw new Error("Failed to fetch");
      const entries: TimeEntry[] = await res.json();
      setDayGroups(groupEntries(entries));
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();

    const handleTimerStopped = () => fetchEntries();
    window.addEventListener("timer-stopped", handleTimerStopped);
    return () => window.removeEventListener("timer-stopped", handleTimerStopped);
  }, [fetchEntries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
